const express = require('express');
const router = express.Router();

const auth = require('../../middleware/auth');
const authRoute = require('./authRoute');
const productRoute = require('./productRoute');
const auditSessionRoute = require('./auditSessionRoute');
const userRoute = require('./userRoute');
const auditLogRoute = require('./auditLogRoute');

router.use('/auth', authRoute);
router.use('/products', auth, productRoute);
router.use('/audit-sessions', auth, auditSessionRoute);
router.use('/users', auth, userRoute);
router.use('/audit-logs', auth, auditLogRoute);

module.exports = router;
