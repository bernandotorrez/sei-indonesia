const express = require('express');
const router = express.Router();

const authService = require('../../services/authService');
const authValidator = require('../../validators/authValidator');
const auth = require('../../middleware/auth');
const { loginRateLimiter } = require('../../middleware/rateLimit');
const { sendSuccess } = require('../../utils/response');

router.post('/login', loginRateLimiter, async (req, res) => {
  const payload = authValidator.login(req.body);

  const result = await authService.login(payload, req);

  sendSuccess(res, { message: 'Login successful', data: result });
});

router.get('/me', auth, async (req, res) => {
  const user = await authService.me(req.user.id);

  sendSuccess(res, { message: 'Current user', data: user });
});

module.exports = router;
