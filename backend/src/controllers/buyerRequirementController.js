// BuyerRequirement controller — thin layer over buyerRequirementService (B2 Step 2).
const buyerRequirementService = require('../services/buyerRequirementService');

async function create(req, res, next) {
  try {
    const requirement = await buyerRequirementService.createBuyerRequirement(req.body);
    res.status(201).json({ success: true, data: requirement });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function list(req, res, next) {
  try {
    const { data, pagination } = await buyerRequirementService.getAllBuyerRequirements(req.query);
    res.json({ success: true, data, pagination });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function getById(req, res, next) {
  try {
    const requirement = await buyerRequirementService.getBuyerRequirementById(req.params.id);
    res.json({ success: true, data: requirement });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function update(req, res, next) {
  try {
    const requirement = await buyerRequirementService.updateBuyerRequirement(req.params.id, req.body);
    res.json({ success: true, data: requirement });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function remove(req, res, next) {
  try {
    const requirement = await buyerRequirementService.deleteBuyerRequirement(req.params.id);
    res.json({ success: true, data: requirement });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

module.exports = { create, list, getById, update, remove };
