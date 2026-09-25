// Farmer controller — thin layer over farmerService (B1 Task 2).
const farmerService = require('../services/farmerService');

async function create(req, res, next) {
  try {
    const farmer = await farmerService.createFarmer(req.body);
    res.status(201).json({ success: true, data: farmer });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function list(req, res, next) {
  try {
    const { data, pagination } = await farmerService.getAllFarmers(req.query);
    res.json({ success: true, data, pagination });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function getById(req, res, next) {
  try {
    const farmer = await farmerService.getFarmerById(req.params.id);
    res.json({ success: true, data: farmer });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function update(req, res, next) {
  try {
    const farmer = await farmerService.updateFarmer(req.params.id, req.body);
    res.json({ success: true, data: farmer });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function remove(req, res, next) {
  try {
    const farmer = await farmerService.deleteFarmer(req.params.id);
    res.json({ success: true, data: farmer });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

module.exports = { create, list, getById, update, remove };
