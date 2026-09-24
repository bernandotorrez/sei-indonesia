'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('stock_adjustment_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      audit_session_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'audit_sessions', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      audit_session_item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'audit_session_items', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      previous_qty: { type: Sequelize.INTEGER, allowNull: false },
      change_qty: { type: Sequelize.INTEGER, allowNull: false },
      new_qty: { type: Sequelize.INTEGER, allowNull: false },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });

    await queryInterface.addIndex('stock_adjustment_logs', ['product_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stock_adjustment_logs');
  }
};
