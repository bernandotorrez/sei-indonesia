require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bearerToken = require('express-bearer-token');

const routesV1 = require('./routes/v1');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bearerToken());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/v1', routesV1);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Stock Opname API listening on port ${PORT}`);
  });
}

module.exports = app;
