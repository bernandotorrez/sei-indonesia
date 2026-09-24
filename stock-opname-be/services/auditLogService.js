const { AuditLog } = require('../models');
const logger = require('../utils/logger');

function requestMeta(req) {
  if (!req) return {};
  return {
    ip_address: req.ip,
    user_agent: req.headers?.['user-agent'] || null
  };
}

// Used inside an existing DB transaction, so the audit row lives or dies with the business
// change it's documenting (e.g. approving a session and recording that it was approved are one
// atomic unit - either both happen or neither does).
async function record({ actorId = null, actorEmail = null, action, entityType = null, entityId = null, metadata = null, req = null, transaction } = {}) {
  return AuditLog.create({
    actor_id: actorId,
    actor_email: actorEmail,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
    ...requestMeta(req)
  }, { transaction });
}

// Used for standalone events with no surrounding transaction (e.g. a login attempt). A failure
// to write the audit row must never take down the feature it's observing, so this swallows
// errors and just logs them instead of propagating.
async function recordSafely(params) {
  try {
    await record(params);
  } catch (error) {
    logger.error(`Failed to write audit log for action "${params?.action}": ${error.message}`, { stack: error.stack });
  }
}

module.exports = { record, recordSafely };
