const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../server');
const { sequelize, User } = require('../models');

let admin;
let manager;
let staff;

async function login(email, password = 'password123') {
  return request(app).post('/v1/auth/login').send({ email, password });
}

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const passwordHash = await bcrypt.hash('password123', 4);
  admin = await User.create({ name: 'Sec Admin', email: 'sec-admin@example.com', password_hash: passwordHash, role: 'admin' });
  manager = await User.create({ name: 'Sec Manager', email: 'sec-manager@example.com', password_hash: passwordHash, role: 'manager' });
  staff = await User.create({ name: 'Sec Staff', email: 'sec-staff@example.com', password_hash: passwordHash, role: 'staff' });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Login security: rate limiting is separate from account lockout', () => {
  it('locks the account after 3 wrong passwords and blocks further attempts, even with the right password', async () => {
    const wrong1 = await login(staff.email, 'wrong-password');
    expect(wrong1.status).toBe(401);

    const wrong2 = await login(staff.email, 'wrong-password');
    expect(wrong2.status).toBe(401);

    const wrong3 = await login(staff.email, 'wrong-password');
    expect(wrong3.status).toBe(423);
    expect(wrong3.body.message).toMatch(/locked/i);

    // Even the correct password is rejected while locked.
    const correctButLocked = await login(staff.email);
    expect(correctButLocked.status).toBe(423);

    await staff.reload();
    expect(staff.failed_login_attempts).toBeGreaterThanOrEqual(3);
    expect(staff.locked_until).not.toBeNull();
  });

  it('lets an admin unlock the account, after which login works again', async () => {
    const adminToken = (await login(admin.email)).body.data.token;

    const unlockRes = await request(app)
      .post(`/v1/users/${staff.id}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(unlockRes.status).toBe(200);
    expect(unlockRes.body.data.isLocked).toBe(false);

    const loginRes = await login(staff.email);
    expect(loginRes.status).toBe(200);
  });

  it('resets the failed-attempt counter on a successful login', async () => {
    await login(manager.email, 'wrong-once');

    await manager.reload();
    expect(manager.failed_login_attempts).toBe(1);

    const success = await login(manager.email);
    expect(success.status).toBe(200);

    await manager.reload();
    expect(manager.failed_login_attempts).toBe(0);
    expect(manager.locked_until).toBeNull();
  });
});

describe('Admin-only user management', () => {
  it('forbids a non-admin from listing or creating users', async () => {
    const managerToken = (await login(manager.email)).body.data.token;

    const listRes = await request(app).get('/v1/users').set('Authorization', `Bearer ${managerToken}`);
    expect(listRes.status).toBe(403);

    const createRes = await request(app)
      .post('/v1/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Nope', email: 'nope@example.com', password: 'password123', role: 'staff' });
    expect(createRes.status).toBe(403);
  });

  it('lets an admin create, list, and update a user', async () => {
    const adminToken = (await login(admin.email)).body.data.token;

    const createRes = await request(app)
      .post('/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Hire', email: 'new-hire@example.com', password: 'password123', role: 'staff' });

    expect(createRes.status).toBe(201);
    const newUserId = createRes.body.data.id;

    const listRes = await request(app).get('/v1/users').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((user) => user.id === newUserId)).toBe(true);

    const updateRes = await request(app)
      .patch(`/v1/users/${newUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'manager' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.role).toBe('manager');
  });

  it('stops an admin from demoting or deactivating their own account', async () => {
    const adminToken = (await login(admin.email)).body.data.token;

    const demoteRes = await request(app)
      .patch(`/v1/users/${admin.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'staff' });
    expect(demoteRes.status).toBe(403);

    const deactivateRes = await request(app)
      .patch(`/v1/users/${admin.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(deactivateRes.status).toBe(403);
  });
});

describe('reCAPTCHA', () => {
  it('does not block login in test mode, even if a real RECAPTCHA_SECRET_KEY is configured in .env', async () => {
    // Deliberately not asserting RECAPTCHA_SECRET_KEY is empty here - a developer's local .env
    // may well have a real key in it (shared with the "npm run dev" flow). What actually matters
    // is that NODE_ENV=test bypasses verification regardless, so this test never depends on a
    // live call to Google's API. See utils/recaptcha.js.
    const res = await login(admin.email);
    expect(res.status).toBe(200);
  });
});
