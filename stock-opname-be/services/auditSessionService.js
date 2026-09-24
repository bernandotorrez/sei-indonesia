const { sequelize, AuditSession, AuditSessionItem, ReconciliationJob, Product, User } = require('../models');
const auditSessionRepository = require('../repositories/auditSessionRepository');
const auditLogService = require('./auditLogService');
const NotFoundError = require('../exceptions/NotFoundError');
const BadRequestError = require('../exceptions/BadRequestError');
const ForbiddenError = require('../exceptions/ForbiddenError');
const ConflictError = require('../exceptions/ConflictError');
const { nudgeWorker } = require('../jobs/reconciliationWorker');

const TERMINAL_OR_INFLIGHT_APPROVAL_STATUSES = ['APPROVING', 'APPROVED'];

async function initiateSession({ productIds, assignedStaffId }, manager) {
  const staff = await User.findByPk(assignedStaffId);

  if (!staff || staff.role !== 'staff' || !staff.is_active) {
    throw new BadRequestError('assignedStaffId must reference an active staff user');
  }

  const products = await Product.findAll({ where: { id: productIds } });

  if (products.length !== productIds.length) {
    const foundIds = new Set(products.map((product) => product.id));
    const missing = productIds.filter((id) => !foundIds.has(id));
    throw new BadRequestError(`Unknown product id(s): ${missing.join(', ')}`);
  }

  return sequelize.transaction(async (transaction) => {
    const session = await AuditSession.create({
      code: auditSessionRepository.generateCode(),
      status: 'OPEN',
      assigned_staff_id: assignedStaffId,
      created_by: manager.id
    }, { transaction });

    await AuditSessionItem.bulkCreate(
      products.map((product) => ({
        audit_session_id: session.id,
        product_id: product.id,
        expected_qty: product.on_hand_qty
      })),
      { transaction }
    );

    await auditLogService.record({
      actorId: manager.id,
      actorEmail: manager.email,
      action: 'AUDIT_SESSION_INITIATED',
      entityType: 'AuditSession',
      entityId: session.id,
      metadata: { code: session.code, productCount: products.length, assignedStaffId },
      transaction
    });

    return auditSessionRepository.findById(session.id, { transaction });
  });
}

async function listSessions(user, filters) {
  return auditSessionRepository.listForUser(user, filters);
}

async function getSession(id) {
  const session = await auditSessionRepository.findById(id);

  if (!session) {
    throw new NotFoundError('Audit session not found');
  }

  return session;
}

async function submitCounts(sessionId, { items }, staffUser) {
  return sequelize.transaction(async (transaction) => {
    const session = await AuditSession.findByPk(sessionId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!session) {
      throw new NotFoundError('Audit session not found');
    }

    if (session.assigned_staff_id !== staffUser.id) {
      throw new ForbiddenError('You are not the staff assigned to this session');
    }

    if (session.status !== 'OPEN') {
      throw new ConflictError(`Counts can only be submitted while the session is OPEN (current status: ${session.status})`);
    }

    // Locked separately (not via `include`) because Postgres refuses FOR UPDATE across the
    // outer join a hasMany include would generate.
    const sessionItems = await AuditSessionItem.findAll({
      where: { audit_session_id: session.id },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    const itemsByProductId = new Map(sessionItems.map((item) => [item.product_id, item]));
    const submittedProductIds = new Set(items.map((item) => item.productId));

    const unknown = items.filter((item) => !itemsByProductId.has(item.productId));
    if (unknown.length > 0) {
      throw new BadRequestError(`These products are not part of this session: ${unknown.map((i) => i.productId).join(', ')}`);
    }

    const missing = [...itemsByProductId.keys()].filter((productId) => !submittedProductIds.has(productId));
    if (missing.length > 0) {
      throw new BadRequestError('A count must be submitted for every item in the session before it can be submitted', {
        missingProductIds: missing
      });
    }

    const now = new Date();

    await Promise.all(items.map((item) => {
      const sessionItem = itemsByProductId.get(item.productId);
      return sessionItem.update({ counted_qty: item.countedQty, counted_at: now }, { transaction });
    }));

    await session.update({ status: 'SUBMITTED', submitted_at: now }, { transaction });

    await auditLogService.record({
      actorId: staffUser.id,
      actorEmail: staffUser.email,
      action: 'AUDIT_SESSION_COUNTS_SUBMITTED',
      entityType: 'AuditSession',
      entityId: session.id,
      metadata: { itemCount: items.length },
      transaction
    });

    return auditSessionRepository.findById(session.id, { transaction });
  });
}

async function approveSession(sessionId, managerUser) {
  const result = await sequelize.transaction(async (transaction) => {
    const session = await AuditSession.findByPk(sessionId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!session) {
      throw new NotFoundError('Audit session not found');
    }

    // Idempotent retry: approve was already accepted, just hand back the current state
    // instead of creating a second job or throwing on a duplicate click / retried request.
    if (TERMINAL_OR_INFLIGHT_APPROVAL_STATUSES.includes(session.status)) {
      return { session, alreadyRequested: true };
    }

    if (session.status !== 'SUBMITTED') {
      throw new ConflictError(`Only a SUBMITTED session can be approved (current status: ${session.status})`);
    }

    try {
      await ReconciliationJob.create({
        audit_session_id: session.id,
        status: 'pending',
        requested_by: managerUser.id
      }, { transaction });
    } catch (error) {
      if (error.name !== 'SequelizeUniqueConstraintError') {
        throw error;
      }
      // A job already exists (race with a concurrent approve) - fall through as idempotent.
    }

    await session.update({
      status: 'APPROVING',
      reviewed_by: managerUser.id,
      reviewed_at: new Date()
    }, { transaction });

    await auditLogService.record({
      actorId: managerUser.id,
      actorEmail: managerUser.email,
      action: 'AUDIT_SESSION_APPROVAL_REQUESTED',
      entityType: 'AuditSession',
      entityId: session.id,
      transaction
    });

    return { session, alreadyRequested: false };
  });

  if (!result.alreadyRequested) {
    // Fire-and-forget: don't make the caller wait for reconciliation to run.
    // The polling worker will also pick this job up on its own schedule regardless.
    nudgeWorker();
  }

  return auditSessionRepository.findById(sessionId);
}

async function rejectSession(sessionId, { note }, managerUser) {
  return sequelize.transaction(async (transaction) => {
    const session = await AuditSession.findByPk(sessionId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!session) {
      throw new NotFoundError('Audit session not found');
    }

    if (session.status === 'REJECTED') {
      return auditSessionRepository.findById(sessionId, { transaction });
    }

    if (session.status !== 'SUBMITTED') {
      throw new ConflictError(`Only a SUBMITTED session can be rejected (current status: ${session.status})`);
    }

    await session.update({
      status: 'REJECTED',
      reviewed_by: managerUser.id,
      reviewed_at: new Date(),
      review_note: note
    }, { transaction });

    await auditLogService.record({
      actorId: managerUser.id,
      actorEmail: managerUser.email,
      action: 'AUDIT_SESSION_REJECTED',
      entityType: 'AuditSession',
      entityId: session.id,
      metadata: { note },
      transaction
    });

    return auditSessionRepository.findById(session.id, { transaction });
  });
}

module.exports = { initiateSession, listSessions, getSession, submitCounts, approveSession, rejectSession };
