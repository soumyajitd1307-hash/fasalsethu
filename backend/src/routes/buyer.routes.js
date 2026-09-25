const express = require('express');
const buyerController = require('../controllers/buyerController');
const {
  validateBody,
  validateQuery,
  buyerCreateSchema,
  buyerUpdateSchema,
  paginationQuerySchema,
} = require('../utils/validate');

const router = express.Router();

router.post('/', validateBody(buyerCreateSchema), buyerController.create);
router.get('/', validateQuery(paginationQuerySchema), buyerController.list);
router.get('/:id', buyerController.getById);
router.patch('/:id', validateBody(buyerUpdateSchema), buyerController.update);
router.delete('/:id', buyerController.remove);

module.exports = router;
