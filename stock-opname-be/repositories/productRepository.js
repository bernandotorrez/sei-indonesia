const { Op } = require('sequelize');
const { Product } = require('../models');
const NotFoundError = require('../exceptions/NotFoundError');
const ConflictError = require('../exceptions/ConflictError');

class ProductRepository {
  constructor() {
    this._model = Product;
  }

  list({ search } = {}) {
    const where = {};

    if (search) {
      where[Op.or] = [
        { sku: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } }
      ];
    }

    return this._model.findAll({ where, order: [['sku', 'ASC']] });
  }

  async findById(id) {
    const product = await this._model.findByPk(id);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return product;
  }

  findByIds(ids) {
    return this._model.findAll({ where: { id: { [Op.in]: ids } } });
  }

  async create({ sku, name, onHandQty }) {
    const existing = await this._model.findOne({ where: { sku } });

    if (existing) {
      throw new ConflictError(`SKU "${sku}" already exists`);
    }

    return this._model.create({ sku, name, on_hand_qty: onHandQty ?? 0 });
  }

  async update(id, changes) {
    const product = await this.findById(id);

    if (changes.name !== undefined) product.name = changes.name;
    if (changes.isActive !== undefined) product.is_active = changes.isActive;

    await product.save();

    return product;
  }
}

module.exports = new ProductRepository();
