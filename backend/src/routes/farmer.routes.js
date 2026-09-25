const express = require('express');
const farmerController = require('../controllers/farmerController');
const { requireAuth } = require('../middleware/auth');
const {
  farmerCreateSchema,
  farmerUpdateSchema,
  paginationQuerySchema,
  validateBody,
  validateQuery,
} = require('../utils/validate');

const router = express.Router();

// POST /api/farmers — requires authentication
router.post('/', requireAuth, validateBody(farmerCreateSchema), farmerController.create);
// GET /api/farmers?page=1&limit=20 — public
router.get('/', validateQuery(paginationQuerySchema), farmerController.list);
// GET /api/farmers/:id — public
router.get('/:id', farmerController.getById);
// PATCH /api/farmers/:id — requires authentication
router.patch('/:id', requireAuth, validateBody(farmerUpdateSchema), farmerController.update);
// DELETE /api/farmers/:id — requires authentication
router.delete('/:id', requireAuth, farmerController.remove);

module.exports = router;
