const Joi = require('joi');
const { throwIfInvalid } = require('../utils/validationError');

const initiateSchema = Joi.object({
  productIds: Joi.array().items(Joi.string().uuid()).min(1).unique().required(),
  assignedStaffId: Joi.string().uuid().required()
});

const submitCountsSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      productId: Joi.string().uuid().required(),
      countedQty: Joi.number().integer().min(0).required()
    })
  ).min(1).unique('productId').required()
});

const rejectSchema = Joi.object({
  note: Joi.string().trim().min(3).max(1000).required()
});

function initiate(payload) {
  return throwIfInvalid(initiateSchema, payload);
}

function submitCounts(payload) {
  return throwIfInvalid(submitCountsSchema, payload);
}

function reject(payload) {
  return throwIfInvalid(rejectSchema, payload);
}

module.exports = { initiate, submitCounts, reject };
