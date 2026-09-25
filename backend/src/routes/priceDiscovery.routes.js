const express = require('express');
const priceDiscoveryController = require('../controllers/priceDiscoveryController');

const router = express.Router();

router.get('/:cropListingId', priceDiscoveryController.getPriceDiscovery);

module.exports = router;
