const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../server');
const { sequelize, User, Product, AuditLog } = require('../models');

let manager;
let staff;

async function login(email, password = 'password123') {
  return request(app).post('/v1/auth/login').send({ email, password });
}

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const passwordHash = await bcrypt.hash('password123', 4);
  manager = await User.create({ name: 'Audit Manager', email: 'audit-manager@example.com', password_hash: passwordHash, role: 'manager' });
  staff = await User.create({ name: 'Audit Staff', email: 'audit-staff@example.com', password_hash: passwordHash, role: 'staff' });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Audit logging', () => {
  it('records a successful login against the user', async () => {
    const res = await login(manager.email);
    expect(res.status).toBe(200);

    const log = await AuditLog.findOne({ where: { action: 'AUTH_LOGIN_SUCCESS', actor_id: manager.id } });
    expect(log).not.toBeNull();
    expect(log.actor_email).toBe(manager.email);
  });

  it('records a failed login with the reason, even though the client only sees a generic error', async () => {
    const res = await login(manager.email, 'wrong-password');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');

    const log = await AuditLog.findOne({
      where: { action: 'AUTH_LOGIN_FAILED', actor_id: manager.id },
      order: [['createdAt', 'DESC']]
    });
    expect(log).not.toBeNull();
    expect(log.metadata.reason).toBe('wrong_password');
  });

  it('records a failed login for an unknown email without an actor_id', async () => {
    const res = await login('nobody@example.com');
    expect(res.status).toBe(401);

    const log = await AuditLog.findOne({ where: { action: 'AUTH_LOGIN_FAILED', actor_email: 'nobody@example.com' } });
    expect(log).not.toBeNull();
    expect(log.actor_id).toBeNull();
    expect(log.metadata.reason).toBe('unknown_email');
  });

  it('records product creation and updates with a before/after snapshot', async () => {
    const managerToken = (await login(manager.email)).body.data.token;

    const createRes = await request(app)
      .post('/v1/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ sku: 'AUD-1', name: 'Audited Product', onHandQty: 10 });

    expect(createRes.status).toBe(201);
    const productId = createRes.body.data.id;

    const createdLog = await AuditLog.findOne({ where: { action: 'PRODUCT_CREATED', entity_id: productId } });
    expect(createdLog).not.toBeNull();
    expect(createdLog.metadata.sku).toBe('AUD-1');

    const updateRes = await request(app)
      .patch(`/v1/products/${productId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Renamed Product' });

    expect(updateRes.status).toBe(200);

    const updatedLog = await AuditLog.findOne({ where: { action: 'PRODUCT_UPDATED', entity_id: productId } });
    expect(updatedLog).not.toBeNull();
    expect(updatedLog.metadata.before.name).toBe('Audited Product');
    expect(updatedLog.metadata.after.name).toBe('Renamed Product');
  });

  it('builds an activity trail on the audit session itself as it moves through its lifecycle', async () => {
    const managerToken = (await login(manager.email)).body.data.token;
    const staffToken = (await login(staff.email)).body.data.token;

    const product = await Product.create({ sku: 'AUD-2', name: 'Trail Product', on_hand_qty: 5 });

    const initiateRes = await request(app)
      .post('/v1/audit-sessions')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ productIds: [product.id], assignedStaffId: staff.id });

    const sessionId = initiateRes.body.data.id;

    await request(app)
      .post(`/v1/audit-sessions/${sessionId}/counts`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ items: [{ productId: product.id, countedQty: 5 }] });

    const detailRes = await request(app)
      .get(`/v1/audit-sessions/${sessionId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    const actions = detailRes.body.data.auditLogs.map((entry) => entry.action);
    expect(actions).toEqual(['AUDIT_SESSION_INITIATED', 'AUDIT_SESSION_COUNTS_SUBMITTED']);
  });

  it('exposes a manager-only audit log endpoint', async () => {
    const managerToken = (await login(manager.email)).body.data.token;
    const staffToken = (await login(staff.email)).body.data.token;

    const managerRes = await request(app).get('/v1/audit-logs').set('Authorization', `Bearer ${managerToken}`);
    expect(managerRes.status).toBe(200);
    expect(managerRes.body.data.length).toBeGreaterThan(0);

    const staffRes = await request(app).get('/v1/audit-logs').set('Authorization', `Bearer ${staffToken}`);
    expect(staffRes.status).toBe(403);
  });
});
