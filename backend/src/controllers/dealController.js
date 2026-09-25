/**
 * Deal Controller (B3 Task)
 * 
 * Thin controller layer over dealService.
 * Enforces validation, authorization, and standard JSON response envelopes.
 */

const dealService = require('../services/dealService');
const { authorizeDealParticipant } = require('../middleware/auth');

async function create(req, res, next) {
  try {
    const deal = await dealService.createDeal(req.body, req.user);
    return res.status(201).json({
      success: true,
      data: deal,
    });
  } catch (err) {
    return next(err);
  }
}

async function list(req, res, next) {
  try {
    const result = await dealService.getAllDeals(req.query);
    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const deal = await dealService.getDealById(req.params.id);
    if (req.user) {
      authorizeDealParticipant(deal, req.user);
    }
    return res.json({
      success: true,
      data: deal,
    });
  } catch (err) {
    return next(err);
  }
}

async function getFarmerDeals(req, res, next) {
  try {
    const farmerId = req.params.farmerId;
    const result = await dealService.getFarmerDeals(farmerId, req.query);
    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    return next(err);
  }
}

async function getBuyerDeals(req, res, next) {
  try {
    const buyerId = req.params.buyerId;
    const result = await dealService.getBuyerDeals(buyerId, req.query);
    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    return next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const deal = await dealService.getDealById(req.params.id);
    if (req.user) {
      authorizeDealParticipant(deal, req.user);
    }
    const updated = await dealService.updateDealStatus(req.params.id, req.body.status, req.user);
    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const deal = await dealService.getDealById(req.params.id);
    if (req.user) {
      authorizeDealParticipant(deal, req.user);
    }
    const cancelled = await dealService.cancelDeal(req.params.id, req.body.reason, req.user);
    return res.json({
      success: true,
      data: cancelled,
    });
  } catch (err) {
    return next(err);
  }
}

async function getSummary(req, res, next) {
  try {
    const { farmerId, buyerId } = req.query;
    const summary = await dealService.getDealsSummary({ farmerId, buyerId });
    return res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  create,
  list,
  getById,
  getFarmerDeals,
  getBuyerDeals,
  updateStatus,
  cancel,
  getSummary,
};
