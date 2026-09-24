const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../server');
const { sequelize, User, Product, StockAdjustmentLog, ReconciliationJob } = require('../models');
const reconciliationService = require('../services/reconciliationService');

let manager;
let staff;
let otherStaff;
let productA;
let productB;

async function login(email) {
  const res = await request(app).post('/v1/auth/login').send({ email, password: 'password123' });
  return res.body.data.token;
}

// The approve endpoint fires a best-effort, non-awaited nudge at the worker (see
// jobs/reconciliationWorker.js). That nudge can race with a test's own explicit call to
// `processPendingJobs`, so assertions on the job's end state poll instead of assuming either
// side wins first.
async function waitForJobStatus(sessionId, status, { timeoutMs = 3000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await ReconciliationJob.findOne({ where: { audit_session_id: sessionId } });
    if (job && job.status === status) return job;
    await reconciliationService.processPendingJobs();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Job for session ${sessionId} did not reach status "${status}" in time`);
}

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const passwordHash = await bcrypt.hash('password123', 4);

  manager = await User.create({ name: 'Test Manager', email: 'test-manager@example.com', password_hash: passwordHash, role: 'manager' });
  staff = await User.create({ name: 'Test Staff', email: 'test-staff@example.com', password_hash: passwordHash, role: 'staff' });
  otherStaff = await User.create({ name: 'Other Staff', email: 'other-staff@example.com', password_hash: passwordHash, role: 'staff' });

  productA = await Product.create({ sku: 'TST-A', name: 'Test Product A', on_hand_qty: 100 });
  productB = await Product.create({ sku: 'TST-B', name: 'Test Product B', on_hand_qty: 50 });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Stock Opname lifecycle', () => {
  it('runs initiation -> count submission -> approval -> reconciliation end to end', async () => {
    const managerToken = await login(manager.email);
    const staffToken = await login(staff.email);

    const initiateRes = await request(app)
      .post('/v1/audit-sessions')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ productIds: [productA.id, productB.id], assignedStaffId: staff.id });

    expect(initiateRes.status).toBe(201);
    expect(initiateRes.body.data.status).toBe('OPEN');
    const sessionId = initiateRes.body.data.id;

    const submitRes = await request(app)
      .post(`/v1/audit-sessions/${sessionId}/counts`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ items: [{ productId: productA.id, countedQty: 97 }, { productId: productB.id, countedQty: 55 }] });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe('SUBMITTED');

    const approveRes = await request(app)
      .post(`/v1/audit-sessions/${sessionId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(approveRes.status).toBe(202);
    expect(approveRes.body.data.status).toBe('APPROVING');

    // Drive the job to completion ourselves instead of waiting on the polling worker, so the
    // test is deterministic (this also tolerates the approve endpoint's own fire-and-forget
    // nudge winning the race and completing it first).
    await waitForJobStatus(sessionId, 'completed');

    const [updatedA, updatedB] = await Promise.all([
      Product.findByPk(productA.id),
      Product.findByPk(productB.id)
    ]);

    expect(updatedA.on_hand_qty).toBe(97);
    expect(updatedB.on_hand_qty).toBe(55);

    const logs = await StockAdjustmentLog.findAll({ where: { audit_session_id: sessionId } });
    expect(logs).toHaveLength(2);
  });

  it('rejects a batch with a duplicate product id', async () => {
    const managerToken = await login(manager.email);
    const staffToken = await login(staff.email);

    const initiateRes = await request(app)
      .post('/v1/audit-sessions')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ productIds: [productA.id], assignedStaffId: staff.id });

    const sessionId = initiateRes.body.data.id;

    const submitRes = await request(app)
      .post(`/v1/audit-sessions/${sessionId}/counts`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ items: [{ productId: productA.id, countedQty: 10 }, { productId: productA.id, countedQty: 20 }] });

    expect(submitRes.status).toBe(400);
  });

  it('rejects a batch that does not cover every item in the session', async () => {
    const managerToken = await login(manager.email);
    const staffToken = await login(staff.email);

    const initiateRes = await request(app)
      .post('/v1/audit-sessions')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ productIds: [productA.id, productB.id], assignedStaffId: staff.id });

    const sessionId = initiateRes.body.data.id;

    const submitRes = await request(app)
      .post(`/v1/audit-sessions/${sessionId}/counts`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ items: [{ productId: productA.id, countedQty: 10 }] });

    expect(submitRes.status).toBe(400);
    expect(submitRes.body.data.missingProductIds).toContain(productB.id);
  });

  it('forbids a staff member from submitting counts for a session assigned to someone else', async () => {
    const managerToken = await login(manager.email);
    const otherStaffToken = await login(otherStaff.email);

    const initiateRes = await request(app)
      .post('/v1/audit-sessions')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ productIds: [productA.id], assignedStaffId: staff.id });

    const sessionId = initiateRes.body.data.id;

    const submitRes = await request(app)
      .post(`/v1/audit-sessions/${sessionId}/counts`)
      .set('Authorization', `Bearer ${otherStaffToken}`)
      .send({ items: [{ productId: productA.id, countedQty: 10 }] });

    expect(submitRes.status).toBe(403);
  });

  it('is safe to approve twice: only one job and one set of adjustments is ever created', async () => {
    const managerToken = await login(manager.email);
    const staffToken = await login(staff.email);

    const productABefore = await Product.findByPk(productA.id);
    const expectedQtyAtSnapshot = productABefore.on_hand_qty;

    const initiateRes = await request(app)
      .post('/v1/audit-sessions')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ productIds: [productA.id], assignedStaffId: staff.id });

    const sessionId = initiateRes.body.data.id;

    await request(app)
      .post(`/v1/audit-sessions/${sessionId}/counts`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ items: [{ productId: productA.id, countedQty: 200 }] });

    const [firstApprove, secondApprove] = await Promise.all([
      request(app).post(`/v1/audit-sessions/${sessionId}/approve`).set('Authorization', `Bearer ${managerToken}`),
      request(app).post(`/v1/audit-sessions/${sessionId}/approve`).set('Authorization', `Bearer ${managerToken}`)
    ]);

    expect(firstApprove.status).toBe(202);
    expect(secondApprove.status).toBe(202);

    const jobs = await ReconciliationJob.findAll({ where: { audit_session_id: sessionId } });
    expect(jobs).toHaveLength(1);

    await waitForJobStatus(sessionId, 'completed');
    await reconciliationService.processPendingJobs(); // simulate a redundant worker tick on top

    const logs = await StockAdjustmentLog.findAll({ where: { audit_session_id: sessionId } });
    expect(logs).toHaveLength(1);
    expect(logs[0].change_qty).toBe(200 - expectedQtyAtSnapshot);
  });
});
