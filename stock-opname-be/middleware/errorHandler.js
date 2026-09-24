const ClientError = require('../exceptions/ClientError');
const logger = require('../utils/logger');

function notFoundHandler(req, res) {
  res.status(404).json({
    code: 404,
    success: false,
    message: 'Route not found',
    data: null
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ClientError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { stack: err.stack, path: req.originalUrl });
    }

    return res.status(err.statusCode).json({
      code: err.statusCode,
      success: false,
      message: err.message,
      data: err.details || null
    });
  }

  logger.error(err.message, { stack: err.stack, path: req.originalUrl });

  return res.status(500).json({
    code: 500,
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    data: null
  });
}

module.exports = { notFoundHandler, errorHandler };
