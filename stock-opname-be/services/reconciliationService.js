const { Op } = require('sequelize');
const { sequelize, ReconciliationJob, AuditSession, AuditSessionItem, Product, StockAdjustmentLog } = require('../models');
const auditLogService = require('./auditLogService');
const logger = require('../utils/logger');

const MAX_ATTEMPTS = 5;
const STALE_PROCESSING_MS = 60 * 1000;

// A job can be left in "processing" forever if the process crashes between claiming it and
// committing the reconciliation transaction (see reconcileOneJob). This sweeps those back to
// "pending" so another worker tick can pick them up, or gives up after MAX_ATTEMPTS.
async function requeueStaleJobs() {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);

  const staleJobs = await ReconciliationJob.findAll({
    where: { status: 'processing', updatedAt: { [Op.lt]: staleBefore } }
  });

  for (const job of staleJobs) {
    if (job.attempts >= MAX_ATTEMPTS) {
      await job.update({ status: 'failed', last_error: 'Exceeded max attempts after repeated crashes/timeouts' });
      logger.error(`Reconciliation job ${job.id} permanently failed after ${job.attempts} attempts`);
    } else {
      await job.update({ status: 'pending' });
    }
  }
}

async function claimNextJob() {
  return sequelize.transaction(async (transaction) => {
    const job = await ReconciliationJob.findOne({
      where: { status: 'pending' },
      order: [['createdAt', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true
    });

    if (!job) {
      return null;
    }

    await job.update({ status: 'processing', attempts: job.attempts + 1 }, { transaction });

    return job;
  });
}

// The actual reconciliation. Runs entirely in one transaction so a mid-run crash rolls back
// cleanly (no half-applied items visible to anyone), while `applied_at` on each item guards
// against double-applying a delta across separate attempts of the same job.
async function reconcileOneJob(job) {
  await sequelize.transaction(async (transaction) => {
    const session = await AuditSession.findByPk(job.audit_session_id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!session) {
      throw new Error(`Audit session ${job.audit_session_id} referenced by job ${job.id} no longer exists`);
    }

    const items = await AuditSessionItem.findAll({
      where: { audit_session_id: session.id, applied_at: null },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    for (const item of items) {
      const product = await Product.findByPk(item.product_id, { transaction, lock: transaction.LOCK.UPDATE });
      const discrepancy = item.counted_qty - item.expected_qty;
      const previousQty = product.on_hand_qty;
      const newQty = previousQty + discrepancy;

      await product.update({ on_hand_qty: newQty }, { transaction });
      await item.update({ discrepancy_qty: discrepancy, applied_at: new Date() }, { transaction });

      try {
        await StockAdjustmentLog.create({
          product_id: product.id,
          audit_session_id: session.id,
          audit_session_item_id: item.id,
          previous_qty: previousQty,
          change_qty: discrepancy,
          new_qty: newQty,
          created_by: job.requested_by
        }, { transaction });
      } catch (error) {
        // Unique constraint on audit_session_item_id is a second idempotency backstop:
        // if a log already exists for this item, it was already accounted for.
        if (error.name !== 'SequelizeUniqueConstraintError') {
          throw error;
        }
      }
    }

    await session.update({ status: 'APPROVED' }, { transaction });

    await auditLogService.record({
      actorId: job.requested_by,
      action: 'AUDIT_SESSION_APPROVED',
      entityType: 'AuditSession',
      entityId: session.id,
      metadata: { itemsReconciled: items.length },
      transaction
    });

    await job.update({ status: 'completed', completed_at: new Date() }, { transaction });
  });
}

async function processPendingJobs({ limit = 10 } = {}) {
  let processed = 0;

  for (let i = 0; i < limit; i += 1) {
    const job = await claimNextJob();
    if (!job) break;

    try {
      await reconcileOneJob(job);
      processed += 1;
    } catch (error) {
      logger.error(`Reconciliation job ${job.id} failed: ${error.message}`, { stack: error.stack });
      const isFinalAttempt = job.attempts >= MAX_ATTEMPTS;
      await job.update({
        status: isFinalAttempt ? 'failed' : 'pending',
        last_error: error.message
      });
    }
  }

  return processed;
}

module.exports = { requeueStaleJobs, processPendingJobs, MAX_ATTEMPTS };
