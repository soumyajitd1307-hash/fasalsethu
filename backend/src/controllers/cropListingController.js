// Crop Listing controller — thin layer over cropListingService (B1 Task 3).
const cropListingService = require('../services/cropListingService');

async function create(req, res, next) {
  try {
    const listing = await cropListingService.createCropListing(req.body);
    res.status(201).json({ success: true, data: listing });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function list(req, res, next) {
  try {
    const { data, pagination } = await cropListingService.getAllCropListings(req.query);
    res.json({ success: true, data, pagination });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function getById(req, res, next) {
  try {
    const listing = await cropListingService.getCropListingById(req.params.id);
    res.json({ success: true, data: listing });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function update(req, res, next) {
  try {
    const listing = await cropListingService.updateCropListing(req.params.id, req.body);
    res.json({ success: true, data: listing });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

async function remove(req, res, next) {
  try {
    const listing = await cropListingService.deleteCropListing(req.params.id);
    res.json({ success: true, data: listing });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

module.exports = { create, list, getById, update, remove };
