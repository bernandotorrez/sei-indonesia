const Joi = require('joi');
const { throwIfInvalid } = require('../utils/validationError');

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(6).required(),
  // Optional at the schema level: verifyRecaptcha() itself decides whether a token is required,
  // based on whether RECAPTCHA_SECRET_KEY is configured.
  recaptchaToken: Joi.string().allow('', null)
});

function login(payload) {
  return throwIfInvalid(loginSchema, payload);
}

module.exports = { login };
