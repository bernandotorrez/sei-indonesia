function sendSuccess(res, { statusCode = 200, message = 'Success', data = null } = {}) {
  return res.status(statusCode).json({
    code: statusCode,
    success: true,
    message,
    data
  });
}

module.exports = { sendSuccess };
