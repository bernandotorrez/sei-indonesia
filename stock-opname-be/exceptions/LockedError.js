const ClientError = require('./ClientError');

class LockedError extends ClientError {
  constructor(message) {
    super(message, 423);
    this.name = 'LockedError';
  }
}

module.exports = LockedError;
