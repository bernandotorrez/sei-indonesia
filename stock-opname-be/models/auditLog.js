'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AuditLog extends Model {
    static associate(models) {
      AuditLog.belongsTo(models.User, { foreignKey: 'actor_id', as: 'actor' });
    }
  }

  AuditLog.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    actor_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    actor_email: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    action: {
      type: DataTypes.STRING(60),
      allowNull: false
    },
    entity_type: {
      type: DataTypes.STRING(60),
      allowNull: true
    },
    entity_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    ip_address: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    user_agent: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_logs',
    underscored: true,
    updatedAt: false
  });

  return AuditLog;
};
