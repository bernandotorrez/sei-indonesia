const bcrypt = require('bcryptjs');
const { User } = require('../models');
const NotFoundError = require('../exceptions/NotFoundError');
const ConflictError = require('../exceptions/ConflictError');

class UserRepository {
  constructor() {
    this._model = User;
  }

  findByEmail(email) {
    return this._model.findOne({ where: { email } });
  }

  findById(id) {
    return this._model.findByPk(id);
  }

  async getByIdOrFail(id) {
    const user = await this._model.findByPk(id);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  listStaff() {
    return this._model.findAll({ where: { role: 'staff', is_active: true }, order: [['name', 'ASC']] });
  }

  list() {
    return this._model.findAll({ order: [['createdAt', 'DESC']] });
  }

  async create({ name, email, password, role }) {
    const existing = await this._model.findOne({ where: { email } });

    if (existing) {
      throw new ConflictError(`Email "${email}" is already in use`);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    return this._model.create({ name, email, password_hash: passwordHash, role });
  }

  async update(id, changes) {
    const user = await this.getByIdOrFail(id);

    if (changes.name !== undefined) user.name = changes.name;
    if (changes.role !== undefined) user.role = changes.role;
    if (changes.isActive !== undefined) user.is_active = changes.isActive;
    if (changes.password) {
      user.password_hash = await bcrypt.hash(changes.password, 10);
    }

    await user.save();

    return user;
  }

  async unlock(id) {
    const user = await this.getByIdOrFail(id);

    user.failed_login_attempts = 0;
    user.locked_until = null;
    await user.save();

    return user;
  }
}

module.exports = new UserRepository();
