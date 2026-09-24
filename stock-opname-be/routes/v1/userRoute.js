const express = require('express');
const router = express.Router();

const userRepository = require('../../repositories/userRepository');
const userValidator = require('../../validators/userValidator');
const requireRole = require('../../middleware/requireRole');
const auditLogService = require('../../services/auditLogService');
const ForbiddenError = require('../../exceptions/ForbiddenError');
const { sendSuccess } = require('../../utils/response');

router.get('/staff', requireRole('manager'), async (req, res) => {
  const staff = await userRepository.listStaff();

  sendSuccess(res, { message: 'Staff users retrieved', data: staff.map((user) => user.toSafeJSON()) });
});

router.get('/', requireRole('admin'), async (req, res) => {
  const users = await userRepository.list();

  sendSuccess(res, { message: 'Users retrieved', data: users.map((user) => user.toSafeJSON()) });
});

router.post('/', requireRole('admin'), async (req, res) => {
  const payload = userValidator.create(req.body);

  const user = await userRepository.create(payload);

  await auditLogService.recordSafely({
    actorId: req.user.id,
    actorEmail: req.user.email,
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
    req
  });

  sendSuccess(res, { statusCode: 201, message: 'User created', data: user.toSafeJSON() });
});

router.patch('/:id', requireRole('admin'), async (req, res) => {
  const payload = userValidator.update(req.body);

  if (req.params.id === req.user.id && (payload.role !== undefined || payload.isActive === false)) {
    throw new ForbiddenError('You cannot change your own role or deactivate your own account');
  }

  const before = await userRepository.getByIdOrFail(req.params.id);
  const beforeSnapshot = { name: before.name, role: before.role, isActive: before.is_active };

  const user = await userRepository.update(req.params.id, payload);

  await auditLogService.recordSafely({
    actorId: req.user.id,
    actorEmail: req.user.email,
    action: 'USER_UPDATED',
    entityType: 'User',
    entityId: user.id,
    metadata: {
      before: beforeSnapshot,
      after: { name: user.name, role: user.role, isActive: user.is_active },
      passwordChanged: Boolean(payload.password)
    },
    req
  });

  sendSuccess(res, { message: 'User updated', data: user.toSafeJSON() });
});

router.post('/:id/unlock', requireRole('admin'), async (req, res) => {
  const user = await userRepository.unlock(req.params.id);

  await auditLogService.recordSafely({
    actorId: req.user.id,
    actorEmail: req.user.email,
    action: 'USER_UNLOCKED',
    entityType: 'User',
    entityId: user.id,
    req
  });

  sendSuccess(res, { message: 'User unlocked', data: user.toSafeJSON() });
});

module.exports = router;
