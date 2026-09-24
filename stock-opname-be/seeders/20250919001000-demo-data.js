'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DEMO_PASSWORD = 'password123';

module.exports = {
  async up(queryInterface) {
    // sequelize-cli does not track which seeders already ran the way it tracks migrations, so
    // `db:seed:all` re-inserting into an already-seeded database (e.g. every `docker compose up`
    // against the same persisted volume) is expected, not a rare edge case - check first so this
    // seeder is idempotent like everything else in this project.
    const [existingAdmin] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = \'admin@stockopname.test\' LIMIT 1'
    );
    if (existingAdmin.length > 0) {
      return;
    }

    const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
    const now = new Date();

    const adminId = uuidv4();
    const managerId = uuidv4();
    const staffOneId = uuidv4();
    const staffTwoId = uuidv4();

    await queryInterface.bulkInsert('users', [
      {
        id: adminId,
        name: 'Ade Admin',
        email: 'admin@stockopname.test',
        password_hash: passwordHash,
        role: 'admin',
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        id: managerId,
        name: 'Maya Manager',
        email: 'manager@stockopname.test',
        password_hash: passwordHash,
        role: 'manager',
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        id: staffOneId,
        name: 'Sam Staff',
        email: 'staff1@stockopname.test',
        password_hash: passwordHash,
        role: 'staff',
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        id: staffTwoId,
        name: 'Sasa Staff',
        email: 'staff2@stockopname.test',
        password_hash: passwordHash,
        role: 'staff',
        is_active: true,
        created_at: now,
        updated_at: now
      }
    ]);

    const products = [
      { sku: 'SKU-0001', name: 'Engine Oil 1L', on_hand_qty: 120 },
      { sku: 'SKU-0002', name: 'Brake Pad Set', on_hand_qty: 45 },
      { sku: 'SKU-0003', name: 'Air Filter', on_hand_qty: 80 },
      { sku: 'SKU-0004', name: 'Spark Plug', on_hand_qty: 200 },
      { sku: 'SKU-0005', name: 'Wiper Blade', on_hand_qty: 60 },
      { sku: 'SKU-0006', name: 'Car Battery 12V', on_hand_qty: 25 },
      { sku: 'SKU-0007', name: 'Cabin Air Filter', on_hand_qty: 55 },
      { sku: 'SKU-0008', name: 'Coolant 1L', on_hand_qty: 90 }
    ].map((product) => ({
      id: uuidv4(),
      ...product,
      is_active: true,
      created_at: now,
      updated_at: now
    }));

    await queryInterface.bulkInsert('products', products);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('products', null, {});
    await queryInterface.bulkDelete('users', null, {});
  }
};
