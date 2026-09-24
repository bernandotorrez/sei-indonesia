const BadRequestError = require('../exceptions/BadRequestError');

function throwIfInvalid(schema, payload) {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message.replace(/"/g, '')
    }));
    throw new BadRequestError('Validation failed', details);
  }

  return value;
}

module.exports = { throwIfInvalid };
