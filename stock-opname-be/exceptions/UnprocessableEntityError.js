const ClientError = require('./ClientError');

class UnprocessableEntityError extends ClientError {
  constructor(message) {
    super(message, 422);
    this.name = 'UnprocessableEntityError';
  }
}

module.exports = UnprocessableEntityError;
