const rateLimit = require('express-rate-limit');

// A real integration test suite legitimately makes far more than 10 login calls per run (many
// tests each log in as several different users) from what express-rate-limit sees as a single
// IP. Rather than mock this middleware out of the test app, test mode always uses a high limit,
// regardless of whatever LOGIN_RATE_LIMIT_MAX happens to be set to in the shared .env file -
// production/dev are the only environments the configured/default value should apply to.
const loginLimit = process.env.NODE_ENV === 'test'
  ? 1000
  : (Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10);

// Throttles login attempts per client IP, independent of the per-account lockout in
// authService. This one guards against a single attacker spraying many different emails;
// the account lockout guards a single account against many passwords being tried.
const loginRateLimiter = rateLimit({
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  limit: loginLimit,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      code: 429,
      success: false,
      message: 'Too many login attempts from this network. Please try again later.',
      data: null
    });
  }
});

module.exports = { loginRateLimiter };
