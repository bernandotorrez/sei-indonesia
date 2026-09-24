'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ReconciliationJob extends Model {
    static associate(models) {
      ReconciliationJob.belongsTo(models.AuditSession, { foreignKey: 'audit_session_id', as: 'session' });
      ReconciliationJob.belongsTo(models.User, { foreignKey: 'requested_by', as: 'requester' });
    }
  }

  ReconciliationJob.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    audit_session_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    last_error: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    requested_by: {
      type: DataTypes.UUID,
      allowNull: false
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'ReconciliationJob',
    tableName: 'reconciliation_jobs',
    underscored: true
  });

  return ReconciliationJob;
};
