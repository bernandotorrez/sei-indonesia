'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      Product.hasMany(models.AuditSessionItem, { foreignKey: 'product_id', as: 'sessionItems' });
      Product.hasMany(models.StockAdjustmentLog, { foreignKey: 'product_id', as: 'adjustmentLogs' });
    }
  }

  Product.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    sku: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    on_hand_qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'Product',
    tableName: 'products',
    underscored: true
  });

  return Product;
};
