// PrismaClient singleton + connectivity check.
// Does NOT throw at import time so the server can boot without a DB.
const { PrismaClient } = require('@prisma/client');
const env = require('./env');

let prisma = null;

function getPrisma() {
  if (!env.databaseUrl) return null;
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

async function checkConnection(timeoutMs = 3000) {
  const client = getPrisma();
  if (!client) {
    return { configured: false, connected: false, reason: 'DATABASE_URL not set' };
  }
  const started = Date.now();
  try {
    const result = await Promise.race([
      client.$queryRaw`SELECT 1 AS ok`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('database ping timed out')), timeoutMs)
      ),
    ]);
    void result;
    return { configured: true, connected: true, latencyMs: Date.now() - started };
  } catch (err) {
    return { configured: true, connected: false, reason: err.message };
  }
}

async function disconnect() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

module.exports = { getPrisma, checkConnection, disconnect };
