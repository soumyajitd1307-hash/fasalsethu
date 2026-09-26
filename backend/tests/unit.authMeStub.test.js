/**
 * GET /api/auth/me tests against the in-memory Prisma stand-in.
 *
 * Real-database coverage lives in tests/integration.authMe.test.js and is
 * BLOCKED without PostgreSQL. This file runs the real request path over HTTP:
 * route, requireAuth (including trusted-issuer and JWKS resolution), the
 * controller and the service.
 *
 * Two token sources are used deliberately:
 *  - signAccessToken() for the happy paths, proving a first-party token minted
 *    by this codebase is accepted and resolves its own profile;
 *  - the shared JWT test harness for the negative paths (expired, wrong issuer,
 *    wrong audience, HS256, bad signature), which needs precise claim control.
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

const { createHarness } = require('./helpers/jwt-test-server');
const { makeStore, PASSWORD } = require('./helpers/prisma-stub');
const { normalizeIdentifier } = require('../src/auth/identifier');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ISSUER = 'https://api.fasalsethu.test/';
const AUDIENCE = 'fasalsethu-api';
const KID = 'stub-me-key-1';

let app;
let server;
let baseUrl = '';
let env;
let jwksModule;
let signAccessToken;
let testKeys;
let store;
let harness;

before(async () => {
  store = makeStore();

  testKeys = nodeCrypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  harness = await createHarness({ audience: AUDIENCE });

  // Environment first: config/env snapshots values when it is first required.
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
  signAccessToken = require('../src/keys/jwks').signAccessToken;

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
  if (harness) await harness.close();
});

async function seedFarmer(overrides = {}) {
  const farmer = {
    id: store.nextId('farmer'),
    name: 'Me Farmer',
    phone: `+9198${String(100000000 + store.farmers.size * 3).slice(0, 8)}`,
    email: `me-f-${store.farmers.size + 1}@example.com`,
    kisanId: `KISAN-ME-${store.farmers.size + 1}`,
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
    password: overrides.password || PASSWORD,
  });
  return farmer;
}

async function seedBuyer(overrides = {}) {
  const n = store.buyers.size + 1;
  const buyer = {
    id: store.nextId('buyer'),
    name: 'Me Buyer',
    companyName: 'Me Foods',
    phone: `+9199${String(100000000 + store.buyers.size * 3).slice(0, 8)}`,
    email: `me-b-${n}@example.com`,
    gstin: `27ABCDE${String(1000 + n)}F1ZQ`,
    district: 'Pune',
    state: 'Maharashtra',
    buyerType: 'RETAILER',
  };
  Object.assign(buyer, overrides.profile || {});
  store.buyers.set(buyer.id, buyer);
  await store.addAccount({
    userId: buyer.id,
    role: 'buyer',
    identifier: buyer.gstin,
    password: overrides.password || PASSWORD,
  });
  return buyer;
}

/**
 * Points the canonical issuer at this test server so the verifier's derived
 * JWKS URL (<issuer>/.well-known/jwks.json) resolves, and trusts the harness
 * issuer too so harness-minted tokens are also accepted.
 */
async function withWorkingIssuers(fn) {
  const savedIssuer = env.auth0Issuer;
  const savedTrusted = env.authTrustedIssuers;
  env.auth0Issuer = `${baseUrl}/`;
  env.authTrustedIssuers = [`${baseUrl}/`, harness.issuer];
  jwksModule.resetSigningKeyCache();
  try {
    return await fn();
  } finally {
    env.auth0Issuer = savedIssuer;
    env.authTrustedIssuers = savedTrusted;
    jwksModule.resetSigningKeyCache();
  }
}

async function getMe(headers = {}) {
  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers,
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

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe('GET /api/auth/me — authentication is required', () => {
  test('5. a missing Authorization header is 401', async () => {
    const { status, json } = await getMe();
    assert.equal(status, 401);
    assert.equal(json.status, 'error');
    assert.match(json.message, /Unauthorized/i);
  });

  test('6. malformed Authorization credentials are 401', async () => {
    for (const header of ['Bearer', 'Bearer ', 'Token abc.def.ghi', 'Bearer not.a.jwt.at.all', '']) {
      const { status } = await getMe({ Authorization: header });
      assert.equal(status, 401, `header ${JSON.stringify(header)}`);
    }
  });

  test('7. an invalid JWT is 401', async () => {
    // Control: in this same issuer configuration a correctly signed token for a
    // real profile must succeed, so the rejection below is attributable to the
    // signature rather than to the environment.
    const farmer = await seedFarmer();
    await withWorkingIssuers(async () => {
      const good = await getMe(bearer(await signAccessToken({ sub: farmer.id, role: 'farmer' })));
      assert.equal(good.status, 200, 'control: a valid token is accepted');
    });

    // Signed by a different key: the signature must not verify.
    const bad = await harness.wrongKeyHarness();
    const forged = await bad.mintBad({ sub: farmer.id, role: 'farmer' });
    assert.equal((await getMe(bearer(forged))).status, 401, 'a bad signature must be rejected');
  });

  test('8. an expired JWT is 401', async () => {
    await withWorkingIssuers(async () => {
      const token = await harness.mint({
        sub: 'someone',
        role: 'farmer',
        expiresIn: new Date(Date.now() - 60_000),
      });
      assert.equal((await getMe(bearer(token))).status, 401);
    });
  });

  test('9. a token from an untrusted issuer is 401', async () => {
    const token = await harness.mint({
      sub: 'someone',
      role: 'farmer',
      iss: 'https://evil.example/',
    });
    assert.equal((await getMe(bearer(token))).status, 401);
  });

  test('10. a token with the wrong audience is 401', async () => {
    await withWorkingIssuers(async () => {
      const token = await harness.mint({ sub: 'someone', role: 'farmer', aud: 'some-other-api' });
      assert.equal((await getMe(bearer(token))).status, 401);
    });
  });

  test('an HS256 token is 401', async () => {
    await withWorkingIssuers(async () => {
      const token = await harness.mint({
        sub: 'someone',
        role: 'farmer',
        alg: 'HS256',
        key: 'shared-secret',
      });
      assert.equal((await getMe(bearer(token))).status, 401);
    });
  });
});

describe('GET /api/auth/me — profile resolution', () => {
  test('1/3. a first-party farmer token returns the farmer profile', async () => {
    const farmer = await seedFarmer();
    await withWorkingIssuers(async () => {
      const token = await signAccessToken({ sub: farmer.id, role: 'farmer' });
      const { status, json } = await getMe(bearer(token));

      assert.equal(status, 200);
      assert.equal(json.success, true);
      assert.equal(json.data.role, 'farmer');
      assert.equal(json.data.user_id, farmer.id);
      assert.equal(json.data.profile.id, farmer.id);
      assert.equal(json.data.profile.kisanId, farmer.kisanId);
      assert.equal(json.data.profile.district, 'Nashik');
      // Exactly the three documented keys.
      assert.deepEqual(Object.keys(json.data).sort(), ['profile', 'role', 'user_id']);
    });
  });

  test('2/4. a first-party buyer token returns the buyer profile', async () => {
    const buyer = await seedBuyer();
    await withWorkingIssuers(async () => {
      const token = await signAccessToken({ sub: buyer.id, role: 'buyer' });
      const { status, json } = await getMe(bearer(token));

      assert.equal(status, 200);
      assert.equal(json.data.role, 'buyer');
      assert.equal(json.data.user_id, buyer.id);
      assert.equal(json.data.profile.gstin, buyer.gstin);
      assert.equal(json.data.profile.companyName, 'Me Foods');
    });
  });

  test('11. a farmer token cannot resolve a buyer', async () => {
    const buyer = await seedBuyer();
    await withWorkingIssuers(async () => {
      // Role says farmer, sub is a buyer id: there is no cross-role fallback.
      const token = await signAccessToken({ sub: buyer.id, role: 'farmer' });
      const { status, json } = await getMe(bearer(token));
      assert.equal(status, 401);
      assert.match(json.message, /no longer available/i);
      assert.ok(!json.text || !JSON.stringify(json).includes(buyer.gstin), 'must not leak the buyer profile');
    });
  });

  test('12. a buyer token cannot resolve a farmer', async () => {
    const farmer = await seedFarmer();
    await withWorkingIssuers(async () => {
      const token = await signAccessToken({ sub: farmer.id, role: 'buyer' });
      const { status } = await getMe(bearer(token));
      assert.equal(status, 401);
    });
  });

  test('13. a token for a nonexistent farmer is a safe auth failure', async () => {
    await withWorkingIssuers(async () => {
      const token = await signAccessToken({ sub: 'farmerdoesnotexist', role: 'farmer' });
      const { status, json } = await getMe(bearer(token));
      assert.equal(status, 401);
      assert.match(json.message, /no longer available/i);
    });
  });

  test('14. a token for a nonexistent buyer is a safe auth failure', async () => {
    await withWorkingIssuers(async () => {
      const token = await signAccessToken({ sub: 'buyerdoesnotexist', role: 'buyer' });
      const { status } = await getMe(bearer(token));
      assert.equal(status, 401);
    });
  });

  test('a privileged role with no profile of its own is refused', async () => {
    await withWorkingIssuers(async () => {
      for (const role of ['admin', 'system', 'user']) {
        const token = await signAccessToken({ sub: 'admin-1', role });
        assert.equal((await getMe(bearer(token))).status, 401, `role ${role} has no profile`);
      }
    });
  });
});

describe('GET /api/auth/me — response safety', () => {
  test('15/16. no password hash and no AuthAccount internals are returned', async () => {
    const farmer = await seedFarmer();
    await withWorkingIssuers(async () => {
      const token = await signAccessToken({ sub: farmer.id, role: 'farmer' });
      const { text } = await getMe(bearer(token));
      for (const forbidden of [
        'passwordHash',
        'password',
        'identifierNormalized',
        'identifier',
        'failedAttempts',
        'lockedUntil',
        'lastLoginAt',
        'emailVerifiedAt',
        'phoneVerifiedAt',
        'status',
        'PRIVATE',
        'BEGIN',
        'access_token',
        'refresh_token',
      ]) {
        assert.ok(!text.includes(forbidden), `response must not contain ${forbidden}`);
      }
    });
  });

  test('17. the response uses the shared publicProfile field set', async () => {
    const { publicProfile, FARMER_PROFILE_FIELDS, BUYER_PROFILE_FIELDS } = require('../src/services/authService');
    const farmer = await seedFarmer();
    const buyer = await seedBuyer();

    await withWorkingIssuers(async () => {
      const farmerRes = await getMe(bearer(await signAccessToken({ sub: farmer.id, role: 'farmer' })));
      const buyerRes = await getMe(bearer(await signAccessToken({ sub: buyer.id, role: 'buyer' })));

      assert.deepEqual(
        Object.keys(farmerRes.json.data.profile).sort(),
        [...FARMER_PROFILE_FIELDS].sort(),
        'farmer profile must match the shared serializer exactly'
      );
      assert.deepEqual(
        Object.keys(buyerRes.json.data.profile).sort(),
        [...BUYER_PROFILE_FIELDS].sort(),
        'buyer profile must match the shared serializer exactly'
      );
      // And the values must equal what the serializer produces from the row.
      assert.deepEqual(farmerRes.json.data.profile, publicProfile('farmer', store.farmers.get(farmer.id)));
    });
  });

  test('/me issues no token and creates no RefreshToken row', async () => {
    const farmer = await seedFarmer();
    const before = store.authAccounts.size;
    await withWorkingIssuers(async () => {
      const { json } = await getMe(bearer(await signAccessToken({ sub: farmer.id, role: 'farmer' })));
      assert.equal(json.data.access_token, undefined);
      assert.equal(json.data.refresh_token, undefined);
    });
    assert.equal(store.authAccounts.size, before, 'no credential state may change');
  });
});

describe('GET /api/auth/me — identity is not caller-selectable', () => {
  test('x-user-id and query/path parameters are ignored', async () => {
    const mine = await seedFarmer();
    const other = await seedFarmer();
    await withWorkingIssuers(async () => {
      const token = await signAccessToken({ sub: mine.id, role: 'farmer' });

      // Headers and query strings must not influence the result.
      const spoofed = await getMe({
        ...bearer(token),
        'x-user-id': other.id,
        'x-user-role': 'admin',
      });
      assert.equal(spoofed.status, 200);
      assert.equal(spoofed.json.data.user_id, mine.id, 'x-user-id must be ignored');
      assert.equal(spoofed.json.data.profile.kisanId, mine.kisanId);

      const viaQuery = await fetch(
        `${baseUrl}/api/auth/me?user_id=${other.id}&role=admin&farmerId=${other.id}`,
        { headers: bearer(token), signal: AbortSignal.timeout(20000) }
      );
      const viaQueryJson = await viaQuery.json();
      assert.equal(viaQuery.status, 200);
      assert.equal(viaQueryJson.data.user_id, mine.id, 'query parameters must be ignored');
    });
  });

  test('there is no /me/:id route', async () => {
    const farmer = await seedFarmer();
    const other = await seedFarmer();
    await withWorkingIssuers(async () => {
      const token = await signAccessToken({ sub: farmer.id, role: 'farmer' });
      // A trailing slash is ordinary Express path tolerance, not a parameter.
      const trailing = await fetch(`${baseUrl}/api/auth/me/`, {
        headers: bearer(token),
        signal: AbortSignal.timeout(20000),
      });
      const trailingJson = await trailing.json();
      assert.equal(trailing.status, 200);
      assert.equal(trailingJson.data.user_id, farmer.id);

      // Anything addressing a specific profile must not exist.
      for (const p of [`/api/auth/me/${farmer.id}`, `/api/auth/me/${other.id}`, '/api/auth/me/abc']) {
        const res = await fetch(`${baseUrl}${p}`, {
          headers: bearer(token),
          signal: AbortSignal.timeout(20000),
        });
        assert.equal(res.status, 404, `${p} must not exist`);
      }
    });
  });
});

describe('GET /api/auth/me — end-to-end after register and login', () => {
  test('a freshly registered farmer can call /me with a login token', async () => {
    const body = {
      role: 'farmer',
      identifier: 'KISAN-E2E-ME',
      password: 'a-strong-password',
      profile: {
        name: 'E2E Farmer',
        phone: '+919700000001',
        email: 'e2e-me@example.com',
        kisanId: 'KISAN-E2E-ME',
        district: 'Nashik',
      },
    };
    const post = async (p, b) => {
      const res = await fetch(`${baseUrl}${p}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(b),
        signal: AbortSignal.timeout(20000),
      });
      return { status: res.status, json: await res.json() };
    };

    const accountsBefore = store.authAccounts.size;
    const registered = await post('/api/auth/register', body);
    assert.equal(registered.status, 201);
    assert.equal(
      store.authAccounts.size,
      accountsBefore + 1,
      'registration must add exactly one credential'
    );
    const account = [...store.authAccounts.values()].find(
      (a) => a.userId === registered.json.data.user_id
    );
    assert.ok(account, 'the new credential must belong to the new profile');
    assert.equal(account.identifierNormalized, normalizeIdentifier(body.identifier, 'farmer'));

    // Login and /me must share an issuer configuration the verifier can reach.
    await withWorkingIssuers(async () => {
      const login = await post('/api/auth/login', {
        role: 'farmer',
        identifier: body.identifier,
        password: body.password,
      });
      assert.equal(login.status, 200);

      const me = await getMe(bearer(login.json.data.access_token));
      assert.equal(me.status, 200);
      assert.equal(me.json.data.user_id, registered.json.data.user_id);
      assert.equal(me.json.data.profile.kisanId, 'KISAN-E2E-ME');
    });
  });
});
