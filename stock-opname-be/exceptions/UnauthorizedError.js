const ClientError = require('./ClientError');

class UnauthorizedError extends ClientError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

module.exports = UnauthorizedError;
