/**
 * POST /api/auth/logout integration tests against a real PostgreSQL database.
 *
 * PostgreSQL-only, so this follows the same SKIP_DB convention as the other
 * integration suites: with no DATABASE_URL it reports as BLOCKED rather than
 * passing vacuously.
 *
 * This is the authoritative check that a set-based `updateMany` really does
 * revoke an ENTIRE family against the real database, and that the conditional
 * claim serializes concurrent logouts under PostgreSQL.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const nodeCrypto = require('node:crypto');

const { hashRefreshToken, generateRefreshToken } = require('../src/auth/refreshToken');
const { normalizeIdentifier } = require('../src/auth/identifier');
const { hashPassword } = require('../src/auth/password');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const HAVE_DB = !!process.env.DATABASE_URL;
const SKIP_DB = HAVE_DB ? false : 'BLOCKED: DATABASE_URL not set — needs local PostgreSQL';

// This suite issues many authentication requests from a single address, so the
// production rate-limit budget would throttle it. The limiter's own behaviour
// is covered by tests/unit.rateLimit.test.js. These overrides must be set
// before config/env is first required.
process.env.AUTH_CREDENTIAL_RATE_LIMIT_MAX = '100000';
process.env.AUTH_TOKEN_RATE_LIMIT_MAX = '100000';

const ISSUER = 'https://api.fasalsethu.test/';
const AUDIENCE = 'fasalsethu-api';
const KID = 'logout-test-key-1';
const TS = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

let app;
let server;
let baseUrl = '';
let prisma;
let testKeys;

const created = { farmers: [], accounts: [], refresh: [] };

function uniquePhone() {
  return `+91${String(10000000 + Math.floor(Math.random() * 89999999)).slice(0, 8)}`;
}

async function seedFarmer() {
  const farmer = await prisma.farmer.create({
    data: {
      name: 'Logout Farmer',
      phone: uniquePhone(),
      email: `lo-${TS}-${created.farmers.length}@example.com`,
      kisanId: `KISAN-LO-${TS}-${created.farmers.length}`,
      district: 'Nashik',
      state: 'Maharashtra',
    },
  });
  created.farmers.push(farmer.id);
  const account = await prisma.authAccount.create({
    data: {
      userId: farmer.id,
      role: 'farmer',
      identifier: farmer.kisanId,
      identifierNormalized: normalizeIdentifier(farmer.kisanId, 'farmer'),
      passwordHash: await hashPassword('a-strong-password'),
    },
  });
  created.accounts.push(account.id);
  return farmer;
}

async function issueRefreshToken({ userId, role = 'farmer', familyId, expiresAt, revokedAt = null }) {
  const raw = generateRefreshToken();
  const row = await prisma.refreshToken.create({
    data: {
      userId,
      role,
      tokenHash: hashRefreshToken(raw),
      familyId: familyId || nodeCrypto.randomUUID(),
      expiresAt: expiresAt || new Date(Date.now() + 86400000),
      revokedAt,
    },
  });
  created.refresh.push(row.id);
  return { raw, row };
}

async function post(pathname, body) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json, text: JSON.stringify(json) };
}

const postLogout = (token) => post('/api/auth/logout', { refresh_token: token });
const postRefresh = (token) => post('/api/auth/refresh', { refresh_token: token });

async function assertGeneric401(response, label) {
  assert.equal(response.status, 401, `${label}: expected 401`);
  assert.equal(response.json.message, 'Invalid refresh token', `${label}: generic message`);
}

before(async () => {
  if (!HAVE_DB) return;
  testKeys = nodeCrypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  process.env.AUTH_PRIVATE_KEY = testKeys.privateKey;
  process.env.AUTH_KEY_ID = KID;
  process.env.AUTH0_ISSUER_BASE_URL = ISSUER;
  process.env.AUTH0_AUDIENCE = AUDIENCE;
  delete process.env.AUTH_TRUSTED_ISSUERS;

  app = require('../src/app');
  prisma = require('../src/config/database').getPrisma();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!HAVE_DB) return;
  try {
    if (created.refresh.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { id: { in: created.refresh } } });
    }
    if (created.accounts.length > 0) {
      await prisma.authAccount.deleteMany({ where: { id: { in: created.accounts } } });
    }
    for (const id of created.farmers) await prisma.farmer.deleteMany({ where: { id } });
    await prisma.$disconnect();
  } catch (err) {
    console.warn(`cleanup warning (test data may remain): ${err.message}`);
  }
  await new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
});

describe('POST /api/auth/logout — success', { skip: SKIP_DB }, () => {
  test('1. a valid token logs out with a minimal response', async () => {
    const farmer = await seedFarmer();
    const { raw, row } = await issueRefreshToken({ userId: farmer.id });

    const { status, json } = await postLogout(raw);
    assert.equal(status, 200);
    assert.equal(json.success, true);
    assert.deepEqual(json.data, { message: 'Logged out successfully' });

    const stored = await prisma.refreshToken.findUnique({ where: { id: row.id } });
    assert.ok(stored.revokedAt instanceof Date, 'the row must still exist and be revoked');
  });

  test('2. every live token in the family is revoked by one set-based update', async () => {
    const farmer = await seedFarmer();
    const familyId = nodeCrypto.randomUUID();
    const tokens = [];
    for (let i = 0; i < 4; i += 1) {
      tokens.push(await issueRefreshToken({ userId: farmer.id, familyId }));
    }
    const live = await prisma.refreshToken.count({ where: { familyId, revokedAt: null } });
    assert.equal(live, 4, 'precondition: four live tokens');

    const { status } = await postLogout(tokens[0].raw);
    assert.equal(status, 200);

    const liveAfter = await prisma.refreshToken.count({ where: { familyId, revokedAt: null } });
    assert.equal(liveAfter, 0, `the whole family must be revoked, ${liveAfter} still live`);
    // Rows are kept, not deleted.
    assert.equal(await prisma.refreshToken.count({ where: { familyId } }), 4);
  });

  test('3. an unrelated family stays active', async () => {
    const farmer = await seedFarmer();
    const other = await seedFarmer();
    const mine = await issueRefreshToken({ userId: farmer.id });
    const theirs = await issueRefreshToken({ userId: other.id });

    assert.equal((await postLogout(mine.raw)).status, 200);
    const theirsRow = await prisma.refreshToken.findUnique({ where: { id: theirs.row.id } });
    assert.equal(theirsRow.revokedAt, null, 'an unrelated family must be untouched');
  });
});

describe('POST /api/auth/logout — failures', { skip: SKIP_DB }, () => {
  test('4. a nonexistent token is a generic 401', async () => {
    await assertGeneric401(await postLogout(generateRefreshToken()), 'nonexistent');
  });

  test('5. an already-revoked token is a generic 401', async () => {
    const farmer = await seedFarmer();
    const { raw } = await issueRefreshToken({ userId: farmer.id, revokedAt: new Date() });
    await assertGeneric401(await postLogout(raw), 'revoked');
  });

  test('6. an expired token is a generic 401', async () => {
    const farmer = await seedFarmer();
    const { raw } = await issueRefreshToken({ userId: farmer.id, expiresAt: new Date(Date.now() - 1000) });
    await assertGeneric401(await postLogout(raw), 'expired');
  });

  test('7. a malformed body is a 400', async () => {
    for (const body of [{}, { refresh_token: '' }, { refresh_token: 1 }, { refresh_token: 'x', extra: 1 }]) {
      assert.equal((await post('/api/auth/logout', body)).status, 400, JSON.stringify(body));
    }
  });
});

describe('POST /api/auth/logout — session termination', { skip: SKIP_DB }, () => {
  test('8. refresh fails after logout', async () => {
    const farmer = await seedFarmer();
    const { raw } = await issueRefreshToken({ userId: farmer.id });
    assert.equal((await postRefresh(raw)).status, 200, 'precondition');

    const refreshed = await postRefresh(raw);
    assert.equal(refreshed.status, 200);
    const current = refreshed.json.data.refresh_token;

    assert.equal((await postLogout(current)).status, 200);
    await assertGeneric401(await postRefresh(current), 'refresh after logout');
  });

  test('8b. logging out with a spent token still kills the live successor', async () => {
    const farmer = await seedFarmer();
    const { raw, row } = await issueRefreshToken({ userId: farmer.id });
    const rotated = await postRefresh(raw);
    assert.equal(rotated.status, 200);

    await assertGeneric401(await postLogout(raw), 'logout with a spent token');

    const live = await prisma.refreshToken.count({ where: { familyId: row.familyId, revokedAt: null } });
    assert.equal(live, 0, 'the live successor must be revoked');
  });

  test('9. logout issues no access or refresh token', async () => {
    const farmer = await seedFarmer();
    const { raw } = await issueRefreshToken({ userId: farmer.id });
    const { json, text } = await postLogout(raw);
    assert.equal(json.data.access_token, undefined);
    assert.equal(json.data.refresh_token, undefined);
    assert.deepEqual(Object.keys(json.data), ['message']);
    assert.ok(!text.includes('tokenHash'), 'must not expose the stored digest');
  });

  test('10. the response exposes no internals', async () => {
    const farmer = await seedFarmer();
    const { raw, row } = await issueRefreshToken({ userId: farmer.id });
    const { text } = await postLogout(raw);
    assert.ok(!text.includes(row.familyId), 'must not expose the family id');
    assert.ok(!text.includes(farmer.id), 'must not expose the profile id');
    assert.ok(!text.includes(hashRefreshToken(raw)), 'must not echo the digest');
    for (const forbidden of ['passwordHash', 'identifierNormalized', 'userId', 'familyId', 'PRIVATE']) {
      assert.ok(!text.includes(forbidden), `must not contain ${forbidden}`);
    }
  });
});

describe('POST /api/auth/logout — concurrency', { skip: SKIP_DB }, () => {
  test('12. concurrent logouts cannot both report success', async () => {
    const farmer = await seedFarmer();
    const { raw } = await issueRefreshToken({ userId: farmer.id });

    const results = await Promise.all([postLogout(raw), postLogout(raw), postLogout(raw)]);
    const winners = results.filter((r) => r.status === 200);
    assert.equal(winners.length, 1, `exactly one logout may win, got ${winners.length}`);
    for (const loser of results.filter((r) => r.status !== 200)) {
      await assertGeneric401(loser, 'loser');
    }
  });

  test('12b. a logout racing a refresh still leaves no live token', async () => {
    const farmer = await seedFarmer();
    const { raw, row } = await issueRefreshToken({ userId: farmer.id });

    const [logoutRes, refreshRes] = await Promise.all([postLogout(raw), postRefresh(raw)]);

    const live = await prisma.refreshToken.count({ where: { familyId: row.familyId, revokedAt: null } });
    assert.equal(live, 0, `no live token may survive the race, ${live} did`);

    if (refreshRes.status === 200) {
      await assertGeneric401(await postRefresh(refreshRes.json.data.refresh_token), 'successor after the race');
    }
    if (logoutRes.status !== 200) await assertGeneric401(logoutRes, 'logout lost the race');
  });
});

describe('login, refresh and logout together', { skip: SKIP_DB }, () => {
  test('a login session rotates and then ends', async () => {
    const farmer = await seedFarmer();
    const login = await post('/api/auth/login', {
      role: 'farmer',
      identifier: farmer.kisanId,
      password: 'a-strong-password',
    });
    assert.equal(login.status, 200);
    const first = login.json.data.refresh_token;
    const family = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(first) } });
    created.refresh.push(family.id);

    const rotated = await postRefresh(first);
    assert.equal(rotated.status, 200);
    const second = rotated.json.data.refresh_token;
    const successor = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(second) } });
    created.refresh.push(successor.id);

    assert.equal((await postLogout(second)).status, 200);
    assert.equal(await prisma.refreshToken.count({ where: { familyId: family.familyId, revokedAt: null } }), 0);
    await assertGeneric401(await postRefresh(second), 'current after logout');
    await assertGeneric401(await postRefresh(first), 'old after logout');
  });
});
