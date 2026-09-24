'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('products', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      sku: { type: Sequelize.STRING(60), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      on_hand_qty: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('products');
  }
};
