const app = require('./app');
const env = require('./config/env');
const { disconnect } = require('./config/database');

const server = app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`FasalSethu backend listening on port ${env.port} (${env.nodeEnv})`);
  // eslint-disable-next-line no-console
  console.log(`Health check: http://localhost:${env.port}/api/health`);
});

async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}, shutting down...`);
  server.close(async () => {
    await disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;
