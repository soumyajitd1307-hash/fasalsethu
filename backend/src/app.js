const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const farmerRoutes = require('./routes/farmer.routes');
const cropListingRoutes = require('./routes/cropListing.routes');
const marketPriceRoutes = require('./routes/marketPrice.routes');
const buyerRoutes = require('./routes/buyer.routes');
const buyerRequirementRoutes = require('./routes/buyerRequirement.routes');
const priceDiscoveryRoutes = require('./routes/priceDiscovery.routes');
const matchingRoutes = require('./routes/matching.routes');
const dealRoutes = require('./routes/deal.routes');
const notificationRoutes = require('./routes/notification.routes');

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
