/**
 * POST /api/auth/logout tests against the in-memory Prisma stand-in.
 *
 * Real-database coverage lives in tests/integration.authLogout.test.js and is
 * BLOCKED without PostgreSQL. This file runs the real request path over HTTP:
 * route, validation, controller, service, the SHA-256 lookup and the
 * conditional-update family revocation.
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

const { makeStore, PASSWORD } = require('./helpers/prisma-stub');
const { hashRefreshToken, REFRESH_TOKEN_BYTES } = require('../src/auth/refreshToken');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ISSUER = 'https://api.fasalsethu.test/';
const AUDIENCE = 'fasalsethu-api';
const KID = 'stub-logout-key-1';

let app;
let server;
let baseUrl = '';
let env;
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

async function seedFarmer() {
  const farmer = {
    id: store.nextId('farmer'),
    name: 'Logout Farmer',
    phone: `+9191${String(100000000 + store.farmers.size * 5).slice(0, 8)}`,
    email: `lo-f-${store.farmers.size + 1}@example.com`,
    kisanId: `KISAN-LO-${store.farmers.size + 1}`,
    village: null,
    district: 'Nashik',
    state: 'Maharashtra',
    kycStatus: 'PENDING',
  };
  store.farmers.set(farmer.id, farmer);
  await store.addAccount({ userId: farmer.id, role: 'farmer', identifier: farmer.kisanId, password: PASSWORD });
  return farmer;
}

async function issueRefreshToken({ userId, role, familyId, expiresAt, revokedAt = null }) {
  const token = `raw-${nodeCrypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url')}`;
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

const postLogout = (token) => post('/api/auth/logout', { refresh_token: token });
const postRefresh = (token) => post('/api/auth/refresh', { refresh_token: token });

async function assertGeneric401(response, label) {
  assert.equal(response.status, 401, `${label}: expected 401`);
  assert.deepEqual(Object.keys(response.json).sort(), ['message', 'status'], `${label}: no extra fields`);
  assert.equal(response.json.message, 'Invalid refresh token', `${label}: generic message`);
}

const familyRows = (familyId) => [...store.refreshTokens.values()].filter((r) => r.familyId === familyId);
const liveInFamily = (familyId) => familyRows(familyId).filter((r) => !r.revokedAt);

describe('successful logout', () => {
  test('1. a valid token logs out with a minimal success response', async () => {
    const farmer = await seedFarmer();
    const { token, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    const { status, json, text } = await postLogout(token);
    assert.equal(status, 200);
    assert.equal(json.success, true);
    assert.deepEqual(json.data, { message: 'Logged out successfully' });
    assert.ok(store.refreshTokens.get(row.id).revokedAt instanceof Date, 'the token must be revoked');
    void text;
  });

  test('2. every live token in the same family is revoked', async () => {
    const farmer = await seedFarmer();
    // Build a family of three live generations by hand.
    const familyId = nodeCrypto.randomUUID();
    const a = await issueRefreshToken({ userId: farmer.id, role: 'farmer', familyId });
    const b = await issueRefreshToken({ userId: farmer.id, role: 'farmer', familyId });
    const c = await issueRefreshToken({ userId: farmer.id, role: 'farmer', familyId });
    assert.equal(liveInFamily(familyId).length, 3);

    const { status } = await postLogout(a.token);
    assert.equal(status, 200);
    assert.equal(liveInFamily(familyId).length, 0, 'all three must be revoked');
    for (const t of [a, b, c]) {
      assert.ok(store.refreshTokens.get(t.row.id).revokedAt instanceof Date);
    }
  });

  test('rows are kept, not deleted, so reuse detection still recognises them', async () => {
    const farmer = await seedFarmer();
    const { token, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    const before = store.refreshTokens.size;

    await postLogout(token);
    assert.equal(store.refreshTokens.size, before, 'logout must not delete rows');
    assert.ok(store.refreshTokens.has(row.id), 'the row must still exist');
  });

  test('3. an unrelated family stays active', async () => {
    const farmer = await seedFarmer();
    const other = await seedFarmer();
    const mine = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    const theirs = await issueRefreshToken({ userId: other.id, role: 'farmer' });

    assert.equal((await postLogout(mine.token)).status, 200);
    assert.equal(liveInFamily(mine.row.familyId).length, 0, 'my family is dead');
    assert.equal(liveInFamily(theirs.row.familyId).length, 1, 'their family must be untouched');
    assert.equal(store.refreshTokens.get(theirs.row.id).revokedAt, null);
  });
});

describe('logout failures return the generic response', () => {
  test('4. a nonexistent token is a generic 401', async () => {
    await assertGeneric401(await postLogout('never-issued-at-all'), 'nonexistent');
  });

  test('5. an already-revoked token is a generic 401, not a success', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer', revokedAt: new Date() });
    const { status, json } = await postLogout(token);
    assert.equal(status, 401);
    assert.equal(json.message, 'Invalid refresh token');
  });

  test('5b. logging out twice is a generic 401 the second time', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    assert.equal((await postLogout(token)).status, 200);
    await assertGeneric401(await postLogout(token), 'second logout');
  });

  test('6. an expired token is a generic 401', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({
      userId: farmer.id,
      role: 'farmer',
      expiresAt: new Date(Date.now() - 1000),
    });
    await assertGeneric401(await postLogout(token), 'expired');
  });

  test('7. a malformed body is a 400 and never reaches the service', async () => {
    for (const body of [{}, { refresh_token: '' }, { refresh_token: 12345 }, { refresh_token: 'x', extra: 1 }, { refresh_token: 'x'.repeat(600) }]) {
      assert.equal((await post('/api/auth/logout', body)).status, 400, JSON.stringify(body));
    }
  });

  test('7b. a token that is not a valid opaque token is a generic 401', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    // Tampered values must not match the stored digest.
    for (const bad of [`${token}x`, token.slice(0, -1), '', 'a.b.c']) {
      if (bad === '') continue;
      await assertGeneric401(await postLogout(bad), `tampered ${bad.slice(0, 8)}`);
    }
  });
});

describe('logout ends the session', () => {
  test('8. refresh fails after logout', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    assert.equal((await postRefresh(token)).status, 200, 'precondition: the token works');
    const rotated = await postRefresh(token);
    void rotated;

    const live = liveInFamily(familyRows([...store.refreshTokens.values()].find((r) => !r.revokedAt).familyId)[0].familyId);
    assert.equal(live.length, 1, 'exactly one live successor');

    const current = live[0];
    const currentRaw = current.tokenHash;
    assert.ok(currentRaw);

    // Recover the raw value of the live successor for the logout call.
    const login = await post('/api/auth/login', {
      role: 'farmer',
      identifier: farmer.kisanId,
      password: PASSWORD,
    });
    assert.equal(login.status, 200);
    const sessionToken = login.json.data.refresh_token;
    const sessionFamily = [...store.refreshTokens.values()].find(
      (r) => r.tokenHash === hashRefreshToken(sessionToken)
    ).familyId;
    assert.equal(liveInFamily(sessionFamily).length, 1);

    assert.equal((await postLogout(sessionToken)).status, 200);
    await assertGeneric401(await postRefresh(sessionToken), 'refresh after logout');
  });

  test('8b. logging out with a rotated (spent) token still kills the live successor', async () => {
    const farmer = await seedFarmer();
    const { token, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    // Rotate legitimately, leaving a live successor.
    const first = await postRefresh(token);
    assert.equal(first.status, 200);
    assert.equal(liveInFamily(row.familyId).length, 1, 'the successor is live');

    // Now log out with the SPENT first-generation token.
    await assertGeneric401(await postLogout(token), 'logout with a spent token');

    // The response is a 401, but the session must still be dead.
    assert.equal(liveInFamily(row.familyId).length, 0, 'the live successor must be revoked');
    await assertGeneric401(await postRefresh(first.json.data.refresh_token), 'successor after logout');
  });

  test('9. logout issues no access token and no refresh token', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    const { json, text } = await postLogout(token);

    assert.equal(json.data.access_token, undefined);
    assert.equal(json.data.refresh_token, undefined);
    assert.deepEqual(Object.keys(json.data), ['message']);
    assert.ok(!text.includes('access_token'), 'no access token may be issued');
    assert.ok(!text.includes('refresh_token'), 'no refresh token may be issued');
  });
});

describe('logout exposes nothing sensitive', () => {
  test('10. the response leaks no hash, family id, or account internals', async () => {
    const farmer = await seedFarmer();
    const { token, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    const { text } = await postLogout(token);

    assert.ok(!text.includes('tokenHash'), 'must not expose the stored digest');
    assert.ok(!text.includes(row.familyId), 'must not expose the family id');
    assert.ok(!text.includes(farmer.id), 'must not expose the profile id');
    assert.ok(!text.includes(hashRefreshToken(token)), 'must not echo the digest');
    for (const forbidden of ['passwordHash', 'identifierNormalized', 'userId', 'familyId', 'PRIVATE', 'BEGIN']) {
      assert.ok(!text.includes(forbidden), `must not contain ${forbidden}`);
    }
  });

  test('the raw token is never persisted and never appears in a row', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    await postLogout(token);
    const serialized = JSON.stringify([...store.refreshTokens.values()]);
    assert.ok(!serialized.includes(token), 'the raw value must not be stored');
  });
});

describe('logout concurrency', () => {
  test('12. concurrent logouts with the same token cannot both report success', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    store.interleaveLookups(true);
    let results;
    try {
      results = await Promise.all([postLogout(token), postLogout(token), postLogout(token)]);
    } finally {
      store.interleaveLookups(false);
    }

    const ok = results.filter((r) => r.status === 200);
    assert.equal(ok.length, 1, `exactly one logout may win, got ${ok.length}`);
    for (const loser of results.filter((r) => r.status !== 200)) {
      await assertGeneric401(loser, 'concurrent logout loser');
    }
  });

  test('12b. a logout racing a refresh still leaves no live token', async () => {
    const farmer = await seedFarmer();
    const { token, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });

    store.interleaveLookups(true);
    let logoutRes;
    let refreshRes;
    try {
      [logoutRes, refreshRes] = await Promise.all([postLogout(token), postRefresh(token)]);
    } finally {
      store.interleaveLookups(false);
    }

    // Whichever won, the session must end: no live token may survive.
    const live = liveInFamily(row.familyId);
    assert.equal(live.length, 0, `no live token may survive the race, ${live.length} did`);

    // The refresh either lost outright or minted a token that logout then killed.
    if (refreshRes.status === 200) {
      await assertGeneric401(await postRefresh(refreshRes.json.data.refresh_token), 'successor after the race');
    } else {
      await assertGeneric401(refreshRes, 'refresh lost the race');
    }
    // Logout itself either succeeded or reported the generic failure.
    if (logoutRes.status !== 200) await assertGeneric401(logoutRes, 'logout lost the race');
  });

  test('a logout after a successful refresh cannot leave the session alive', async () => {
    const farmer = await seedFarmer();
    const { token, row } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    const rotated = await postRefresh(token);
    assert.equal(rotated.status, 200);

    // Log out with the current (live) token.
    assert.equal((await postLogout(rotated.json.data.refresh_token)).status, 200);
    assert.equal(liveInFamily(row.familyId).length, 0);
  });
});

describe('end-to-end login, refresh, logout', () => {
  test('a login session can be rotated and then ended', async () => {
    const farmer = await seedFarmer();
    const login = await post('/api/auth/login', {
      role: 'farmer',
      identifier: farmer.kisanId,
      password: PASSWORD,
    });
    assert.equal(login.status, 200);
    const first = login.json.data.refresh_token;

    const rotated = await postRefresh(first);
    assert.equal(rotated.status, 200);
    const second = rotated.json.data.refresh_token;
    assert.notEqual(second, first);

    const loggedOut = await postLogout(second);
    assert.equal(loggedOut.status, 200);
    assert.equal(loggedOut.json.data.message, 'Logged out successfully');

    // Neither generation can be used again.
    await assertGeneric401(await postRefresh(second), 'current token after logout');
    await assertGeneric401(await postRefresh(first), 'old token after logout');
  });

  test('logout does not require an access token', async () => {
    const farmer = await seedFarmer();
    const { token } = await issueRefreshToken({ userId: farmer.id, role: 'farmer' });
    // No Authorization header is sent by postLogout, and it succeeds.
    const { status } = await postLogout(token);
    assert.equal(status, 200);
    void env;
  });
});
