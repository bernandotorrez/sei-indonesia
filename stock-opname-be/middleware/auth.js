const { verifyToken } = require('../utils/jwt');
const UnauthorizedError = require('../exceptions/UnauthorizedError');

function auth(req, res, next) {
  const token = req.token;

  if (!token) {
    throw new UnauthorizedError('Missing bearer token');
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role, name: payload.name, email: payload.email };
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

module.exports = auth;
