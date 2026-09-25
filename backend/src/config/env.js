// Central environment configuration. Never commit real secrets.
const path = require('path');

// Load .env from the backend root (backend/.env) rather than the current
// working directory, so the server, Prisma CLI and nodemon all read the same
// file no matter where the process was started from. A missing .env is not an
// error: real environment variables always win, and the app boots without a DB.
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

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
