class ClientError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'ClientError';
  }
}

module.exports = ClientError;
