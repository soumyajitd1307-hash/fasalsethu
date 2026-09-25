const express = require('express');
const marketPriceController = require('../controllers/marketPriceController');
const {
  marketPriceQuerySchema,
  marketPriceContextSchema,
  validateQuery,
} = require('../utils/validate');

const router = express.Router();

// GET /api/market-prices?commodity=&variety=&state=&district=&market=&date=&dateFrom=&dateTo=&page=&limit=
router.get('/', validateQuery(marketPriceQuerySchema), marketPriceController.list);
// GET /api/market-prices/context?commodity=&state=&district=&market=&limit=
router.get('/context', validateQuery(marketPriceContextSchema), marketPriceController.context);

module.exports = router;
