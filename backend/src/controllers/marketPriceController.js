// Market-price controller — thin layer over marketPriceService (B1 Task 4).
const marketPriceService = require('../services/marketPriceService');

async function list(req, res, next) {
  try {
    const { data, pagination } = await marketPriceService.listMarketPrices(req.query);
    res.json({ success: true, data, pagination });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function context(req, res, next) {
  try {
    const result = await marketPriceService.getMarketContext(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

module.exports = { list, context };
