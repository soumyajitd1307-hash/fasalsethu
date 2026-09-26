const express = require('express');
const buyerRequirementController = require('../controllers/buyerRequirementController');
const {
  validateBody,
  validateQuery,
  buyerRequirementCreateSchema,
  buyerRequirementUpdateSchema,
  paginationQuerySchema,
} = require('../utils/validate');

const router = express.Router();

router.post('/', validateBody(buyerRequirementCreateSchema), buyerRequirementController.create);
router.get('/', validateQuery(paginationQuerySchema), buyerRequirementController.list);
router.get('/:id', buyerRequirementController.getById);
router.patch('/:id', validateBody(buyerRequirementUpdateSchema), buyerRequirementController.update);
router.delete('/:id', buyerRequirementController.remove);

module.exports = router;
