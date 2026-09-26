// Buyer controller — thin layer over buyerService (B2 Step 2).
const buyerService = require('../services/buyerService');

async function create(req, res, next) {
  try {
    const buyer = await buyerService.createBuyer(req.body);
    res.status(201).json({ success: true, data: buyer });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function list(req, res, next) {
  try {
    const { data, pagination } = await buyerService.getAllBuyers(req.query);
    res.json({ success: true, data, pagination });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function getById(req, res, next) {
  try {
    const buyer = await buyerService.getBuyerById(req.params.id);
    res.json({ success: true, data: buyer });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function update(req, res, next) {
  try {
    const buyer = await buyerService.updateBuyer(req.params.id, req.body);
    res.json({ success: true, data: buyer });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function remove(req, res, next) {
  try {
    const buyer = await buyerService.deleteBuyer(req.params.id);
    res.json({ success: true, data: buyer });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

module.exports = { create, list, getById, update, remove };
