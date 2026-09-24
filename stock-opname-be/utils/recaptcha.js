const BadRequestError = require('../exceptions/BadRequestError');
const logger = require('./logger');

let warnedOnce = false;

// Verifies a Google reCAPTCHA v3 token. Deliberately a no-op (with a one-time warning) when
// RECAPTCHA_SECRET_KEY isn't set, so local dev and the test suite work before the real key is
// dropped into .env - the moment that env var is set, verification activates automatically.
//
// Test mode always bypasses this, even if a real key happens to be present in .env (the same
// shared file dev also reads) - tests shouldn't depend on a live call to Google's API, and
// don't have a real token to send anyway.
async function verifyRecaptcha(token, req) {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey || process.env.NODE_ENV === 'test') {
    if (!warnedOnce) {
      logger.warn('reCAPTCHA verification is disabled (no RECAPTCHA_SECRET_KEY, or running in test mode)');
      warnedOnce = true;
    }
    return;
  }

  if (!token) {
    throw new BadRequestError('Missing reCAPTCHA token');
  }

  const params = new URLSearchParams({ secret: secretKey, response: token });
  if (req?.ip) {
    params.append('remoteip', req.ip);
  }

  let result;
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    result = await response.json();
  } catch (error) {
    logger.error(`reCAPTCHA verification request failed: ${error.message}`);
    throw new BadRequestError('Could not verify reCAPTCHA, please try again');
  }

  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE) || 0.5;

  if (!result.success || (typeof result.score === 'number' && result.score < minScore)) {
    throw new BadRequestError('reCAPTCHA verification failed');
  }
}

module.exports = { verifyRecaptcha };
