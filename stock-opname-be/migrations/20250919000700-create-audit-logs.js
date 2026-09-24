'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      actor_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      // Kept alongside actor_id (not derived via join) so a login-failure row for an unknown
      // or since-deleted account still records who/what was attempted.
      actor_email: { type: Sequelize.STRING(150), allowNull: true },
      action: { type: Sequelize.STRING(60), allowNull: false },
      // Polymorphic reference (no FK - can point at users, products, or audit_sessions).
      entity_type: { type: Sequelize.STRING(60), allowNull: true },
      entity_id: { type: Sequelize.UUID, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      ip_address: { type: Sequelize.STRING(64), allowNull: true },
      user_agent: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });

    await queryInterface.addIndex('audit_logs', ['action']);
    await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('audit_logs', ['actor_id']);
    await queryInterface.addIndex('audit_logs', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  }
};
