/**
 * Deal Routes (B3 Task)
 */

const express = require('express');
const dealController = require('../controllers/dealController');
const {
  dealCreateSchema,
  dealStatusUpdateSchema,
  dealCancelSchema,
  dealQuerySchema,
  validateBody,
  validateQuery,
} = require('../utils/validate');
const { requireAuth, authorizeDealAccess } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// Summary endpoint
// GET /api/deals/summary?farmerId=... or ?buyerId=...
router.get('/summary', dealController.getSummary);

// Farmer deal history
// GET /api/deals/farmer/:farmerId
router.get('/farmer/:farmerId', authorizeDealAccess, validateQuery(dealQuerySchema), dealController.getFarmerDeals);

// Buyer deal history
// GET /api/deals/buyer/:buyerId
router.get('/buyer/:buyerId', authorizeDealAccess, validateQuery(dealQuerySchema), dealController.getBuyerDeals);

// Deal CRUD & Status transitions
// POST /api/deals
router.post('/', validateBody(dealCreateSchema), dealController.create);

// GET /api/deals
router.get('/', validateQuery(dealQuerySchema), dealController.list);

// GET /api/deals/:id
router.get('/:id', dealController.getById);

// PATCH /api/deals/:id/status
router.patch('/:id/status', validateBody(dealStatusUpdateSchema), dealController.updateStatus);

// PATCH /api/deals/:id/cancel
router.patch('/:id/cancel', validateBody(dealCancelSchema), dealController.cancel);

module.exports = router;
