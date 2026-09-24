const express = require('express');
const router = express.Router();

const auditSessionService = require('../../services/auditSessionService');
const auditSessionValidator = require('../../validators/auditSessionValidator');
const requireRole = require('../../middleware/requireRole');
const ForbiddenError = require('../../exceptions/ForbiddenError');
const { sendSuccess } = require('../../utils/response');

function assertStaffCanView(session, user) {
  if (user.role === 'staff' && session.assigned_staff_id !== user.id) {
    throw new ForbiddenError('This audit session is not assigned to you');
  }
}

router.post('/', requireRole('manager'), async (req, res) => {
  const payload = auditSessionValidator.initiate(req.body);

  const session = await auditSessionService.initiateSession(payload, req.user);

  sendSuccess(res, { statusCode: 201, message: 'Audit session initiated', data: session });
});

router.get('/', async (req, res) => {
  const { status } = req.query;

  const sessions = await auditSessionService.listSessions(req.user, { status });

  sendSuccess(res, { message: 'Audit sessions retrieved', data: sessions });
});

router.get('/:id', async (req, res) => {
  const session = await auditSessionService.getSession(req.params.id);

  assertStaffCanView(session, req.user);

  sendSuccess(res, { message: 'Audit session retrieved', data: session });
});

router.post('/:id/counts', requireRole('staff'), async (req, res) => {
  const payload = auditSessionValidator.submitCounts(req.body);

  const session = await auditSessionService.submitCounts(req.params.id, payload, req.user);

  sendSuccess(res, { message: 'Counts submitted for review', data: session });
});

router.post('/:id/approve', requireRole('manager'), async (req, res) => {
  const session = await auditSessionService.approveSession(req.params.id, req.user);

  sendSuccess(res, {
    statusCode: 202,
    message: 'Approval accepted, reconciliation is running in the background',
    data: session
  });
});

router.post('/:id/reject', requireRole('manager'), async (req, res) => {
  const payload = auditSessionValidator.reject(req.body);

  const session = await auditSessionService.rejectSession(req.params.id, payload, req.user);

  sendSuccess(res, { message: 'Audit session rejected', data: session });
});

module.exports = router;
