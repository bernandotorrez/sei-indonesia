'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.AuditSession, { foreignKey: 'assigned_staff_id', as: 'assignedSessions' });
      User.hasMany(models.AuditSession, { foreignKey: 'created_by', as: 'createdSessions' });
    }

    toSafeJSON() {
      const {
        id, name, email, role, is_active: isActive,
        failed_login_attempts: failedLoginAttempts, locked_until: lockedUntil
      } = this.get();

      return {
        id,
        name,
        email,
        role,
        isActive,
        failedLoginAttempts,
        lockedUntil,
        isLocked: !!(lockedUntil && new Date(lockedUntil) > new Date())
      };
    }
  }

  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
      validate: { isEmail: true }
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('staff', 'manager', 'admin'),
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    failed_login_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true
  });

  return User;
};
