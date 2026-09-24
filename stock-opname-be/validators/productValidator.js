const Joi = require('joi');
const { throwIfInvalid } = require('../utils/validationError');

const createSchema = Joi.object({
  sku: Joi.string().trim().min(2).max(60).required(),
  name: Joi.string().trim().min(2).max(200).required(),
  onHandQty: Joi.number().integer().min(0).default(0)
});

const updateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200),
  isActive: Joi.boolean()
}).min(1);

function create(payload) {
  return throwIfInvalid(createSchema, payload);
}

function update(payload) {
  return throwIfInvalid(updateSchema, payload);
}

module.exports = { create, update };
