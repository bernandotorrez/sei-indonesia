const Joi = require('joi');
const { throwIfInvalid } = require('../utils/validationError');

const ROLES = ['staff', 'manager', 'admin'];

const createSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid(...ROLES).required()
});

const updateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  role: Joi.string().valid(...ROLES),
  isActive: Joi.boolean(),
  password: Joi.string().min(8)
}).min(1);

function create(payload) {
  return throwIfInvalid(createSchema, payload);
}

function update(payload) {
  return throwIfInvalid(updateSchema, payload);
}

module.exports = { create, update };
