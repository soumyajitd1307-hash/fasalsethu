// Central environment configuration. Never commit real secrets.
require('dotenv').config();

function parseOrigins(value, fallback) {
  const raw = value || fallback;
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8000),
  databaseUrl: process.env.DATABASE_URL || null,
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN, 'http://localhost:5173'),
  // Auth0 JWT issuer base URL (e.g. https://TENANT.us.auth0.com/). Null when
  // unset — protected routes then fail closed with 503. Never hardcode tenants.
  auth0Issuer: process.env.AUTH0_ISSUER_BASE_URL || null,
  auth0Audience: process.env.AUTH0_AUDIENCE || null,
};
