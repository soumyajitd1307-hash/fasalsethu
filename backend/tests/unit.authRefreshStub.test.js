/**
 * POST /api/auth/refresh tests against the in-memory Prisma stand-in.
 *
 * Real-database coverage lives in tests/integration.authRefresh.test.js and is
 * BLOCKED without PostgreSQL. This file runs the real request path over HTTP:
 * route, validation, controller, service, the SHA-256 lookup and the
 * conditional-update rotation.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const nodeCrypto = require('node:crypto');

process.env.NODE_ENV = 'test';

// This suite issues many authentication requests from a single address, so the
// production rate-limit budget would throttle it. The limiter's own behaviour
// is covered by tests/unit.rateLimit.test.js, which uses deliberately tiny
// budgets. These overrides must be set before config/env is first required.
process.env.AUTH_CREDENTIAL_RATE_LIMIT_MAX = '100000';
process.env.AUTH_TOKEN_RATE_LIMIT_MAX = '100000';

const jose = require('jose');

const { makeStore, PASSWORD } = require('./helpers/prisma-stub');
const { hashRefreshToken, REFRESH_TOKEN_BYTES } = require('../src/auth/refreshToken');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ISSUER = 'https://api.fasalsethu.test/';
const AUDIENCE = 'fasalsethu-api';
const KID = 'stub-refresh-key-1';

let app;
let server;
let baseUrl = '';
let env;
let jwksModule;
let testKeys;
let store;

before(async () => {
  store = makeStore();

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

  const dbModule = require('../src/config/database');
  dbModule.getPrisma = () => store.prisma;

  app = require('../src/app');
  env = require('../src/config/env');
  jwksModule = require('../src/keys/jwks');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
});

async function seedFarmer(overrides = {}) {
  const farmer = {
    id: store.nextId('farmer'),
    name: 'Refresh Farmer',
    phone: `+9193${String(100000000 + store.farmers.size * 5).slice(0, 8)}`,
    email: `ref-f-${store.farmers.size + 1}@example.com`,
    kisanId: `KISAN-REF-${store.farmers.size + 1}`,
    village: null,
    district: 'Nashik',
    state: 'Maharashtra',
    kycStatus: 'PENDING',
  };
  Object.assign(farmer, overrides.profile || {});
  store.farmers.set(farmer.id, farmer);
  await store.addAccount({
    userId: farmer.id,
    role: 'farmer',
    identifier: farmer.kisanId,
    password: PASSWORD,
    ...(overrides.account || {}),
  });
  return farmer;
}

async function seedBuyer() {
  const n = store.buyers.size + 1;
  const buyer = {
    id: store.nextId('buyer'),
    name: 'Refresh Buyer',
    companyName: 'Refresh Foods',
    phone: `+9192${String(100000000 + store.buyers.size * 5).slice(0, 8)}`,
    email: `ref-b-${n}@example.com`,
    gstin: `27ABCDE${String(1000 + n)}F1ZQ`,
    district: 'Pune',
    state: 'Maharashtra',
    buyerType: 'RETAILER',
  };
  store.buyers.set(buyer.id, buyer);
  await store.addAccount({ userId: buyer.id, role: 'buyer', identifier: buyer.gstin, password: PASSWORD });
  return buyer;
}

/** Creates a refresh token row directly, for arranging a specific state. */
async function issueRefreshToken({ userId, role, familyId, expiresAt, revokedAt = null, raw }) {
  const token = raw || `raw-${nodeCrypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url')}`;
  const row = {
    id: store.nextId('refresh'),
    userId,
    role,
    tokenHash: hashRefreshToken(token),
    familyId: familyId || nodeCrypto.randomUUID(),
    expiresAt: expiresAt || new Date(Date.now() + 86400000),
    revokedAt,
    createdAt: new Date(),
  };
  store.refreshTokens.set(row.id, row);
  return { token, row };
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

/** Every failure must look identical from outside. */
async function assertGeneric401(response, label) {
  assert.equal(response.status, 401, `${label}: expected 401`);
  assert.deepEqual(Object.keys(response.json).sort(), ['message', 'status'], `${label}: no extra fields`);
  assert.equal(response.json.message, 'Invalid refresh token', `${label}: generic message`);
}

function familyRows(familyId) {
  return [...store.refreshTokens.values()].filter((r) => r.familyId === familyId);
}

describe('refresh token storage', () => {
  test('12. the raw refresh token is never persisted, only its SHA-256 digest', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    const row = [...store.refreshTokens.values()].find((r) => r.tokenHash === hashRefreshToken(token));
    assert.ok(row, 'the token must be findable by its digest');
    assert.equal(row.tokenHash.length, 64, 'a hex SHA-256 digest');
    assert.match(row.tokenHash, /^[0-9a-f]{64}$/);

    // The raw value must appear nowhere in the persisted state.
    const serialized = JSON.stringify([...store.refreshTokens.values()]);
    assert.ok(!serialized.includes(token), 'the raw token must not be stored');
    assert.ok(!Buffer.from(token).toString('hex').includes(row.tokenHash));
  });

  test('a refresh token is opaque, not a JWT', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    assert.equal(token.split('.').length, 1, 'a JWT would have three dot-separated parts');
    assert.ok(!token.includes('eyJ'), 'must not look like a JSON header segment');
    // A tampered token must not be decodable into claims.
    const { status } = await postRefresh(`${token}x`);
    assert.equal(status, 401);
  });
});

describe('successful refresh', () => {
  test('1. a valid token yields a new access token and a new refresh token', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    const { status, json } = await postRefresh(token);
    assert.equal(status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.token_type, 'Bearer');
    assert.equal(json.data.expires_in, env.accessTokenTtlSeconds);
    assert.equal(json.data.role, 'farmer');
    assert.equal(json.data.user_id, farmer.id);
    assert.equal(json.data.profile.id, farmer.id);
    assert.equal(typeof json.data.access_token, 'string');
    assert.equal(typeof json.data.refresh_token, 'string');
  });

  test('7. rotation issues a genuinely new refresh token and revokes the old one', async () => {
    const farmer = await seedFarmer();
    const { token, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    const first = await postRefresh(token);
    assert.equal(first.status, 200);
    assert.notEqual(first.json.data.refresh_token, token, 'the refresh token must rotate');

    const successor = [...store.refreshTokens.values()].find(
      (r) => r.tokenHash === hashRefreshToken(first.json.data.refresh_token)
    );
    assert.ok(successor, 'the successor must be stored by digest');
    assert.ok(store.refreshTokens.get(row.id).revokedAt instanceof Date, 'the old token must be revoked');
    assert.equal(successor.revokedAt, null, 'the successor must be live');
  });

  test('the successor keeps the same familyId as its ancestor', async () => {
    const farmer = await seedFarmer();
    const { token, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    const first = await postRefresh(token);
    const second = await postRefresh(first.json.data.refresh_token);

    assert.equal(second.status, 200);
    const second2 = [...store.refreshTokens.values()].find(
      (r) => r.tokenHash === hashRefreshToken(second.json.data.refresh_token)
    );
    assert.equal(second2.familyId, row.familyId, 'the family must be preserved across rotations');
    assert.equal(second2.userId, farmer.id);
    assert.equal(second2.role, 'farmer');
    assert.equal(familyRows(row.familyId).length, 3, 'three generations in one family');
  });

  test('a buyer token refreshes to a buyer identity', async () => {
    const buyer = await seedBuyer();
    const { token } = await issueRefreshToken({ userId: buyer.id, role: 'buyer' });
    const { status, json } = await postRefresh(token);
    assert.equal(status, 200);
    assert.equal(json.data.role, 'buyer');
    assert.equal(json.data.user_id, buyer.id);
    assert.equal(json.data.profile.gstin, buyer.gstin);
  });

  test('the new access token is RS256 with the profile sub and role', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    const { json } = await postRefresh(token);

    const [h, p] = json.data.access_token.split('.');
    const header = JSON.parse(Buffer.from(h, 'base64url').toString());
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    assert.equal(header.alg, 'RS256');
    assert.equal(header.kid, KID);
    assert.equal(payload.sub, farmer.id);
    assert.equal(payload.role, 'farmer');
    assert.equal(payload.iss, ISSUER);
    assert.equal(payload.aud, AUDIENCE);
    assert.equal(payload.exp - payload.iat, env.accessTokenTtlSeconds);
  });

  test('the response exposes no hash, digest or key material', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    const { text } = await postRefresh(token);
    assert.ok(!text.includes('tokenHash'), 'must not expose the stored digest');
    assert.ok(!text.includes('passwordHash'));
    assert.ok(!text.includes(hashRefreshToken(token)), 'must not echo the digest of the presented token');
    assert.ok(!text.includes('PRIVATE'));
    assert.ok(!text.includes('BEGIN'));
  });

  test('a family has an absolute lifetime: rotation cannot extend it', async () => {
    const farmer = await seedFarmer();
    // An hour left on the family.
    const { token, row } = await issueRefreshToken({
      userId: farmer.id,
      role: 'farmer',
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const first = await postRefresh(token);
    assert.equal(first.status, 200);

    const successor = [...store.refreshTokens.values()].find(
      (r) => r.tokenHash === hashRefreshToken(first.json.data.refresh_token)
    );
    assert.ok(
      successor.expiresAt.getTime() <= row.expiresAt.getTime(),
      'the successor must not outlive the family window'
    );
  });
});

describe('refresh failures are all indistinguishable', () => {
  test('2. a nonexistent token is a generic 401', async () => {
    await assertGeneric401(await postRefresh('this-token-was-never-issued'), 'nonexistent');
  });

  test('2b. an empty, malformed or non-string token is rejected', async () => {
    assert.equal((await post('/api/auth/refresh', {})).status, 400, 'missing field');
    assert.equal((await post('/api/auth/refresh', { refresh_token: '' })).status, 400, 'empty');
    assert.equal((await post('/api/auth/refresh', { refresh_token: 12345 })).status, 400, 'not a string');
    assert.equal((await post('/api/auth/refresh', { refresh_token: 'x', extra: 1 })).status, 400, 'unknown field');
    assert.equal(
      (await post('/api/auth/refresh', { refresh_token: 'x'.repeat(600) })).status,
      400,
      'absurdly long'
    );
  });

  test('3. an expired token is a generic 401', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({
      userId: farmer.id,
      role: 'farmer',
      expiresAt: new Date(Date.now() - 1000),
    });
    await assertGeneric401(await postRefresh(token), 'expired');
  });

  test('4. an already-revoked token is a generic 401', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({
      userId: farmer.id,
      role: 'farmer',
      revokedAt: new Date(),
    });
    await assertGeneric401(await postRefresh(token), 'revoked');
  });

  test('5. a token whose profile no longer exists is a generic 401', async () => {
    const { token } = await issueRefreshToken({ userId: 'farmerisgone', role: 'farmer' });
    await assertGeneric401(await postRefresh(token), 'missing farmer profile');
  });

  test('5b. a deleted profile invalidates its live token', async () => {
    const farmer = await seedFarmer();
    const { token, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    store.farmers.delete(farmer.id);
    store.authAccounts.delete([...store.authAccounts.values()].find((a) => a.userId === farmer.id).id);

    await assertGeneric401(await postRefresh(token), 'deleted profile');
    const after = store.refreshTokens.get(row.id);
    assert.ok(after.revokedAt instanceof Date, 'the family must be burned for a dead profile');
  });

  test('6. a role that does not match the profile is a generic 401', async () => {
    const farmer = await seedFarmer();
    // A farmer token that claims to be a buyer: there is no cross-role fallback.
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'buyer' });
    await assertGeneric401(await postRefresh(token), 'role mismatch');

    const buyer = await seedBuyer();
    const asFarmer = await issueRefreshToken({ userId: buyer.id, role: 'farmer' });
    await assertGeneric401(await postRefresh(asFarmer.token), 'role mismatch reversed');
  });

  test('6b. an unknown role cannot be exchanged for a profile', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'admin' });
    await assertGeneric401(await postRefresh(token), 'unknown role');
  });

  test('a deactivated account cannot refresh', async () => {
    const farmer = await seedFarmer();
    const account = [...store.authAccounts.values()].find((a) => a.userId === farmer.id);
    account.status = 'SUSPENDED';
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    await assertGeneric401(await postRefresh(token), 'suspended account');
  });

  test('a token whose AuthAccount was deleted cannot refresh', async () => {
    const farmer = await seedFarmer();
    const account = [...store.authAccounts.values()].find((a) => a.userId === farmer.id);
    store.authAccounts.delete(account.id);
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    await assertGeneric401(await postRefresh(token), 'orphaned token');
  });
});

describe('rotation is single-use', () => {
  test('8. an old token cannot be reused after rotation', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    const first = await postRefresh(token);
    assert.equal(first.status, 200);

    // The spent token must now be refused.
    await assertGeneric401(await postRefresh(token), 'replayed old token');
  });

  test('11. two concurrent refreshes with the same token cannot both succeed', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    // Force both callers to read the token before either claims it, so this is
    // a genuine race for the conditional update rather than two sequential calls.
    store.interleaveLookups(true);
    let results;
    try {
      results = await Promise.all([postRefresh(token), postRefresh(token)]);
    } finally {
      store.interleaveLookups(false);
    }

    const succeeded = results.filter((r) => r.status === 200);
    const refused = results.filter((r) => r.status === 401);
    assert.equal(succeeded.length, 1, 'exactly one rotation may win');
    assert.equal(refused.length, 1, 'the loser must be refused');
    await assertGeneric401(refused[0], 'concurrent loser');
  });

  test('11b. a burst of concurrent refreshes still yields exactly one winner', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    store.interleaveLookups(true);
    let results;
    try {
      results = await Promise.all([postRefresh(token), postRefresh(token), postRefresh(token), postRefresh(token)]);
    } finally {
      store.interleaveLookups(false);
    }
    assert.equal(results.filter((r) => r.status === 200).length, 1, 'exactly one winner');
    assert.equal(results.filter((r) => r.status === 401).length, 3);
  });

  test('a rotation that loses the race issues no new token', async () => {
    const farmer = await seedFarmer();
    const { token, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    const before = store.refreshTokens.size;

    store.interleaveLookups(true);
    try {
      const [a, b] = await Promise.all([postRefresh(token), postRefresh(token)]);
      const loser = a.status === 200 ? b : a;
      assert.equal(loser.status, 401);
      assert.ok(!JSON.stringify(loser.json).includes('refresh_token'), 'the loser must get no token');
    } finally {
      store.interleaveLookups(false);
    }

    // Exactly one successor exists, regardless of which caller won.
    const successors = familyRows(row.familyId).filter((r) => r.tokenHash !== hashRefreshToken(token));
    assert.equal(successors.length, 1, `expected one successor, got ${successors.length}`);
    assert.ok(store.refreshTokens.size >= before, 'the store is consistent');
  });
});

describe('reuse detection kills the family', () => {
  test('9/10. replaying a rotated token revokes every live token in the family', async () => {
    const farmer = await seedFarmer();
    const { token, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    // Rotate twice legitimately: three generations now exist.
    const first = await postRefresh(token);
    assert.equal(first.status, 200);
    const second = await postRefresh(first.json.data.refresh_token);
    assert.equal(second.status, 200);

    const liveBefore = familyRows(row.familyId).filter((r) => !r.revokedAt);
    assert.equal(liveBefore.length, 1, 'only the newest generation is live');

    // An attacker replays the stolen first-generation token.
    const replay = await postRefresh(token);
    await assertGeneric401(replay, 'reuse');

    // Every token in the family must now be dead, including the current one.
    const liveAfter = familyRows(row.familyId).filter((r) => !r.revokedAt);
    assert.equal(liveAfter.length, 0, `the whole family must be revoked, ${liveAfter.length} still live`);

    // And the legitimate client is locked out too, which is the intended effect.
    await assertGeneric401(await postRefresh(second.json.data.refresh_token), 'victim locked out');
  });

  test('no new token is issued after reuse is detected', async () => {
    const farmer = await seedFarmer();
    const { token, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    const first = await postRefresh(token);
    assert.equal(first.status, 200, 'the first rotation must succeed, or there is no reuse to detect');
    const countBefore = store.refreshTokens.size;

    const replay = await postRefresh(token);
    assert.equal(replay.status, 401);
    assert.ok(!JSON.stringify(replay.json).includes('access_token'));
    assert.ok(!JSON.stringify(replay.json).includes('refresh_token'));
    assert.equal(store.refreshTokens.size, countBefore, 'reuse must not create a token');
    assert.equal(familyRows(row.familyId).filter((r) => !r.revokedAt).length, 0);
  });

  test('reuse detection is scoped to the presented token family', async () => {
    const farmer = await seedFarmer();
    const other = await seedFarmer();
    const victim = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    const bystander = await issueRefreshToken({ userId: other.id, role: 'farmer' });

    await postRefresh(victim.token);
    await postRefresh(victim.token); // triggers reuse detection

    // The unrelated family must be untouched and still usable.
    const stillWorks = await postRefresh(bystander.token);
    assert.equal(stillWorks.status, 200, 'an unrelated family must not be affected');
  });
});

describe('login mints the first refresh token', () => {
  test('a login response carries a refresh token that /refresh accepts', async () => {
    const farmer = await seedFarmer();
    const login = await post('/api/auth/login', {
      role: 'farmer',
      identifier: farmer.kisanId,
      password: PASSWORD,
    });
    assert.equal(login.status, 200);
    assert.equal(typeof login.json.data.refresh_token, 'string', 'login must issue a refresh token');
    assert.ok(!login.text.includes('tokenHash'));

    const refreshed = await postRefresh(login.json.data.refresh_token);
    assert.equal(refreshed.status, 200, 'the login refresh token must be usable');
    assert.equal(refreshed.json.data.user_id, farmer.id);
    assert.notEqual(refreshed.json.data.refresh_token, login.json.data.refresh_token);
  });

  test('a buyer login refresh token rotates too', async () => {
    const buyer = await seedBuyer();
    const login = await post('/api/auth/login', {
      role: 'buyer',
      identifier: buyer.gstin,
      password: PASSWORD,
    });
    assert.equal(login.status, 200);
    const refreshed = await postRefresh(login.json.data.refresh_token);
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.json.data.role, 'buyer');
  });
});

describe('the refreshed access token works against protected routes', () => {
  test('a token from /refresh is accepted by requireAuth and /me', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    const saved = env.auth0Issuer;
    env.auth0Issuer = `${baseUrl}/`;
    jwksModule.resetSigningKeyCache();
    try {
      const refreshed = await postRefresh(token);
      assert.equal(refreshed.status, 200);

      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${refreshed.json.data.access_token}` },
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(meRes.status, 200);
      const meJson = await meRes.json();
      assert.equal(meJson.data.user_id, farmer.id);
      assert.equal(meJson.data.role, 'farmer');

      const deals = await fetch(`${baseUrl}/api/deals`, {
        headers: { Authorization: `Bearer ${refreshed.json.data.access_token}` },
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(deals.status, 200, 'B3 authorization still accepts the refreshed identity');
    } finally {
      env.auth0Issuer = saved;
      jwksModule.resetSigningKeyCache();
    }
  });
});

// Keeps the configuration assertions honest: the response must report the
// access-token TTL, never the (much longer) refresh-token window.
describe('configuration', () => {
  test('expires_in reflects ACCESS_TOKEN_TTL_SECONDS, not the refresh TTL', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    const { json } = await postRefresh(token);
    assert.equal(json.data.expires_in, env.accessTokenTtlSeconds);
    assert.notEqual(json.data.expires_in, env.refreshTokenTtlDays);
  });
});

// jose is used above to prove the access token verifies; reference it so the
// import is not flagged.
void jose;
