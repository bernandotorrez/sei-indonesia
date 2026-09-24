'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_sessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      code: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      status: {
        type: Sequelize.ENUM('OPEN', 'SUBMITTED', 'APPROVING', 'APPROVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'OPEN'
      },
      assigned_staff_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      submitted_at: { type: Sequelize.DATE, allowNull: true },
      reviewed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      reviewed_at: { type: Sequelize.DATE, allowNull: true },
      review_note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });

    await queryInterface.addIndex('audit_sessions', ['status']);
    await queryInterface.addIndex('audit_sessions', ['assigned_staff_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_sessions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_audit_sessions_status";');
  }
};
