/**
 * Authentication rate limiting tests.
 *
 * These use the real Express app and the real express-rate-limit middleware,
 * with the in-memory Prisma stand-in, and deliberately tiny budgets set through
 * the documented environment variables so the ceiling is reached in a test
 * rather than after hundreds of requests.
 *
 * The key is the resolved client address, so these tests also prove that
 * X-Forwarded-For is honoured (because the app trusts exactly one proxy hop) and
 * that distinct client addresses keep independent counters.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const nodeCrypto = require('node:crypto');

process.env.NODE_ENV = 'test';

// Tiny budgets, applied BEFORE config/env is first required.
const CREDENTIAL_MAX = 4;
const TOKEN_MAX = 5;
process.env.AUTH_CREDENTIAL_RATE_LIMIT_MAX = String(CREDENTIAL_MAX);
process.env.AUTH_TOKEN_RATE_LIMIT_MAX = String(TOKEN_MAX);
process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES = '15';
// Trust exactly one hop, as in production.
process.env.TRUST_PROXY = '1';

const { makeStore, PASSWORD } = require('./helpers/prisma-stub');
const { hashRefreshToken, generateRefreshToken } = require('../src/auth/refreshToken');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ISSUER = 'https://api.fasalsethu.test/';
const AUDIENCE = 'fasalsethu-api';
const KID = 'ratelimit-key-1';

let app;
let server;
let baseUrl = '';
let store;
let testKeys;
let rateLimit;

// A distinct forwarded address per simulated client.
let clientSeq = 0;
function nextClient() {
  clientSeq += 1;
  return `203.0.113.${clientSeq % 250}`;
}

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
  rateLimit = require('../src/middleware/rateLimit');

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

/**
 * Each request presents a distinct forwarded client address unless one is
 * pinned, so tests never share a counter by accident.
 */
async function post(pathname, body, client) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': client || nextClient(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json, text: JSON.stringify(json), headers: res.headers };
}

async function seedFarmer() {
  const farmer = {
    id: store.nextId('farmer'),
    name: 'RL Farmer',
    phone: `+9189${String(100000000 + store.farmers.size * 5).slice(0, 8)}`,
    email: `rl-f-${store.farmers.size + 1}@example.com`,
    kisanId: `KISAN-RL-${store.farmers.size + 1}`,
    village: null,
    district: 'Nashik',
    state: 'Maharashtra',
    kycStatus: 'PENDING',
  };
  store.farmers.set(farmer.id, farmer);
  await store.addAccount({ userId: farmer.id, role: 'farmer', identifier: farmer.kisanId, password: PASSWORD });
  return farmer;
}

function registerBody() {
  const seq = nodeSeq();
  return {
    role: 'farmer',
    identifier: `KISAN-RLREG-${clientSeq}-${seq}`,
    password: 'a-strong-password',
    profile: {
      name: 'RL Register',
      phone: `+9188${String(100000000 + seq).slice(0, 8)}`,
      email: `rl-reg-${clientSeq}-${seq}@example.com`,
      kisanId: `KISAN-RLREG-${clientSeq}-${seq}`,
      district: 'Nashik',
    },
  };
}
let nodeCounter = 0;
function nodeSeq() {
  nodeCounter += 1;
  return nodeCounter;
}

async function issueRefreshToken(userId) {
  const token = generateRefreshToken();
  const row = {
    id: store.nextId('refresh'),
    userId,
    role: 'farmer',
    tokenHash: hashRefreshToken(token),
    familyId: nodeCrypto.randomUUID(),
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null,
    createdAt: new Date(),
  };
  store.refreshTokens.set(row.id, row);
  return token;
}

/** Sends `n` requests from one client and returns every response. */
async function burst(pathname, bodyFactory, n, client) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push(await post(pathname, typeof bodyFactory === 'function' ? bodyFactory(i) : bodyFactory, client));
  }
  return out;
}

describe('rate limit configuration', () => {
  test('the configured budgets and window are what the limiter uses', () => {
    assert.equal(rateLimit.limits.credentialMax, CREDENTIAL_MAX);
    assert.equal(rateLimit.limits.tokenMax, TOKEN_MAX);
    assert.equal(rateLimit.limits.windowMs, 15 * 60 * 1000);
  });

  test('TRUST_PROXY parses hops, booleans and rejects nonsense', () => {
    const { parseTrustProxy } = require('../src/config/env');
    assert.equal(parseTrustProxy(undefined), 1, 'default trusts one hop');
    assert.equal(parseTrustProxy('2'), 2);
    assert.equal(parseTrustProxy('true'), true);
    assert.equal(parseTrustProxy('false'), false);
    assert.equal(parseTrustProxy('0'), 0);
    assert.throws(() => parseTrustProxy('-1'), /TRUST_PROXY/);
    assert.throws(() => parseTrustProxy('lots'), /TRUST_PROXY/);
  });
});

describe('login rate limiting', () => {
  test('1. requests below the limit succeed normally', async () => {
    const farmer = await seedFarmer();
    const client = nextClient();
    const results = await burst(
      '/api/auth/login',
      { role: 'farmer', identifier: farmer.kisanId, password: PASSWORD },
      CREDENTIAL_MAX - 1,
      client
    );
    for (const r of results) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
    }
  });

  test('2/6/7. the limit is enforced with 429 and a Retry-After header', async () => {
    const farmer = await seedFarmer();
    const client = nextClient();
    const results = await burst(
      '/api/auth/login',
      { role: 'farmer', identifier: farmer.kisanId, password: 'wrong-password' },
      CREDENTIAL_MAX + 2,
      client
    );

    const limited = results.filter((r) => r.status === 429);
    assert.ok(limited.length >= 1, 'the limit must be enforced');
    assert.equal(limited[0].status, 429);

    // 429 uses the project's existing error convention.
    assert.equal(limited[0].json.status, 'error');
    assert.equal(typeof limited[0].json.message, 'string');
    assert.ok(limited[0].json.message.length > 0);

    // Retry-After is present and a positive number of seconds.
    const retryAfter = limited[0].headers.get('retry-after');
    assert.ok(retryAfter, 'Retry-After header must be present');
    assert.ok(Number(retryAfter) > 0, 'Retry-After must be a positive number');
  });

  test('the standard RateLimit headers are exposed', async () => {
    const farmer = await seedFarmer();
    const res = await post(
      '/api/auth/login',
      { role: 'farmer', identifier: farmer.kisanId, password: 'wrong' },
      nextClient()
    );
    // express-rate-limit emits a combined RateLimit header and a policy header.
    const limit = res.headers.get('ratelimit');
    assert.ok(limit, 'RateLimit header must be present');
    assert.match(limit, /limit=\d+/, 'must advertise the limit');
    assert.match(limit, /remaining=\d+/, 'must advertise the remaining allowance');
    assert.ok(res.headers.get('ratelimit-policy'), 'RateLimit-Policy header must be present');
  });

  test('9. successful requests do not bypass the limiter', async () => {
    const farmer = await seedFarmer();
    const client = nextClient();
    // All correct credentials: successes still consume the budget.
    const results = await burst(
      '/api/auth/login',
      { role: 'farmer', identifier: farmer.kisanId, password: PASSWORD },
      CREDENTIAL_MAX + 1,
      client
    );
    const limited = results.filter((r) => r.status === 429);
    assert.equal(limited.length, 1, `exactly the request past the budget is limited, got ${limited.length}`);
    // The first CREDENTIAL_MAX succeeded, proving they were not skipped.
    assert.equal(results.filter((r) => r.status === 200).length, CREDENTIAL_MAX);
  });
});

describe('register rate limiting', () => {
  test('3. the register limit is enforced', async () => {
    const client = nextClient();
    const results = [];
    for (let i = 0; i < CREDENTIAL_MAX + 1; i += 1) {
      results.push(await post('/api/auth/register', registerBody(), client));
    }
    const limited = results.filter((r) => r.status === 429);
    assert.equal(limited.length, 1, 'the request past the budget must be limited');
    assert.equal(limited[0].json.status, 'error');
  });

  test('register and login SHARE one credential budget', async () => {
    const farmer = await seedFarmer();
    const client = nextClient();
    // Spend the whole credential budget on register (max requests are allowed;
    // the next one is refused), then confirm login is throttled too.
    await burst('/api/auth/register', () => registerBody(), CREDENTIAL_MAX, client);
    const loginRes = await post(
      '/api/auth/login',
      { role: 'farmer', identifier: farmer.kisanId, password: PASSWORD },
      client
    );
    assert.equal(loginRes.status, 429, 'a shared credential budget must cover both endpoints');
  });
});

describe('token endpoint rate limiting', () => {
  test('4. the refresh limit is enforced', async () => {
    const farmer = await seedFarmer();
    const client = nextClient();
    const token = await issueRefreshToken(farmer.id);
    const results = await burst('/api/auth/refresh', { refresh_token: token }, TOKEN_MAX + 2, client);
    const limited = results.filter((r) => r.status === 429);
    assert.ok(limited.length >= 1, 'the refresh limit must be enforced');
    assert.equal(limited[0].status, 429);
    assert.ok(Number(limited[0].headers.get('retry-after')) > 0);
  });

  test('5. the logout limit is enforced', async () => {
    const farmer = await seedFarmer();
    const client = nextClient();
    const results = [];
    for (let i = 0; i < TOKEN_MAX + 2; i += 1) {
      const token = await issueRefreshToken(farmer.id);
      results.push(await post('/api/auth/logout', { refresh_token: token }, client));
    }
    const limited = results.filter((r) => r.status === 429);
    assert.ok(limited.length >= 1, 'the logout limit must be enforced');
  });

  test('refresh and logout SHARE the token budget', async () => {
    const client = nextClient();
    await burst('/api/auth/refresh', { refresh_token: 'nonexistent' }, TOKEN_MAX, client);
    const res = await post('/api/auth/logout', { refresh_token: 'nonexistent' }, client);
    assert.equal(res.status, 429, 'a shared token budget must cover both endpoints');
  });
});

describe('counters are isolated', () => {
  test('8. distinct client addresses keep independent counters', async () => {
    const farmer = await seedFarmer();
    const clientA = '198.51.100.10';
    const clientB = '198.51.100.11';

    // Exhaust A's budget.
    const a = await burst(
      '/api/auth/login',
      { role: 'farmer', identifier: farmer.kisanId, password: 'wrong' },
      CREDENTIAL_MAX + 1,
      clientA
    );
    assert.equal(a.filter((r) => r.status === 429).length, 1, 'A must be limited');

    // B must be completely unaffected: no shared global counter.
    const b = await post(
      '/api/auth/login',
      { role: 'farmer', identifier: farmer.kisanId, password: PASSWORD },
      clientB
    );
    assert.equal(b.status, 200, 'a different client must not be blocked by another client exhausting the limit');
  });

  test('the credential and token budgets are independent', async () => {
    const client = nextClient();
    // Exhaust the credential budget entirely.
    await burst('/api/auth/login', { role: 'farmer', identifier: 'x@y.z', password: 'wrong' }, CREDENTIAL_MAX, client);
    const blocked = await post('/api/auth/login', { role: 'farmer', identifier: 'x@y.z', password: 'wrong' }, client);
    assert.equal(blocked.status, 429, 'credentials are exhausted');

    // The token budget is separate, so token operations still work.
    const tokenRes = await post('/api/auth/refresh', { refresh_token: 'nonexistent' }, client);
    assert.equal(tokenRes.status, 401, 'the token budget must be independent of the credential budget');
  });
});

describe('existing behaviour is preserved under the limiter', () => {
  test('10. malformed authentication requests still fail validation with 400', async () => {
    const client = nextClient();
    for (const body of [{}, { refresh_token: '' }, { role: 'nope', identifier: 'a', password: 'b' }]) {
      const res = await post('/api/auth/login', body, client);
      assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
      assert.equal(res.json.status, 'error');
    }
    // And they still count against the budget like any other request.
    const limitRes = await post('/api/auth/login', { role: 'nope', identifier: 'a', password: 'b' }, client);
    assert.ok([400, 429].includes(limitRes.status), 'validation behaviour must be unchanged until the limit is hit');
  });

  test('a limited request never reaches the auth service', async () => {
    const client = nextClient();
    const farmer = await seedFarmer();
    // Burn the budget with bad logins.
    await burst('/api/auth/login', { role: 'farmer', identifier: farmer.kisanId, password: 'wrong' }, CREDENTIAL_MAX, client);
    const accountsBefore = store.authAccounts.size;

    // Now a request that WOULD have succeeded is refused before the service.
    const res = await post(
      '/api/auth/login',
      { role: 'farmer', identifier: farmer.kisanId, password: PASSWORD },
      client
    );
    assert.equal(res.status, 429);
    // No login bookkeeping may have happened.
    assert.equal(store.authAccounts.size, accountsBefore);
  });

  test('11. no secret appears in a rate-limit response', async () => {
    const farmer = await seedFarmer();
    const client = nextClient();
    const secretish = 'a-strong-password-value';
    const results = await burst(
      '/api/auth/login',
      { role: 'farmer', identifier: farmer.kisanId, password: secretish },
      CREDENTIAL_MAX + 1,
      client
    );
    for (const r of results) {
      assert.ok(!r.text.includes(secretish), 'a password must never appear in a response');
      assert.ok(!r.text.includes('tokenHash'), 'no stored digest may appear');
      assert.ok(!r.text.includes('PRIVATE'), 'no key material may appear');
      // The 429 message must not vary by endpoint or reveal existence.
      if (r.status === 429) assert.equal(r.json.message, rateLimit.RATE_LIMIT_MESSAGE);
    }
  });

  test('the limiter message is identical for credential and token endpoints', async () => {
    const clientCred = nextClient();
    const clientToken = nextClient();

    await burst('/api/auth/login', { role: 'farmer', identifier: 'a@b.c', password: 'wrong' }, CREDENTIAL_MAX + 1, clientCred);
    await burst('/api/auth/refresh', { refresh_token: 'x' }, TOKEN_MAX + 1, clientToken);

    const credMsg = (await post('/api/auth/login', { role: 'farmer', identifier: 'a@b.c', password: 'w' }, clientCred)).json.message;
    const tokenMsg = (await post('/api/auth/refresh', { refresh_token: 'x' }, clientToken)).json.message;
    assert.equal(credMsg, tokenMsg, 'the message must not reveal which endpoint or why');
  });
});

describe('other routes are unaffected', () => {
  test('/api/auth/me is not rate limited, and B1/B2/B3 routes are untouched', async () => {
    const client = nextClient();
    // Many unauthenticated /me probes: none should be rate limited.
    for (let i = 0; i < 10; i += 1) {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { 'X-Forwarded-For': client },
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(res.status, 401, '/me must stay a plain 401, never 429');
    }

    // A public B1 route is likewise unaffected.
    for (let i = 0; i < 10; i += 1) {
      const res = await fetch(`${baseUrl}/api/health`, {
        headers: { 'X-Forwarded-For': client },
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(res.status, 200);
    }
  });

  test('the JWKS endpoint stays public and unlimited', async () => {
    const client = nextClient();
    // A signing key IS configured in this file, so the document is served; the
    // point is that repeated fetches are never throttled.
    for (let i = 0; i < 10; i += 1) {
      const res = await fetch(`${baseUrl}/.well-known/jwks.json`, {
        headers: { 'X-Forwarded-For': client },
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(res.status, 200, 'the public key document must stay available');
      assert.equal(res.headers.get('retry-after'), null, 'a public key document must not be rate limited');
    }
  });
});
