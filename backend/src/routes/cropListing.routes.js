const express = require('express');
const cropListingController = require('../controllers/cropListingController');
const {
  cropListingCreateSchema,
  cropListingUpdateSchema,
  paginationQuerySchema,
  validateBody,
  validateQuery,
} = require('../utils/validate');

const router = express.Router();

// POST /api/crop-listings
router.post('/', validateBody(cropListingCreateSchema), cropListingController.create);
// GET /api/crop-listings?page=1&limit=20
router.get('/', validateQuery(paginationQuerySchema), cropListingController.list);
// GET /api/crop-listings/:id
router.get('/:id', cropListingController.getById);
// PATCH /api/crop-listings/:id
router.patch('/:id', validateBody(cropListingUpdateSchema), cropListingController.update);
// DELETE /api/crop-listings/:id
router.delete('/:id', cropListingController.remove);

module.exports = router;
