const express = require('express');
const router = express.Router();

const { AuditLog, User } = require('../../models');
const requireRole = require('../../middleware/requireRole');
const { sendSuccess } = require('../../utils/response');

router.get('/', requireRole('manager', 'admin'), async (req, res) => {
  const { action, entityType, entityId, actorId, limit } = req.query;

  const where = {};
  if (action) where.action = action;
  if (entityType) where.entity_type = entityType;
  if (entityId) where.entity_id = entityId;
  if (actorId) where.actor_id = actorId;

  const logs = await AuditLog.findAll({
    where,
    include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'email', 'role'] }],
    order: [['createdAt', 'DESC']],
    limit: Math.min(Number(limit) || 100, 200)
  });

  sendSuccess(res, { message: 'Audit logs retrieved', data: logs });
});

module.exports = router;
