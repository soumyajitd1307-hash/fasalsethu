/**
 * Registration flow tests against the in-memory Prisma stand-in.
 *
 * Real-database coverage lives in tests/integration.authRegister.test.js and is
 * BLOCKED without PostgreSQL. This file runs the same request path end to end
 * over HTTP — route, discriminated-union validation, controller, service,
 * transaction, password utility — so registration is executed rather than
 * merely written.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const nodeCrypto = require('node:crypto');

// Non-development NODE_ENV keeps the error handler from attaching stack traces,
// so response-shape assertions reflect production.
process.env.NODE_ENV = 'test';

// This suite issues many authentication requests from a single address, so the
// production rate-limit budget would throttle it. The limiter's own behaviour
// is covered by tests/unit.rateLimit.test.js, which uses deliberately tiny
// budgets. These overrides must be set before config/env is first required.
process.env.AUTH_CREDENTIAL_RATE_LIMIT_MAX = '100000';
process.env.AUTH_TOKEN_RATE_LIMIT_MAX = '100000';

const jose = require('jose');

const { normalizeIdentifier } = require('../src/auth/identifier');
const { verifyPassword } = require('../src/auth/password');
const { makeStore } = require('./helpers/prisma-stub');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ISSUER = 'https://api.fasalsethu.test/';
const AUDIENCE = 'fasalsethu-api';
const KID = 'stub-register-key-1';

let app;
let server;
let baseUrl = '';
let env;
let jwksModule;
let testKeys;
let store;
let n = 0;

function uniq() {
  n += 1;
  return `${Date.now().toString(36)}${n}`;
}

/** A syntactically valid, unique GSTIN: 27 | ABCDE | 4 digits | F | 1 | Z | Q. */
function uniqueGstin() {
  const digits = String(1000 + (n += 1)).slice(-4);
  return `27ABCDE${digits}F1ZQ`;
}

function uniquePhone(prefix) {
  return `+91${prefix}${String(10000000 + (n += 1)).slice(0, 8)}`;
}

function farmerBody(overrides = {}) {
  const tag = uniq();
  const { profile, top, ...rest } = overrides;
  return {
    role: 'farmer',
    identifier: `KISAN-REG-${tag}`,
    password: 'a-strong-password',
    ...top,
    ...rest,
    profile: {
      name: 'Registering Farmer',
      phone: uniquePhone('98'),
      email: `reg-f-${tag}@example.com`,
      kisanId: `KISAN-REG-${tag}`,
      village: 'Shivaji Nagar',
      district: 'Nashik',
      state: 'Maharashtra',
      ...(profile || {}),
    },
  };
}

function buyerBody(overrides = {}) {
  const tag = uniq();
  const { profile, top, gstin, ...rest } = overrides;
  const resolvedGstin = gstin || uniqueGstin();
  return {
    role: 'buyer',
    identifier: resolvedGstin,
    password: 'a-strong-password',
    ...top,
    ...rest,
    profile: {
      name: 'Registering Buyer',
      companyName: 'Reg Foods Pvt Ltd',
      phone: uniquePhone('99'),
      email: `reg-b-${tag}@example.com`,
      gstin: resolvedGstin,
      buyerType: 'RETAILER',
      district: 'Pune',
      state: 'Maharashtra',
      ...(profile || {}),
    },
  };
}

/** Removes keys entirely, which JSON.stringify would otherwise drop. */
function without(obj, ...keys) {
  const copy = { ...obj };
  for (const key of keys) delete copy[key];
  return copy;
}

/** Finds the single credential belonging to a profile. */
function accountFor(userId) {
  return [...store.authAccounts.values()].find((a) => a.userId === userId);
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

const postRegister = (body) => post('/api/auth/register', body);
const postLogin = (body) => post('/api/auth/login', body);

before(async () => {
  store = makeStore();

  testKeys = nodeCrypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  // Environment must be set before config/env is first required.
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

describe('registration request contract', () => {
  test('14. an unsupported role is a 400', async () => {
    for (const role of ['admin', 'system', 'FARMER', '', 'farmer ']) {
      const body = farmerBody();
      body.role = role;
      const { status } = await postRegister(body);
      assert.equal(status, 400, `expected 400 for role ${JSON.stringify(role)}`);
    }
  });

  test('15. an identifier that matches no profile identifier is a 400', async () => {
    const body = farmerBody();
    body.identifier = 'SOMETHING-ELSE-ENTIRELY';
    const { status, json } = await postRegister(body);
    assert.equal(status, 400);
    assert.match(json.message, /identifier/i);
    // Nothing may be left behind by the rejected attempt.
    assert.equal(store.farmers.size, 0, 'no profile may survive a rejected identifier');
    assert.equal(store.authAccounts.size, 0, 'no credential may survive a rejected identifier');
  });

  test('16. a weak or missing password is a 400', async () => {
    for (const password of ['short', '', '1234567']) {
      const body = farmerBody();
      body.password = password;
      const { status } = await postRegister(body);
      assert.equal(status, 400, `expected 400 for password ${JSON.stringify(password)}`);
    }
    const missing = farmerBody();
    delete missing.password;
    assert.equal((await postRegister(missing)).status, 400);
  });

  test('17/18. a malformed body or an unknown field is a 400', async () => {
    // Fields genuinely absent (JSON.stringify drops undefined, so delete them).
    const cases = [
      without(farmerBody(), 'profile'),
      without(farmerBody(), 'identifier'),
      without(farmerBody(), 'role'),
      without(farmerBody({ profile: {} }), 'profile', 'name'),
      without(farmerBody({ profile: {} }), 'profile', 'phone'),
      farmerBody({ profile: { phone: 'not-a-phone' } }),
      farmerBody({ profile: { email: 'nope' } }),
      farmerBody({ profile: { kisanId: 'ab' } }),
    ];
    for (const body of cases) {
      assert.equal((await postRegister(body)).status, 400, `expected 400 for ${JSON.stringify(body).slice(0, 90)}`);
    }

    // Strictness: neither the envelope nor the profile may carry extra fields.
    assert.equal((await postRegister({ ...farmerBody(), isAdmin: true })).status, 400, 'unknown top-level field');
    assert.equal((await postRegister(farmerBody({ profile: { trustScore: 100 } }))).status, 400, 'trustScore');
    assert.equal((await postRegister(farmerBody({ profile: { kycStatus: 'VERIFIED' } }))).status, 400, 'kycStatus');
    assert.equal(
      (await postRegister(farmerBody({ profile: { id: 'chosen-by-client' } }))).status,
      400,
      'a client-supplied id'
    );
    assert.equal(
      (await postRegister(farmerBody({ profile: { emailVerifiedAt: new Date().toISOString() } }))).status,
      400,
      'a verification timestamp'
    );
  });

  test('a buyer may not send farmer-only fields and vice versa', async () => {
    assert.equal((await postRegister(buyerBody({ profile: { kisanId: 'KISAN-NOPE' } }))).status, 400);
    assert.equal((await postRegister(farmerBody({ profile: { gstin: uniqueGstin() } }))).status, 400);
  });

  test('an invalid GSTIN is a 400', async () => {
    for (const bad of ['123', 'ABCDE1234F1ZQ', '27ABCDE1234F1Z', '27-ABCDE-1234-F1Z-Q']) {
      const body = buyerBody();
      body.profile.gstin = bad;
      body.identifier = bad;
      assert.equal((await postRegister(body)).status, 400, `expected 400 for GSTIN ${bad}`);
    }
  });
});

describe('successful registration', () => {
  test('1. a farmer registers and 3/5/6. the credential matches the profile', async () => {
    const body = farmerBody();
    const before = { farmers: store.farmers.size, accounts: store.authAccounts.size };
    const { status, json } = await postRegister(body);

    assert.equal(status, 201);
    assert.equal(json.success, true);
    assert.equal(json.data.role, 'farmer');
    assert.equal(json.data.profile.kisanId, body.profile.kisanId);
    assert.equal(json.data.profile.district, 'Nashik');

    const farmer = store.farmers.get(json.data.user_id);
    assert.ok(farmer, 'the profile must exist');
    const account = accountFor(json.data.user_id);
    assert.ok(account, 'exactly one credential must exist for the profile');
    assert.equal(account.userId, farmer.id, 'AuthAccount.userId must equal the profile id');
    assert.equal(account.role, 'farmer', 'AuthAccount.role must match');
    assert.equal(
      account.identifierNormalized,
      normalizeIdentifier(body.identifier, 'farmer'),
      'identifierNormalized must equal what login computes'
    );
    assert.equal(store.farmers.size, before.farmers + 1, 'one new profile');
    assert.equal(store.authAccounts.size, before.accounts + 1, 'one new credential');
  });

  test('2/4. a buyer registers and its credential matches the profile', async () => {
    const body = buyerBody();
    const { status, json } = await postRegister(body);

    assert.equal(status, 201);
    assert.equal(json.data.role, 'buyer');
    assert.equal(json.data.profile.gstin, body.profile.gstin);
    assert.equal(json.data.profile.companyName, 'Reg Foods Pvt Ltd');

    const account = accountFor(json.data.user_id);
    assert.ok(account);
    assert.equal(account.userId, json.data.user_id);
    assert.equal(account.role, 'buyer');
    // A GSTIN is normalized to its canonical uppercase form by both paths.
    assert.equal(account.identifierNormalized, normalizeIdentifier(body.identifier, 'buyer'));
  });

  test('7. identifierNormalized matches login normalization for an email', async () => {
    const body = buyerBody();
    body.identifier = body.profile.email.toUpperCase();
    const { status, json } = await postRegister(body);
    assert.equal(status, 201);
    const account = accountFor(json.data.user_id);
    assert.equal(account.identifierNormalized, body.profile.email.toLowerCase());
    assert.equal(account.identifier, body.identifier, 'the raw identifier is kept as supplied');
    void json;
  });

  test('8/9. the password is stored as a scrypt hash and never in plaintext', async () => {
    const body = farmerBody();
    const { json } = await postRegister(body);
    const account = accountFor(json.data.user_id);

    assert.match(account.passwordHash, /^scrypt\$v1\$\d+\$\d+\$\d+\$[^$]+\$[^$]+$/);
    assert.ok(!account.passwordHash.includes(body.password), 'no plaintext in the stored hash');
    // The serialized store must not contain the password anywhere.
    assert.ok(!JSON.stringify([...store.authAccounts.values()]).includes(body.password));
    assert.equal(await verifyPassword(body.password, account.passwordHash), true);
  });

  test('a new account uses the schema defaults and claims no verification', async () => {
    const body = farmerBody();
    const { json } = await postRegister(body);
    const account = accountFor(json.data.user_id);

    assert.equal(account.status, 'ACTIVE');
    assert.equal(account.failedAttempts, 0);
    assert.equal(account.lockedUntil, null);
    assert.equal(account.lastLoginAt, null);
    // No OTP or email verification has happened, so nothing may claim it did.
    assert.equal(account.emailVerifiedAt, null, 'email must not be marked verified');
    assert.equal(account.phoneVerifiedAt, null, 'phone must not be marked verified');
    const farmer = store.farmers.get(account.userId);
    assert.equal(farmer.kycStatus, 'PENDING', 'KYC must not be auto-verified');
    assert.equal(farmer.trustScore, 0);
  });

  test('21. registration issues no token', async () => {
    const { json, text } = await postRegister(farmerBody());
    assert.equal(json.data.access_token, undefined);
    assert.ok(!text.includes('access_token'), 'no token may appear in a register response');
    assert.ok(!text.includes('Bearer'));
  });

  test('22/23. the response leaks no hash and no AuthAccount internals', async () => {
    const { json, text } = await postRegister(farmerBody());
    for (const forbidden of [
      'password',
      'passwordHash',
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
    ]) {
      assert.ok(!text.includes(forbidden), `response must not contain ${forbidden}`);
    }
    assert.deepEqual(Object.keys(json.data).sort(), ['profile', 'role', 'user_id']);
  });
});

describe('duplicate handling', () => {
  test('10. a duplicate login identifier is a 409 that leaks nothing', async () => {
    // Both farmers share a phone (farmers.phone is NOT unique), and both use it
    // as the login identifier, so the ONLY constraint that can fire is
    // AuthAccount.identifierNormalized.
    const shared = uniquePhone('95');
    const first = farmerBody({ identifier: shared, profile: { phone: shared } });
    assert.equal((await postRegister(first)).status, 201);
    const before = { farmers: store.farmers.size, accounts: store.authAccounts.size };

    const second = farmerBody({ identifier: shared, profile: { phone: shared } });
    const { status, json, text } = await postRegister(second);

    assert.equal(status, 409);
    assert.equal(json.message, 'Identifier already registered');
    assert.deepEqual(Object.keys(json).sort(), ['message', 'status']);
    assert.ok(!/kisan|phone|email|identifierNormalized/i.test(text), `must not name the field: ${text}`);
    assert.ok(!text.includes(first.profile.email), 'must not expose another user profile');
    assert.equal(store.farmers.size, before.farmers, 'the rejected profile must not persist');
    assert.equal(store.authAccounts.size, before.accounts, 'the rejected credential must not persist');
  });

  test('11. a duplicate buyer identifier is a 409', async () => {
    const shared = uniquePhone('94');
    assert.equal((await postRegister(buyerBody({ identifier: shared, profile: { phone: shared } }))).status, 201);
    const second = buyerBody({ identifier: shared, profile: { phone: shared } });
    const { status, json } = await postRegister(second);
    assert.equal(status, 409);
    assert.equal(json.message, 'Identifier already registered');
  });

  test('an identifier owned only by another profile is a 400, not a 409', async () => {
    // The integrity gate runs before the write, so claiming somebody else's
    // Kisan ID is rejected as a bad request rather than a conflict.
    const first = farmerBody();
    assert.equal((await postRegister(first)).status, 201);
    const second = farmerBody();
    second.identifier = first.profile.kisanId;
    const { status, json } = await postRegister(second);
    assert.equal(status, 400);
    assert.match(json.message, /identifier/i);
  });

  test('12. a duplicate Kisan ID is a safe 409', async () => {
    const first = farmerBody();
    assert.equal((await postRegister(first)).status, 201);
    // A different login identifier, but the same Kisan ID on the profile.
    const second = farmerBody({ profile: { kisanId: first.profile.kisanId } });
    const { status, json } = await postRegister(second);
    assert.equal(status, 409, 'the farmers.kisanId unique constraint must reject it');
    assert.equal(json.message, 'Identifier already registered');
  });

  test('13. a duplicate GSTIN is a safe 409', async () => {
    const gstin = uniqueGstin();
    assert.equal((await postRegister(buyerBody({ gstin }))).status, 201);
    // This buyer logs in by email instead, so only the GSTIN constraint can fire.
    const second = buyerBody({ gstin });
    second.identifier = second.profile.email;
    const { status, json } = await postRegister(second);
    assert.equal(status, 409);
    assert.equal(json.message, 'Identifier already registered');
  });

  test('a duplicate profile email is a safe 409', async () => {
    const first = farmerBody();
    assert.equal((await postRegister(first)).status, 201);
    const second = farmerBody({ profile: { email: first.profile.email } });
    const { status, json } = await postRegister(second);
    assert.equal(status, 409);
    assert.equal(json.message, 'Identifier already registered');
  });

  test('a login identifier is unique across BOTH roles, not per role', async () => {
    // AuthAccount.identifierNormalized is globally unique, so a phone can be the
    // login identifier of exactly one account even though farmers.phone itself
    // is not unique. This is a schema property worth pinning.
    const shared = uniquePhone('97');
    const farmerRes = await postRegister(farmerBody({ identifier: shared, profile: { phone: shared } }));
    assert.equal(farmerRes.status, 201);

    const buyerRes = await postRegister(buyerBody({ identifier: shared, profile: { phone: shared } }));
    assert.equal(buyerRes.status, 409, 'the same identifier cannot key a second account');
    assert.equal(buyerRes.json.message, 'Identifier already registered');
  });

  test('a phone may still be reused as a plain profile field across roles', async () => {
    const shared = uniquePhone('96');
    const farmerRes = await postRegister(farmerBody({ profile: { phone: shared } }));
    const buyerRes = await postRegister(buyerBody({ profile: { phone: shared } }));
    assert.equal(farmerRes.status, 201, 'phone is not unique on the profile');
    assert.equal(buyerRes.status, 201);
  });
});

describe('transaction atomicity', () => {
  test('19. a credential failure leaves no profile behind', async () => {
    const before = { farmers: store.farmers.size, accounts: store.authAccounts.size };
    store.failNextCreate('authAccount');
    const { status } = await postRegister(farmerBody());
    assert.ok(status >= 400, `expected an error, got ${status}`);
    assert.equal(store.farmers.size, before.farmers, 'the profile must be rolled back');
    assert.equal(store.authAccounts.size, before.accounts, 'no credential may remain');
  });

  test('20. a profile failure leaves no credential behind', async () => {
    const before = { farmers: store.farmers.size, accounts: store.authAccounts.size };
    store.failNextCreate('farmer');
    const { status } = await postRegister(farmerBody());
    assert.ok(status >= 400, `expected an error, got ${status}`);
    assert.equal(store.farmers.size, before.farmers);
    assert.equal(store.authAccounts.size, before.accounts, 'no credential may exist without its profile');
  });

  test('a buyer profile failure also rolls back', async () => {
    const before = { buyers: store.buyers.size, accounts: store.authAccounts.size };
    store.failNextCreate('buyer');
    await postRegister(buyerBody());
    assert.equal(store.buyers.size, before.buyers);
    assert.equal(store.authAccounts.size, before.accounts);
  });
});

describe('a freshly registered account can log in immediately', () => {
  test('24. a newly registered farmer logs in and gets a valid token', async () => {
    const body = farmerBody();
    const registered = await postRegister(body);
    assert.equal(registered.status, 201);

    const login = await postLogin({
      role: 'farmer',
      identifier: body.identifier,
      password: body.password,
    });
    assert.equal(login.status, 200, 'registration must produce working credentials');
    assert.equal(login.json.data.user_id, registered.json.data.user_id);
  });

  test('25/26/27. the login token carries the profile sub and role', async () => {
    const body = buyerBody();
    await postRegister(body);
    const login = await postLogin({
      role: 'buyer',
      identifier: body.identifier,
      password: body.password,
    });
    assert.equal(login.status, 200);

    const { payload } = await jose.jwtVerify(
      login.json.data.access_token,
      nodeCrypto.createPublicKey(testKeys.publicKey),
      { issuer: ISSUER, audience: AUDIENCE, algorithms: ['RS256'] }
    );
    assert.equal(payload.sub, login.json.data.user_id);
    assert.equal(payload.role, 'buyer');
    assert.equal(payload.iss, ISSUER);
    assert.equal(payload.aud, AUDIENCE);
  });

  test('a farmer registered by phone can log in with that phone', async () => {
    const body = farmerBody();
    body.identifier = body.profile.phone;
    const registered = await postRegister(body);
    assert.equal(registered.status, 201);

    const login = await postLogin({ role: 'farmer', identifier: body.profile.phone, password: body.password });
    assert.equal(login.status, 200);
    assert.equal(login.json.data.user_id, registered.json.data.user_id);
  });

  test('a buyer registered by email can log in with a differently-cased email', async () => {
    const body = buyerBody();
    body.identifier = body.profile.email;
    const registered = await postRegister(body);
    assert.equal(registered.status, 201);

    const login = await postLogin({
      role: 'buyer',
      identifier: body.profile.email.toUpperCase(),
      password: body.password,
    });
    assert.equal(login.status, 200);
    assert.equal(login.json.data.user_id, registered.json.data.user_id);
  });

  test('the wrong password still fails after registration', async () => {
    const body = farmerBody();
    await postRegister(body);
    const login = await postLogin({ role: 'farmer', identifier: body.identifier, password: 'not-the-password' });
    assert.equal(login.status, 401);
    assert.equal(login.json.message, 'Invalid credentials');
  });
});

describe('the issued token satisfies the existing verifier', () => {
  test('a registered-then-logged-in farmer reaches a protected endpoint', async () => {
    const saved = env.auth0Issuer;
    env.auth0Issuer = `${baseUrl}/`;
    jwksModule.resetSigningKeyCache();
    try {
      const body = farmerBody();
      await postRegister(body);
      const login = await postLogin({ role: 'farmer', identifier: body.identifier, password: body.password });
      assert.equal(login.status, 200);

      const res = await fetch(`${baseUrl}/api/deals`, {
        headers: { Authorization: `Bearer ${login.json.data.access_token}` },
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
    } finally {
      env.auth0Issuer = saved;
      jwksModule.resetSigningKeyCache();
    }
  });
});
