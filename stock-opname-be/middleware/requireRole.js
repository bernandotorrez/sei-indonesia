const ForbiddenError = require('../exceptions/ForbiddenError');

function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(`This action requires one of the following roles: ${allowedRoles.join(', ')}`);
    }
    next();
  };
}

module.exports = requireRole;
