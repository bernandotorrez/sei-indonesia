'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AuditSessionItem extends Model {
    static associate(models) {
      AuditSessionItem.belongsTo(models.AuditSession, { foreignKey: 'audit_session_id', as: 'session' });
      AuditSessionItem.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
    }
  }

  AuditSessionItem.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    audit_session_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    product_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    expected_qty: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    counted_qty: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    discrepancy_qty: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    counted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    applied_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'AuditSessionItem',
    tableName: 'audit_session_items',
    underscored: true,
    indexes: [
      { unique: true, fields: ['audit_session_id', 'product_id'] }
    ]
  });

  return AuditSessionItem;
};
