'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reconciliation_jobs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      audit_session_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'audit_sessions', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      last_error: { type: Sequelize.TEXT, allowNull: true },
      requested_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });

    await queryInterface.addIndex('reconciliation_jobs', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reconciliation_jobs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_reconciliation_jobs_status";');
  }
};
