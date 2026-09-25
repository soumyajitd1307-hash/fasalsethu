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
};
