/**
 * POST /api/auth/refresh integration tests against a real PostgreSQL database.
 *
 * PostgreSQL-only, so this follows the same SKIP_DB convention as the other
 * integration suites: with no DATABASE_URL it reports as BLOCKED rather than
 * passing vacuously.
 *
 * This is the authoritative check for the two properties the stub can only
 * approximate: that the conditional UPDATE really does serialize concurrent
 * rotations under PostgreSQL, and that a unique-constraint race on
 * RefreshToken.tokenHash surfaces as a constraint violation.
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
const KID = 'refresh-test-key-1';
const TS = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

let app;
let server;
let baseUrl = '';
let prisma;
let testKeys;
let env;
let jwksModule;

const created = { farmers: [], buyers: [], accounts: [], refresh: [] };

function uniquePhone(prefix) {
  return `+91${prefix}${String(10000000 + Math.floor(Math.random() * 89999999)).slice(0, 8)}`;
}

async function seedFarmer() {
  const farmer = await prisma.farmer.create({
    data: {
      name: 'Refresh Farmer',
      phone: uniquePhone('93'),
      email: `rf-${TS}-${created.farmers.length}@example.com`,
      kisanId: `KISAN-RF-${TS}-${created.farmers.length}`,
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

async function seedBuyer() {
  const n = created.buyers.length + 1;
  const buyer = await prisma.buyer.create({
    data: {
      name: 'Refresh Buyer',
      companyName: 'Refresh Foods',
      phone: uniquePhone('92'),
      email: `rb-${TS}-${n}@example.com`,
      gstin: `27ABCDE${String(1000 + n).slice(-4)}F1ZQ`,
      district: 'Pune',
      state: 'Maharashtra',
    },
  });
  created.buyers.push(buyer.id);
  const account = await prisma.authAccount.create({
    data: {
      userId: buyer.id,
      role: 'buyer',
      identifier: buyer.gstin,
      identifierNormalized: normalizeIdentifier(buyer.gstin, 'buyer'),
      passwordHash: await hashPassword('a-strong-password'),
    },
  });
  created.accounts.push(account.id);
  return buyer;
}

async function issueRefreshToken({ userId, role, familyId, expiresAt, revokedAt = null }) {
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
  env = require('../src/config/env');
  jwksModule = require('../src/keys/jwks');
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
    for (const id of created.buyers) await prisma.buyer.deleteMany({ where: { id } });
    await prisma.$disconnect();
  } catch (err) {
    console.warn(`cleanup warning (test data may remain): ${err.message}`);
  }
  await new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
});

describe('POST /api/auth/refresh — success', { skip: SKIP_DB }, () => {
  test('1/7. a valid token rotates into a new pair and revokes the old one', async () => {
    const farmer = await seedFarmer();
    const { raw, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    const { status, json } = await postRefresh(raw);
    assert.equal(status, 200);
    assert.equal(json.data.role, 'farmer');
    assert.equal(json.data.user_id, farmer.id);
    assert.notEqual(json.data.refresh_token, raw);

    const old = await prisma.refreshToken.findUnique({ where: { id: row.id } });
    assert.ok(old.revokedAt instanceof Date, 'the presented token must be revoked');

    const successor = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(json.data.refresh_token) },
    });
    assert.ok(successor, 'the successor must be stored by digest');
    assert.equal(successor.familyId, row.familyId, 'the family must be preserved');
    assert.equal(successor.revokedAt, null);
    created.refresh.push(successor.id);
  });

  test('the new access token is RS256 with the profile sub and role', async () => {
    const farmer = await seedFarmer();
    const { raw } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    const { json } = await postRefresh(raw);

    const { payload, protectedHeader } = await (await import('jose')).jwtVerify(
      json.data.access_token,
      nodeCrypto.createPublicKey(testKeys.publicKey),
      { issuer: ISSUER, audience: AUDIENCE, algorithms: ['RS256'] }
    );
    assert.equal(protectedHeader.alg, 'RS256');
    assert.equal(protectedHeader.kid, KID);
    assert.equal(payload.sub, farmer.id);
    assert.equal(payload.role, 'farmer');
  });

  test('a buyer token refreshes to a buyer identity', async () => {
    const buyer = await seedBuyer();
    const { raw } = await issueRefreshToken({ userId: buyer.id, role: 'buyer' });
    const { status, json } = await postRefresh(raw);
    assert.equal(status, 200);
    assert.equal(json.data.role, 'buyer');
    assert.equal(json.data.user_id, buyer.id);
  });

  test('12. the raw token is never persisted', async () => {
    const farmer = await seedFarmer();
    const { raw, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    const stored = await prisma.refreshToken.findUnique({ where: { id: row.id } });
    assert.equal(stored.tokenHash, hashRefreshToken(raw));
    assert.notEqual(stored.tokenHash, raw);
    const all = await prisma.refreshToken.findMany({ where: { userId: farmer.id } });
    assert.ok(!JSON.stringify(all).includes(raw), 'the raw value must not appear in any row');
  });
});

describe('POST /api/auth/refresh — failures', { skip: SKIP_DB }, () => {
  test('2. a nonexistent token is a generic 401', async () => {
    await assertGeneric401(await postRefresh(generateRefreshToken()), 'nonexistent');
  });

  test('3. an expired token is a generic 401', async () => {
    const farmer = await seedFarmer();
    const { raw } = await issueRefreshToken({
      userId: farmer.id,
      role: 'farmer',
      expiresAt: new Date(Date.now() - 1000),
    });
    await assertGeneric401(await postRefresh(raw), 'expired');
  });

  test('4. an already-revoked token is a generic 401', async () => {
    const farmer = await seedFarmer();
    const { raw } = await issueRefreshToken({ userId: farmer.id, role: 'farmer', revokedAt: new Date() });
    await assertGeneric401(await postRefresh(raw), 'revoked');
  });

  test('5. a missing profile is a generic 401', async () => {
    const { raw } = await issueRefreshToken({ userId: 'clx0gone', role: 'farmer' });
    await assertGeneric401(await postRefresh(raw), 'missing profile');
  });

  test('6. a role that does not match the profile is a generic 401', async () => {
    const farmer = await seedFarmer();
    const { raw } = await issueRefreshToken({ userId: farmer.id, role: 'buyer' });
    await assertGeneric401(await postRefresh(raw), 'role mismatch');
  });

  test('a deactivated account cannot refresh', async () => {
    const farmer = await seedFarmer();
    await prisma.authAccount.updateMany({
      where: { userId: farmer.id },
      data: { status: 'SUSPENDED' },
    });
    const { raw } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    await assertGeneric401(await postRefresh(raw), 'suspended');
  });
});

describe('POST /api/auth/refresh — rotation under concurrency', { skip: SKIP_DB }, () => {
  test('11. concurrent refreshes with one token cannot both succeed', async () => {
    const farmer = await seedFarmer();
    const { raw, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    const results = await Promise.all([postRefresh(raw), postRefresh(raw), postRefresh(raw)]);
    const winners = results.filter((r) => r.status === 200);
    assert.equal(winners.length, 1, `exactly one rotation may win, got ${winners.length}`);
    for (const loser of results.filter((r) => r.status !== 200)) {
      await assertGeneric401(loser, 'loser');
    }

    // Exactly one successor must exist for the family.
    const family = await prisma.refreshToken.findMany({ where: { familyId: row.familyId } });
    assert.equal(family.length, 2, 'the original plus exactly one successor');
    created.refresh.push(...family.map((r) => r.id));
  });

  test('8. an old token cannot be reused after rotation', async () => {
    const farmer = await seedFarmer();
    const { raw } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    const first = await postRefresh(raw);
    assert.equal(first.status, 200);
    await assertGeneric401(await postRefresh(raw), 'replay');
  });

  test('9/10. reuse detection revokes the entire family', async () => {
    const farmer = await seedFarmer();
    const { raw, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    const first = await postRefresh(raw);
    assert.equal(first.status, 200);
    const second = await postRefresh(first.json.data.refresh_token);
    assert.equal(second.status, 200);

    // Replay the stolen first-generation token.
    await assertGeneric401(await postRefresh(raw), 'reuse');

    const live = await prisma.refreshToken.findMany({
      where: { familyId: row.familyId, revokedAt: null },
    });
    assert.equal(live.length, 0, `the whole family must be revoked, ${live.length} still live`);

    // The legitimate client is locked out as well.
    await assertGeneric401(await postRefresh(second.json.data.refresh_token), 'victim locked out');

    const all = await prisma.refreshToken.findMany({ where: { familyId: row.familyId } });
    created.refresh.push(...all.map((r) => r.id));
  });
});

describe('login and refresh together', { skip: SKIP_DB }, () => {
  test('a login refresh token rotates, and the new access token opens /me', async () => {
    const farmer = await seedFarmer();
    const login = await post('/api/auth/login', {
      role: 'farmer',
      identifier: farmer.kisanId,
      password: 'a-strong-password',
    });
    assert.equal(login.status, 200);
    assert.equal(typeof login.json.data.refresh_token, 'string');
    const loginRow = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(login.json.data.refresh_token) },
    });
    assert.ok(loginRow, 'login must store the digest');
    created.refresh.push(loginRow.id);

    const saved = env.auth0Issuer;
    env.auth0Issuer = `${baseUrl}/`;
    jwksModule.resetSigningKeyCache();
    try {
      const refreshed = await postRefresh(login.json.data.refresh_token);
      assert.equal(refreshed.status, 200);

      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${refreshed.json.data.access_token}` },
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(meRes.status, 200);
      const meJson = await meRes.json();
      assert.equal(meJson.data.user_id, farmer.id);
    } finally {
      env.auth0Issuer = saved;
      jwksModule.resetSigningKeyCache();
    }
  });
});
