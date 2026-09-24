'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_session_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      audit_session_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'audit_sessions', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      expected_qty: { type: Sequelize.INTEGER, allowNull: false },
      counted_qty: { type: Sequelize.INTEGER, allowNull: true },
      discrepancy_qty: { type: Sequelize.INTEGER, allowNull: true },
      counted_at: { type: Sequelize.DATE, allowNull: true },
      applied_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });

    await queryInterface.addIndex('audit_session_items', ['audit_session_id', 'product_id'], {
      unique: true,
      name: 'audit_session_items_session_product_uk'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_session_items');
  }
};
