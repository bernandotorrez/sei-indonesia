const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const auditLogService = require('./auditLogService');
const { verifyRecaptcha } = require('../utils/recaptcha');
const { signToken } = require('../utils/jwt');
const UnauthorizedError = require('../exceptions/UnauthorizedError');
const LockedError = require('../exceptions/LockedError');

const MAX_FAILED_ATTEMPTS = Number(process.env.ACCOUNT_LOCKOUT_MAX_ATTEMPTS) || 3;
const LOCKOUT_MINUTES = Number(process.env.ACCOUNT_LOCKOUT_MINUTES) || 15;

async function login({ email, password, recaptchaToken }, req) {
  try {
    await verifyRecaptcha(recaptchaToken, req);
  } catch (error) {
    await auditLogService.recordSafely({
      actorEmail: email,
      action: 'AUTH_RECAPTCHA_FAILED',
      req
    });
    throw error;
  }

  const user = await userRepository.findByEmail(email);

  if (!user || !user.is_active) {
    await auditLogService.recordSafely({
      actorEmail: email,
      action: 'AUTH_LOGIN_FAILED',
      metadata: { reason: !user ? 'unknown_email' : 'inactive_user' },
      req
    });
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await auditLogService.recordSafely({
      actorId: user.id,
      actorEmail: user.email,
      action: 'AUTH_LOGIN_BLOCKED',
      metadata: { lockedUntil: user.locked_until },
      req
    });
    throw new LockedError(`Account temporarily locked due to too many failed attempts. Try again after ${new Date(user.locked_until).toLocaleTimeString()}.`);
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    await user.increment('failed_login_attempts');
    await user.reload();

    const isNowLocked = user.failed_login_attempts >= MAX_FAILED_ATTEMPTS;

    if (isNowLocked) {
      user.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      await user.save();
    }

    await auditLogService.recordSafely({
      actorId: user.id,
      actorEmail: user.email,
      action: isNowLocked ? 'AUTH_ACCOUNT_LOCKED' : 'AUTH_LOGIN_FAILED',
      metadata: {
        reason: 'wrong_password',
        attempts: user.failed_login_attempts,
        ...(isNowLocked ? { lockedUntil: user.locked_until, lockoutMinutes: LOCKOUT_MINUTES } : {})
      },
      req
    });

    if (isNowLocked) {
      throw new LockedError(`Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`);
    }
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.failed_login_attempts > 0 || user.locked_until) {
    user.failed_login_attempts = 0;
    user.locked_until = null;
    await user.save();
  }

  const token = signToken({ sub: user.id, role: user.role, name: user.name, email: user.email });

  await auditLogService.recordSafely({
    actorId: user.id,
    actorEmail: user.email,
    action: 'AUTH_LOGIN_SUCCESS',
    entityType: 'User',
    entityId: user.id,
    req
  });

  return { token, user: user.toSafeJSON() };
}

async function me(userId) {
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new UnauthorizedError('User no longer exists');
  }

  return user.toSafeJSON();
}

module.exports = { login, me };
