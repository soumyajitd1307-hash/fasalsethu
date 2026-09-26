const express = require('express');
const matchingController = require('../controllers/matchingController');

const router = express.Router();

router.get('/crop-listings/:cropListingId', matchingController.getMatchesForCropListing);

module.exports = router;
