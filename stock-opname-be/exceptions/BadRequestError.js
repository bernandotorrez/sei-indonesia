const ClientError = require('./ClientError');

class BadRequestError extends ClientError {
  constructor(message, details = null) {
    super(message, 400, details);
    this.name = 'BadRequestError';
  }
}

module.exports = BadRequestError;
