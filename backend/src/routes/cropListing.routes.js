const express = require('express');
const cropListingController = require('../controllers/cropListingController');
const { requireAuth } = require('../middleware/auth');
const {
  cropListingCreateSchema,
  cropListingUpdateSchema,
  paginationQuerySchema,
  validateBody,
  validateQuery,
} = require('../utils/validate');

const router = express.Router();

// POST /api/crop-listings — requires authentication
router.post('/', requireAuth, validateBody(cropListingCreateSchema), cropListingController.create);
// GET /api/crop-listings?page=1&limit=20 — public
router.get('/', validateQuery(paginationQuerySchema), cropListingController.list);
// GET /api/crop-listings/:id — public
router.get('/:id', cropListingController.getById);
// PATCH /api/crop-listings/:id — requires authentication
router.patch('/:id', requireAuth, validateBody(cropListingUpdateSchema), cropListingController.update);
// DELETE /api/crop-listings/:id — requires authentication
router.delete('/:id', requireAuth, cropListingController.remove);

module.exports = router;
