const express = require('express');
const router = express.Router();

const productRepository = require('../../repositories/productRepository');
const productValidator = require('../../validators/productValidator');
const requireRole = require('../../middleware/requireRole');
const auditLogService = require('../../services/auditLogService');
const { sendSuccess } = require('../../utils/response');

router.get('/', async (req, res) => {
  const { search } = req.query;

  const products = await productRepository.list({ search });

  sendSuccess(res, { message: 'Products retrieved', data: products });
});

router.post('/', requireRole('manager'), async (req, res) => {
  const payload = productValidator.create(req.body);

  const product = await productRepository.create(payload);

  await auditLogService.recordSafely({
    actorId: req.user.id,
    actorEmail: req.user.email,
    action: 'PRODUCT_CREATED',
    entityType: 'Product',
    entityId: product.id,
    metadata: { sku: product.sku, name: product.name, onHandQty: product.on_hand_qty },
    req
  });

  sendSuccess(res, { statusCode: 201, message: 'Product created', data: product });
});

router.patch('/:id', requireRole('manager'), async (req, res) => {
  const payload = productValidator.update(req.body);

  const before = await productRepository.findById(req.params.id);
  const beforeSnapshot = { name: before.name, isActive: before.is_active };

  const product = await productRepository.update(req.params.id, payload);

  await auditLogService.recordSafely({
    actorId: req.user.id,
    actorEmail: req.user.email,
    action: 'PRODUCT_UPDATED',
    entityType: 'Product',
    entityId: product.id,
    metadata: { before: beforeSnapshot, after: { name: product.name, isActive: product.is_active } },
    req
  });

  sendSuccess(res, { message: 'Product updated', data: product });
});

module.exports = router;
