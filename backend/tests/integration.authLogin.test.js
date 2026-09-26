/**
 * First-party credential login integration tests.
 *
 * PostgreSQL-only (there is no in-memory fallback), so these follow the same
 * SKIP_DB convention as the other integration suites: with no DATABASE_URL they
 * report as BLOCKED rather than passing vacuously.
 *
 * Signing uses a test-only RSA keypair generated in-process. Nothing here
 * depends on a production key, and no real credential is committed.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const nodeCrypto = require('node:crypto');

const jose = require('jose');

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
const KID = 'login-test-key-1';
const PASSWORD = 'correct-horse-battery-staple';
const TS = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

let app;
let server;
let baseUrl = '';
let prisma;
let testKeys;
let farmerService;
let buyerService;
let env;
let jwksModule;

// Everything created here, cleaned up in `after`.
const created = { farmers: [], buyers: [], accounts: [] };

function uniquePhone() {
  return `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
}

async function api(pathname, options = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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

function postLogin(body) {
  return api('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
}

async function createFarmerAccount(overrides = {}) {
  const farmer = await farmerService.createFarmer({
    name: `Login Farmer ${overrides.tag || TS}`,
    phone: uniquePhone(),
    email: `login-f-${overrides.tag || TS}@example.com`,
    kisanId: overrides.kisanId || `KISAN-${TS}-${Math.floor(Math.random() * 1e4)}`,
  });
  created.farmers.push(farmer.id);
  // AuthAccount.userId is UNIQUE: one credential per profile, so
  // `identifierField` chooses which of the profile's identifiers keys it.
  const identifier = overrides.identifier || farmer[overrides.identifierField || 'kisanId'];
  const account = await prisma.authAccount.create({
    data: {
      userId: farmer.id,
      role: 'farmer',
      identifier,
      identifierNormalized: normalizeIdentifier(identifier, 'farmer'),
      // `undefined` (not falsy) decides, so a deliberately empty or corrupt
      // stored hash stays exactly as given.
      passwordHash:
        overrides.passwordHash === undefined
          ? await hashPassword(overrides.password || PASSWORD)
          : overrides.passwordHash,
      ...(overrides.account || {}),
    },
  });
  created.accounts.push(account.id);
  return { farmer, account };
}

async function createBuyerAccount(overrides = {}) {
  const buyer = await buyerService.createBuyer({
    name: `Login Buyer ${overrides.tag || TS}`,
    phone: uniquePhone(),
    email: `login-b-${overrides.tag || TS}@example.com`,
    gstin: overrides.gstin || `27ABCDE${TS.toUpperCase().padEnd(7, 'X').slice(0, 7)}`,
  });
  created.buyers.push(buyer.id);
  const identifier = overrides.identifier || buyer[overrides.identifierField || 'gstin'];
  const account = await prisma.authAccount.create({
    data: {
      userId: buyer.id,
      role: 'buyer',
      identifier,
      identifierNormalized: normalizeIdentifier(identifier, 'buyer'),
      passwordHash:
        overrides.passwordHash === undefined
          ? await hashPassword(overrides.password || PASSWORD)
          : overrides.passwordHash,
      ...(overrides.account || {}),
    },
  });
  created.accounts.push(account.id);
  return { buyer, account };
}

async function readAccount(id) {
  return prisma.authAccount.findUnique({ where: { id } });
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
  // Keep the lockout window short so expiry is testable.
  process.env.AUTH_LOCKOUT_MAX_ATTEMPTS = '3';
  process.env.AUTH_LOCKOUT_DURATION_MINUTES = '5';

  app = require('../src/app');
  env = require('../src/config/env');
  jwksModule = require('../src/keys/jwks');
  farmerService = require('../src/services/farmerService');
  buyerService = require('../src/services/buyerService');
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
});

describe('POST /api/auth/login — request contract', { skip: SKIP_DB }, () => {
  test('rejects an unknown role, a missing field and unknown fields with 400', async () => {
    const bad = [
      { role: 'admin', identifier: 'x@example.com', password: 'pw' },
      { role: 'farmer', password: 'pw' },
      { role: 'farmer', identifier: 'x@example.com' },
      { role: 'farmer', identifier: '', password: 'pw' },
      { role: 'farmer', identifier: 'x@example.com', password: '' },
      // A caller must not be able to inject token claims.
      { role: 'farmer', identifier: 'x@example.com', password: 'pw', iss: 'https://evil.example/' },
      { role: 'farmer', identifier: 'x@example.com', password: 'pw', sub: 'someone-else' },
    ];
    for (const body of bad) {
      const { status } = await postLogin(body);
      assert.equal(status, 400, `expected 400 for ${JSON.stringify(body)}`);
    }
  });

  test('the endpoint is not behind requireAuth', async () => {
    // No Authorization header is sent; a 400/401 (not 401 "missing token")
    // proves the route itself is reachable.
    const { status, json } = await postLogin({ role: 'farmer', identifier: 'nobody@example.com', password: 'pw' });
    assert.equal(status, 401);
    assert.equal(json.message, 'Invalid credentials');
  });
});

describe('POST /api/auth/login — success paths', { skip: SKIP_DB }, () => {
  test('1. a valid farmer login succeeds with a Kisan ID', async () => {
    const { farmer, account } = await createFarmerAccount({ tag: 'ok-f' });
    const { status, json } = await postLogin({
      role: 'farmer',
      identifier: farmer.kisanId,
      password: PASSWORD,
    });

    assert.equal(status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.role, 'farmer');
    assert.equal(json.data.user_id, farmer.id);
    assert.equal(json.data.token_type, 'Bearer');
    assert.equal(json.data.expires_in, env.accessTokenTtlSeconds);
    assert.equal(typeof json.data.access_token, 'string');
    assert.equal(json.data.profile.id, farmer.id);
    assert.equal(json.data.profile.kisanId, farmer.kisanId);
    void account;
  });

  test('a valid farmer login also succeeds with a mobile number', async () => {
    // AuthAccount.userId is UNIQUE, so a profile has exactly ONE credential.
    // This farmer's credential is keyed by phone instead of Kisan ID.
    const { farmer } = await createFarmerAccount({ tag: 'ok-phone', identifierField: 'phone' });
    const { status, json } = await postLogin({ role: 'farmer', identifier: farmer.phone, password: PASSWORD });
    assert.equal(status, 200);
    assert.equal(json.data.user_id, farmer.id);
  });

  test('2. a valid buyer login succeeds with a GSTIN', async () => {
    const { buyer } = await createBuyerAccount({ tag: 'ok-b' });
    const { status, json } = await postLogin({ role: 'buyer', identifier: buyer.gstin, password: PASSWORD });

    assert.equal(status, 200);
    assert.equal(json.data.role, 'buyer');
    assert.equal(json.data.user_id, buyer.id);
    assert.equal(json.data.profile.gstin, buyer.gstin);
  });

  test('a valid buyer login also succeeds with a corporate email, case-insensitively', async () => {
    // One credential per profile, so this buyer's is keyed by email.
    const { buyer } = await createBuyerAccount({ tag: 'ok-email', identifierField: 'email' });
    const { status, json } = await postLogin({
      role: 'buyer',
      identifier: buyer.email.toUpperCase(),
      password: PASSWORD,
    });
    assert.equal(status, 200);
    assert.equal(json.data.user_id, buyer.id);
  });

  test('15. a successful login updates lastLoginAt', async () => {
    const { account } = await createFarmerAccount({ tag: 'lastlogin' });
    assert.equal((await readAccount(account.id)).lastLoginAt, null);
    await postLogin({ role: 'farmer', identifier: account.identifier, password: PASSWORD });
    const after = await readAccount(account.id);
    assert.ok(after.lastLoginAt instanceof Date, 'lastLoginAt must be set');
  });
});

describe('POST /api/auth/login — generic failures', { skip: SKIP_DB }, () => {
  // Every one of these must be indistinguishable from the outside.
  async function assertGeneric401(response, label) {
    assert.equal(response.status, 401, `${label}: expected 401`);
    assert.deepEqual(Object.keys(response.json).sort(), ['message', 'status'], `${label}: no extra fields`);
    assert.equal(response.json.status, 'error');
    assert.equal(response.json.message, 'Invalid credentials', `${label}: generic message`);
    assert.ok(!/password|hash|attempt|lock|exist|farm|buyer|role/i.test(response.text), `${label}: leaked detail`);
  }

  test('3. a wrong password is a generic 401', async () => {
    const { account } = await createFarmerAccount({ tag: 'wrong-pw' });
    await assertGeneric401(
      await postLogin({ role: 'farmer', identifier: account.identifier, password: 'not-the-password' }),
      'wrong password'
    );
  });

  test('4. an unknown identifier produces the identical response shape', async () => {
    const { account } = await createFarmerAccount({ tag: 'unknown' });
    const wrongPassword = await postLogin({
      role: 'farmer',
      identifier: account.identifier,
      password: 'not-the-password',
    });
    const unknown = await postLogin({
      role: 'farmer',
      identifier: `ghost-${TS}@example.com`,
      password: 'not-the-password',
    });
    await assertGeneric401(unknown, 'unknown identifier');
    // Byte-for-byte the same response apart from nothing at all.
    assert.equal(wrongPassword.text, unknown.text, 'responses must be indistinguishable');
  });

  test('5. an inactive account produces the same generic 401', async () => {
    const { account } = await createFarmerAccount({ tag: 'inactive', account: { status: 'SUSPENDED' } });
    await assertGeneric401(
      await postLogin({ role: 'farmer', identifier: account.identifier, password: PASSWORD }),
      'inactive account'
    );
  });

  test('6. a locked account produces the same generic 401', async () => {
    const { account } = await createFarmerAccount({
      tag: 'locked',
      account: { lockedUntil: new Date(Date.now() + 60 * 60 * 1000) },
    });
    await assertGeneric401(
      await postLogin({ role: 'farmer', identifier: account.identifier, password: PASSWORD }),
      'locked account'
    );
  });

  test('7. a malformed stored password hash is a safe generic 401', async () => {
    for (const bad of ['not-a-hash', 'scrypt$v1$broken', '']) {
      const { account } = await createFarmerAccount({ tag: 'badhash', passwordHash: bad });
      await assertGeneric401(
        await postLogin({ role: 'farmer', identifier: account.identifier, password: PASSWORD }),
        'malformed hash'
      );
    }
  });

  test('8. a farmer credential cannot authenticate as a buyer', async () => {
    const { account } = await createFarmerAccount({ tag: 'cross-1' });
    await assertGeneric401(
      await postLogin({ role: 'buyer', identifier: account.identifier, password: PASSWORD }),
      'farmer credential as buyer'
    );
  });

  test('9. a buyer credential cannot authenticate as a farmer', async () => {
    const { account } = await createBuyerAccount({ tag: 'cross-2' });
    await assertGeneric401(
      await postLogin({ role: 'farmer', identifier: account.identifier, password: PASSWORD }),
      'buyer credential as farmer'
    );
  });

  test('a credential pointing at a missing profile is refused', async () => {
    // No FK exists on purpose, so this must be caught explicitly.
    const account = await prisma.authAccount.create({
      data: {
        userId: `clx0doesnotexist${TS}`,
        role: 'farmer',
        identifier: `orphan-${TS}@example.com`,
        identifierNormalized: normalizeIdentifier(`orphan-${TS}@example.com`, 'farmer'),
        passwordHash: await hashPassword(PASSWORD),
      },
    });
    created.accounts.push(account.id);
    await assertGeneric401(
      await postLogin({ role: 'farmer', identifier: account.identifier, password: PASSWORD }),
      'missing profile'
    );
  });

  test('a farmer account pointing at a BUYER id is refused', async () => {
    const { buyer } = await createBuyerAccount({ tag: 'mismatch' });
    const account = await prisma.authAccount.create({
      data: {
        userId: buyer.id, // a buyer id on a farmer account
        role: 'farmer',
        identifier: `mismatch-${TS}@example.com`,
        identifierNormalized: normalizeIdentifier(`mismatch-${TS}@example.com`, 'farmer'),
        passwordHash: await hashPassword(PASSWORD),
      },
    });
    created.accounts.push(account.id);
    await assertGeneric401(
      await postLogin({ role: 'farmer', identifier: account.identifier, password: PASSWORD }),
      'role/profile mismatch'
    );
  });

  test('a credential whose identifier does not match the profile is refused', async () => {
    // Guards against an account provisioned with somebody else's identifier.
    const { farmer } = await createFarmerAccount({ tag: 'spoof' });
    const account = await prisma.authAccount.create({
      data: {
        userId: farmer.id,
        role: 'farmer',
        identifier: `someone-else-${TS}@example.com`,
        identifierNormalized: normalizeIdentifier(`someone-else-${TS}@example.com`, 'farmer'),
        passwordHash: await hashPassword(PASSWORD),
      },
    });
    created.accounts.push(account.id);
    await assertGeneric401(
      await postLogin({ role: 'farmer', identifier: account.identifier, password: PASSWORD }),
      'identifier does not belong to the profile'
    );
  });

  test('x-user-id cannot authenticate, with or without a body', async () => {
    const { farmer } = await createFarmerAccount({ tag: 'xuser' });
    const res = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'x-user-id': farmer.id, 'x-user-role': 'admin' },
      body: JSON.stringify({ role: 'farmer', identifier: `ghost-${TS}@example.com`, password: 'pw' }),
    });
    await assertGeneric401(res, 'x-user-id header');
  });
});

describe('POST /api/auth/login — lockout policy', { skip: SKIP_DB }, () => {
  test('12/13. repeated failures increment the counter and then lock the account', async () => {
    const { account } = await createFarmerAccount({ tag: 'lockout' });
    const threshold = env.authLockoutMaxAttempts;

    for (let attempt = 1; attempt < threshold; attempt += 1) {
      await postLogin({ role: 'farmer', identifier: account.identifier, password: 'wrong' });
      const row = await readAccount(account.id);
      assert.equal(row.failedAttempts, attempt, `counter must be ${attempt} after ${attempt} failures`);
      assert.equal(row.lockedUntil, null, 'must not lock before the threshold');
    }

    // The failure that reaches the threshold locks the account...
    await postLogin({ role: 'farmer', identifier: account.identifier, password: 'wrong' });
    const locked = await readAccount(account.id);
    assert.ok(locked.lockedUntil instanceof Date, 'lockedUntil must be set at the threshold');
    assert.equal(locked.failedAttempts, 0, 'the counter resets so the lockout stays bounded');

    // ...and the lockout state is never disclosed to the caller.
    const blocked = await postLogin({ role: 'farmer', identifier: account.identifier, password: PASSWORD });
    assert.equal(blocked.status, 401);
    assert.equal(blocked.json.message, 'Invalid credentials');
  });

  test('14. a locked account stays blocked until the lock expires, then works again', async () => {
    const { account, farmer } = await createFarmerAccount({ tag: 'expiry' });

    // Lock it with a window that has already elapsed.
    await prisma.authAccount.update({
      where: { id: account.id },
      data: { lockedUntil: new Date(Date.now() + env.authLockoutDurationMinutes * 60 * 1000) },
    });
    const blocked = await postLogin({ role: 'farmer', identifier: account.identifier, password: PASSWORD });
    assert.equal(blocked.status, 401, 'a live lock must block a correct password');

    // Simulate the window elapsing.
    await prisma.authAccount.update({
      where: { id: account.id },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });
    const allowed = await postLogin({ role: 'farmer', identifier: account.identifier, password: PASSWORD });
    assert.equal(allowed.status, 200, 'an expired lock must allow the correct password');
    assert.equal(allowed.json.data.user_id, farmer.id);
  });

  test('10/11. a successful login resets failedAttempts and clears lockedUntil', async () => {
    const { account } = await createFarmerAccount({ tag: 'reset', account: { failedAttempts: 2 } });
    await prisma.authAccount.update({
      where: { id: account.id },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });

    const { status } = await postLogin({ role: 'farmer', identifier: account.identifier, password: PASSWORD });
    assert.equal(status, 200);

    const after = await readAccount(account.id);
    assert.equal(after.failedAttempts, 0, 'failedAttempts must be reset');
    assert.equal(after.lockedUntil, null, 'lockedUntil must be cleared');
  });

  test('a failure on an unknown identifier creates no row and no state', async () => {
    const before = await prisma.authAccount.count();
    await postLogin({ role: 'farmer', identifier: `ghost-${TS}@example.com`, password: 'wrong' });
    assert.equal(await prisma.authAccount.count(), before, 'login must never create an account');
  });
});

describe('POST /api/auth/login — issued token', { skip: SKIP_DB }, () => {
  async function loginAndDecode() {
    const { account, farmer } = await createFarmerAccount({ tag: 'token' });
    const { status, json } = await postLogin({
      role: 'farmer',
      identifier: account.identifier,
      password: PASSWORD,
    });
    assert.equal(status, 200);
    const header = JSON.parse(Buffer.from(json.data.access_token.split('.')[0], 'base64url').toString());
    const payload = JSON.parse(Buffer.from(json.data.access_token.split('.')[1], 'base64url').toString());
    return { json, header, payload, farmer, account };
  }

  test('16/17. sub is the profile id and role is the account role', async () => {
    const { payload, farmer } = await loginAndDecode();
    assert.equal(payload.sub, farmer.id);
    assert.equal(payload.role, 'farmer');
  });

  test('18/19. iss and aud are the configured values, not caller-controlled', async () => {
    const { payload } = await loginAndDecode();
    assert.equal(payload.iss, ISSUER);
    assert.equal(payload.aud, AUDIENCE);
  });

  test('20. the token is RS256 and signed by the configured key', async () => {
    const { header, json } = await loginAndDecode();
    assert.equal(header.alg, 'RS256');
    assert.equal(header.kid, KID);
    const { payload } = await jose.jwtVerify(json.data.access_token, nodeCrypto.createPublicKey(testKeys.publicKey), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['RS256'],
    });
    assert.equal(payload.role, 'farmer');
  });

  test('10/11. iat and exp are present and the configured TTL is applied', async () => {
    const { payload } = await loginAndDecode();
    assert.equal(typeof payload.iat, 'number');
    assert.equal(typeof payload.exp, 'number');
    assert.equal(payload.exp - payload.iat, env.accessTokenTtlSeconds);
  });

  test('21/22. the response exposes no password hash or AuthAccount internals', async () => {
    const { json, text } = await loginAndDecode();
    const flat = JSON.stringify(json.data);
    for (const forbidden of [
      'passwordHash',
      'password',
      'identifierNormalized',
      'failedAttempts',
      'lockedUntil',
      'status',
      'PRIVATE',
      'BEGIN',
      'lastLoginAt',
    ]) {
      assert.ok(!flat.includes(forbidden), `response must not contain ${forbidden}`);
    }
    void text;
  });

  test('23. a missing signing key fails safely with 503 and issues no token', async () => {
    const { account } = await createFarmerAccount({ tag: 'nokey' });
    const savedKey = env.authPrivateKey;
    try {
      env.authPrivateKey = null;
      jwksModule.resetSigningKeyCache();
      const { status, json } = await postLogin({
        role: 'farmer',
        identifier: account.identifier,
        password: PASSWORD,
      });
      assert.equal(status, 503);
      assert.ok(!JSON.stringify(json).includes('access_token'), 'no token may be issued');
      assert.ok(!JSON.stringify(json).includes('BEGIN'), 'no key material may leak');
    } finally {
      env.authPrivateKey = savedKey;
      jwksModule.resetSigningKeyCache();
    }
  });

  test('24. the existing requireAuth accepts a token issued by login', async () => {
    const { json, farmer } = await loginAndDecode();
    const res = await api('/api/notifications', {
      headers: { Authorization: `Bearer ${json.data.access_token}` },
    });
    // 200 with a database; without one, authentication still succeeded and the
    // database reports itself.
    assert.ok(res.status === 200 || (res.status === 503 && /Database not configured/.test(res.json.message)));
    void farmer;
  });

  test('25. B3 authorization scopes the issued identity to its own records', async () => {
    const { json, farmer } = await loginAndDecode();
    const auth = { Authorization: `Bearer ${json.data.access_token}` };

    // Own history is readable.
    const own = await api(`/api/deals/farmer/${farmer.id}`, { headers: auth });
    assert.ok(own.status === 200 || own.status === 503, `unexpected ${own.status}`);

    // Another farmer's history is refused by the unchanged B3 middleware.
    const otherFarmer = await farmerService.createFarmer({ name: 'Other', phone: uniquePhone() });
    created.farmers.push(otherFarmer.id);
    const other = await api(`/api/deals/farmer/${otherFarmer.id}`, { headers: auth });
    assert.equal(other.status, 403, 'a first-party token must not read another farmer history');

    // A farmer token cannot read buyer history.
    const crossRole = await api('/api/deals/buyer/whatever', { headers: auth });
    assert.equal(crossRole.status, 403, 'a farmer token must not read buyer history');

    // The collection scope comes from the verified sub alone.
    const list = await api('/api/deals', { headers: auth });
    assert.ok(list.status === 200 || list.status === 503);
  });
});
