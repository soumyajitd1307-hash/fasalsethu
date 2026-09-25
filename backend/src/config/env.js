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
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN, 'http://localhost:5173,http://localhost:5174'),
  auth0Domain: process.env.AUTH0_DOMAIN || 'dev-2eoy6ktvcv4a3nbp.us.auth0.com',
  auth0Audience: process.env.AUTH0_AUDIENCE || null,
  auth0IssuerBaseUrl: process.env.AUTH0_ISSUER_BASE_URL || `https://${process.env.AUTH0_DOMAIN || 'dev-2eoy6ktvcv4a3nbp.us.auth0.com'}/`,
};
