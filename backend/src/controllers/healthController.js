const { getDatabaseStatus } = require('../services/dbService');

async function getHealth(req, res, next) {
  try {
    const database = await getDatabaseStatus();
    res.json({
      status: 'ok',
      message: 'FasalSethu backend is running',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      database,
    });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

module.exports = { getHealth };
