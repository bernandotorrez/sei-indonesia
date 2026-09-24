'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StockAdjustmentLog extends Model {
    static associate(models) {
      StockAdjustmentLog.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
      StockAdjustmentLog.belongsTo(models.AuditSession, { foreignKey: 'audit_session_id', as: 'session' });
      StockAdjustmentLog.belongsTo(models.AuditSessionItem, { foreignKey: 'audit_session_item_id', as: 'sessionItem' });
      StockAdjustmentLog.belongsTo(models.User, { foreignKey: 'created_by', as: 'actor' });
    }
  }

  StockAdjustmentLog.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    product_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    audit_session_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    audit_session_item_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true
    },
    previous_qty: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    change_qty: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    new_qty: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'StockAdjustmentLog',
    tableName: 'stock_adjustment_logs',
    underscored: true,
    updatedAt: false
  });

  return StockAdjustmentLog;
};
