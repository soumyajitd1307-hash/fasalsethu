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
const authRoutes = require('./routes/auth.routes');
const jwksRoutes = require('./routes/jwks.routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// The service runs behind one reverse proxy, so the client address has to be
// derived from the forwarded chain for per-client rate limiting to mean
// anything — without this every request would appear to come from the proxy
// itself and share one global counter. See parseTrustProxy in config/env.js
// for why exactly one hop is trusted, and TRUST_PROXY to override it.
app.set('trust proxy', env.trustProxy);

app.use(
  cors({
    // An explicit allowlist of exact origins, never '*'. The auth flow sends a
    // Bearer token and uses credentials, and a wildcard is invalid alongside
    // them, so each matching origin is echoed back individually.
    origin: env.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Content-Type carries the JSON body; Authorization carries the access
    // token on protected routes.
    allowedHeaders: ['Content-Type', 'Authorization'],
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
// First-party credential login. Unauthenticated by necessity: it is the
// endpoint that issues the Bearer token. It sits alongside the other /api
// routers and is unaffected by them.
app.use('/api/auth', authRoutes);

// Public JWKS document for first-party RS256 tokens. It resolves at the origin
// root (<issuer>/.well-known/jwks.json) rather than under /api, so it must be
// registered BEFORE the API not-found handler. Public keys only: no token is
// issued here and no private material can leave the process.
app.use('/.well-known', jwksRoutes);

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
