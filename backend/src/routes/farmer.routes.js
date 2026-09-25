const express = require('express');
const farmerController = require('../controllers/farmerController');
const {
  farmerCreateSchema,
  farmerUpdateSchema,
  paginationQuerySchema,
  validateBody,
  validateQuery,
} = require('../utils/validate');

const router = express.Router();

// POST /api/farmers
router.post('/', validateBody(farmerCreateSchema), farmerController.create);
// GET /api/farmers?page=1&limit=20
router.get('/', validateQuery(paginationQuerySchema), farmerController.list);
// GET /api/farmers/:id
router.get('/:id', farmerController.getById);
// PATCH /api/farmers/:id
router.patch('/:id', validateBody(farmerUpdateSchema), farmerController.update);
// DELETE /api/farmers/:id
router.delete('/:id', farmerController.remove);

module.exports = router;
