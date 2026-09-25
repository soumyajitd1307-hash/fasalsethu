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
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'FasalSethu API — see GET /api/health',
  });
});

app.use('/api/health', healthRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/crop-listings', cropListingRoutes);
app.use('/api/market-prices', marketPriceRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/buyer-requirements', buyerRequirementRoutes);
app.use('/api/price-discovery', priceDiscoveryRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/notifications', notificationRoutes);

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
