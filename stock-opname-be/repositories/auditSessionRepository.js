const crypto = require('crypto');
const { AuditSession, AuditSessionItem, Product, User, ReconciliationJob, AuditLog } = require('../models');

const BASE_INCLUDE = [
  { model: AuditSessionItem, as: 'items', include: [{ model: Product, as: 'product' }] },
  { model: User, as: 'assignedStaff', attributes: ['id', 'name', 'email'] },
  { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
  { model: User, as: 'reviewer', attributes: ['id', 'name', 'email'] },
  { model: ReconciliationJob, as: 'reconciliationJob' }
];

// `separate: true` runs this as its own query instead of an extra outer join, which keeps it
// out of the way of any lock the caller took on the main session row, and is why this list of
// includes is only used for a single-session fetch, not the (potentially large) sessions list.
const DETAIL_INCLUDE = [
  ...BASE_INCLUDE,
  {
    model: AuditLog,
    as: 'auditLogs',
    separate: true,
    order: [['createdAt', 'ASC']],
    include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'email'] }]
  }
];

class AuditSessionRepository {
  generateCode() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `SO-${date}-${suffix}`;
  }

  findById(id, { transaction, lock } = {}) {
    return AuditSession.findByPk(id, { include: DETAIL_INCLUDE, transaction, lock });
  }

  listForUser(user, { status } = {}) {
    const where = {};

    if (user.role === 'staff') {
      where.assigned_staff_id = user.id;
    }

    if (status) {
      where.status = status;
    }

    return AuditSession.findAll({
      where,
      include: BASE_INCLUDE,
      order: [['createdAt', 'DESC']]
    });
  }
}

module.exports = new AuditSessionRepository();
