// Thin DB service used by health checks (and future controllers).
const { checkConnection } = require('../config/database');

async function getDatabaseStatus() {
  return checkConnection();
}

module.exports = { getDatabaseStatus };
