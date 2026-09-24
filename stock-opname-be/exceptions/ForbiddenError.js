const ClientError = require('./ClientError');

class ForbiddenError extends ClientError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

module.exports = ForbiddenError;
