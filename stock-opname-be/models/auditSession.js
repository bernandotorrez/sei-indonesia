'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AuditSession extends Model {
    static associate(models) {
      AuditSession.belongsTo(models.User, { foreignKey: 'assigned_staff_id', as: 'assignedStaff' });
      AuditSession.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
      AuditSession.belongsTo(models.User, { foreignKey: 'reviewed_by', as: 'reviewer' });
      AuditSession.hasMany(models.AuditSessionItem, { foreignKey: 'audit_session_id', as: 'items' });
      AuditSession.hasOne(models.ReconciliationJob, { foreignKey: 'audit_session_id', as: 'reconciliationJob' });
      // Polymorphic: audit_logs.entity_id points at this session's id whenever entity_type is
      // 'AuditSession'. No FK - the same table also logs against 'Product' and 'User'.
      AuditSession.hasMany(models.AuditLog, {
        foreignKey: 'entity_id',
        constraints: false,
        scope: { entity_type: 'AuditSession' },
        as: 'auditLogs'
      });
    }
  }

  AuditSession.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    code: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.ENUM('OPEN', 'SUBMITTED', 'APPROVING', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'OPEN'
    },
    assigned_staff_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    review_note: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'AuditSession',
    tableName: 'audit_sessions',
    underscored: true
  });

  return AuditSession;
};
