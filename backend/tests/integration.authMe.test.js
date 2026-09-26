/**
 * GET /api/auth/me integration tests against a real PostgreSQL database.
 *
 * PostgreSQL-only, so this follows the same SKIP_DB convention as the other
 * integration suites: with no DATABASE_URL it reports as BLOCKED rather than
 * passing vacuously. The stub suite (unit.authMeStub.test.js) covers the same
 * request path without a database; this file is the authoritative check that
 * profile resolution reads the real farmers/buyers tables.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const nodeCrypto = require('node:crypto');

const { createHarness } = require('./helpers/jwt-test-server');
const { hashPassword } = require('../src/auth/password');
const { normalizeIdentifier } = require('../src/auth/identifier');

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
const KID = 'me-test-key-1';
const TS = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

let app;
let server;
let baseUrl = '';
let prisma;
let testKeys;
let harness;
let env;
let jwksModule;

const created = { farmers: [], buyers: [], accounts: [] };

function uniquePhone(prefix) {
  return `+91${prefix}${String(10000000 + Math.floor(Math.random() * 89999999)).slice(0, 8)}`;
}

async function seedFarmer() {
  const { getPrisma } = require('../src/config/database');
  const db = getPrisma();
  const farmer = await db.farmer.create({
    data: {
      name: 'Me Farmer',
      phone: uniquePhone('98'),
      email: `me-f-${TS}-${created.farmers.length}@example.com`,
      kisanId: `KISAN-ME-${TS}-${created.farmers.length}`,
      district: 'Nashik',
      state: 'Maharashtra',
    },
  });
  created.farmers.push(farmer.id);
  const account = await db.authAccount.create({
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
  const { getPrisma } = require('../src/config/database');
  const db = getPrisma();
  const n = created.buyers.length + 1;
  const buyer = await db.buyer.create({
    data: {
      name: 'Me Buyer',
      companyName: 'Me Foods',
      phone: uniquePhone('99'),
      email: `me-b-${TS}-${n}@example.com`,
      gstin: `27ABCDE${String(1000 + n).slice(-4)}F1ZQ`,
      district: 'Pune',
      state: 'Maharashtra',
    },
  });
  created.buyers.push(buyer.id);
  const account = await db.authAccount.create({
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

async function getMe(headers = {}) {
  const res = await fetch(`${baseUrl}/api/auth/me`, { headers, signal: AbortSignal.timeout(20000) });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json, text: JSON.stringify(json) };
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  if (!HAVE_DB) return;
  testKeys = nodeCrypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  harness = await createHarness({ audience: AUDIENCE });

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
    if (created.accounts.length > 0) {
      await prisma.authAccount.deleteMany({ where: { id: { in: created.accounts } } });
    }
    for (const id of created.farmers) {
      await prisma.farmer.deleteMany({ where: { id } });
    }
    for (const id of created.buyers) {
      await prisma.buyer.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  } catch (err) {
    console.warn(`cleanup warning (test data may remain): ${err.message}`);
  }
  await new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
  if (harness) await harness.close();
});

/** Points the canonical issuer at this server so JWKS resolution succeeds. */
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

describe('GET /api/auth/me — authentication', { skip: SKIP_DB }, () => {
  test('5/6. a missing or malformed Authorization header is 401', async () => {
    assert.equal((await getMe()).status, 401);
    for (const header of ['Bearer', 'Bearer ', 'Token abc.def.ghi', 'Bearer not.a.jwt', '']) {
      assert.equal((await getMe({ Authorization: header })).status, 401, header);
    }
  });

  test('7/8/9/10. invalid, expired, wrong-issuer and wrong-audience tokens are 401', async () => {
    await withWorkingIssuers(async () => {
      const bad = await harness.wrongKeyHarness();
      assert.equal((await getMe(bearer(await bad.mintBad({ sub: 'x', role: 'farmer' })))).status, 401, 'bad signature');
      assert.equal(
        (await getMe(bearer(await harness.mint({ sub: 'x', role: 'farmer', expiresIn: new Date(Date.now() - 60000) })))).status,
        401,
        'expired'
      );
      assert.equal(
        (await getMe(bearer(await harness.mint({ sub: 'x', role: 'farmer', iss: 'https://evil.example/' })))).status,
        401,
        'wrong issuer'
      );
      assert.equal(
        (await getMe(bearer(await harness.mint({ sub: 'x', role: 'farmer', aud: 'other-api' })))).status,
        401,
        'wrong audience'
      );
    });
  });
});

describe('GET /api/auth/me — profile resolution', { skip: SKIP_DB }, () => {
  test('1/3. a farmer token returns the farmer row', async () => {
    const farmer = await seedFarmer();
    await withWorkingIssuers(async () => {
      const { signAccessToken } = require('../src/keys/jwks');
      const { status, json } = await getMe(bearer(await signAccessToken({ sub: farmer.id, role: 'farmer' })));
      assert.equal(status, 200);
      assert.equal(json.data.role, 'farmer');
      assert.equal(json.data.user_id, farmer.id);
      assert.equal(json.data.profile.id, farmer.id);
      assert.equal(json.data.profile.kisanId, farmer.kisanId);
      assert.equal(json.data.profile.district, 'Nashik');
    });
  });

  test('2/4. a buyer token returns the buyer row', async () => {
    const buyer = await seedBuyer();
    await withWorkingIssuers(async () => {
      const { signAccessToken } = require('../src/keys/jwks');
      const { status, json } = await getMe(bearer(await signAccessToken({ sub: buyer.id, role: 'buyer' })));
      assert.equal(status, 200);
      assert.equal(json.data.role, 'buyer');
      assert.equal(json.data.user_id, buyer.id);
      assert.equal(json.data.profile.gstin, buyer.gstin);
    });
  });

  test('11/12. a token cannot resolve the other role', async () => {
    const farmer = await seedFarmer();
    const buyer = await seedBuyer();
    await withWorkingIssuers(async () => {
      const { signAccessToken } = require('../src/keys/jwks');
      const farmerAsBuyer = await getMe(bearer(await signAccessToken({ sub: farmer.id, role: 'buyer' })));
      assert.equal(farmerAsBuyer.status, 401);
      assert.ok(!JSON.stringify(farmerAsBuyer.json).includes(farmer.kisanId), 'must not leak the farmer row');

      const buyerAsFarmer = await getMe(bearer(await signAccessToken({ sub: buyer.id, role: 'farmer' })));
      assert.equal(buyerAsFarmer.status, 401);
      assert.ok(!JSON.stringify(buyerAsFarmer.json).includes(buyer.gstin), 'must not leak the buyer row');
    });
  });

  test('13/14. a token for a profile that no longer exists is a safe 401', async () => {
    await withWorkingIssuers(async () => {
      const { signAccessToken } = require('../src/keys/jwks');
      for (const role of ['farmer', 'buyer']) {
        const { status, json } = await getMe(bearer(await signAccessToken({ sub: 'clx0gone', role })));
        assert.equal(status, 401, role);
        assert.match(json.message, /no longer available/i);
      }
    });
  });

  test('a deleted profile invalidates /me even though its token is still valid', async () => {
    const farmer = await seedFarmer();
    let token;
    await withWorkingIssuers(async () => {
      const { signAccessToken } = require('../src/keys/jwks');
      token = await signAccessToken({ sub: farmer.id, role: 'farmer' });
      assert.equal((await getMe(bearer(token))).status, 200);
    });

    // Delete the profile. AuthAccount has no FK, so its row would be orphaned;
    // remove it explicitly to keep cleanup simple and to prove /me refuses on
    // the missing profile alone.
    await prisma.farmer.delete({ where: { id: farmer.id } });
    created.farmers = created.farmers.filter((id) => id !== farmer.id);
    const account = await prisma.authAccount.findUnique({ where: { userId: farmer.id } });
    if (account) {
      await prisma.authAccount.delete({ where: { id: account.id } });
      created.accounts = created.accounts.filter((id) => id !== account.id);
    }

    await withWorkingIssuers(async () => {
      const { status } = await getMe(bearer(token));
      assert.equal(status, 401, 'a token whose profile is gone must not resolve');
    });
  });
});

describe('GET /api/auth/me — response safety', { skip: SKIP_DB }, () => {
  test('15/16/17. the response matches publicProfile and leaks nothing', async () => {
    const farmer = await seedFarmer();
    const { publicProfile, FARMER_PROFILE_FIELDS } = require('../src/services/authService');
    await withWorkingIssuers(async () => {
      const { signAccessToken } = require('../src/keys/jwks');
      const { json, text } = await getMe(bearer(await signAccessToken({ sub: farmer.id, role: 'farmer' })));

      assert.deepEqual(Object.keys(json.data).sort(), ['profile', 'role', 'user_id']);
      assert.deepEqual(Object.keys(json.data.profile).sort(), [...FARMER_PROFILE_FIELDS].sort());
      assert.deepEqual(
        json.data.profile,
        publicProfile('farmer', await prisma.farmer.findUnique({ where: { id: farmer.id } }))
      );
      for (const forbidden of [
        'passwordHash',
        'identifierNormalized',
        'failedAttempts',
        'lockedUntil',
        'lastLoginAt',
        'access_token',
        'refresh_token',
        'PRIVATE',
      ]) {
        assert.ok(!text.includes(forbidden), `must not contain ${forbidden}`);
      }
    });
  });

  test('/me issues no token and writes no RefreshToken row', async () => {
    const farmer = await seedFarmer();
    await withWorkingIssuers(async () => {
      const { signAccessToken } = require('../src/keys/jwks');
      const { json } = await getMe(bearer(await signAccessToken({ sub: farmer.id, role: 'farmer' })));
      assert.equal(json.data.access_token, undefined);
      assert.equal(json.data.refresh_token, undefined);
    });
    // The table exists but must still be empty.
    const refreshRows = await prisma.refreshToken.count();
    assert.equal(refreshRows, 0, 'no refresh token may be created by /me');
  });
});
