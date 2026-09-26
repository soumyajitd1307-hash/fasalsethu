/**
 * Registration integration tests against a real PostgreSQL database.
 *
 * PostgreSQL-only, so this follows the same SKIP_DB convention as the other
 * integration suites: with no DATABASE_URL it reports as BLOCKED rather than
 * passing vacuously. The stub suite (unit.authRegisterStub.test.js) covers the
 * same request path without a database; this file is the authoritative check
 * that the real unique constraints and the real interactive transaction behave
 * as the service assumes.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const nodeCrypto = require('node:crypto');

const jose = require('jose');

const { normalizeIdentifier } = require('../src/auth/identifier');
const { verifyPassword } = require('../src/auth/password');

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
const KID = 'register-test-key-1';
const TS = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

let app;
let server;
let baseUrl = '';
let prisma;
let testKeys;
let n = 0;

const created = { farmers: [], buyers: [], accounts: [] };

function uniq() {
  n += 1;
  return `${TS}${n}`;
}

function uniqueGstin() {
  return `27ABCDE${String(1000 + n).slice(-4)}F1ZQ`;
}

function uniquePhone(prefix) {
  return `+91${prefix}${String(10000000 + Math.floor(Math.random() * 89999999)).slice(0, 8)}`;
}

function farmerBody(overrides = {}) {
  const tag = uniq();
  return {
    role: 'farmer',
    identifier: `KISAN-REG-${tag}`,
    password: 'a-strong-password',
    ...overrides,
    profile: {
      name: 'Registering Farmer',
      phone: uniquePhone('98'),
      email: `reg-f-${tag}@example.com`,
      kisanId: `KISAN-REG-${tag}`,
      district: 'Nashik',
      state: 'Maharashtra',
      ...(overrides.profile || {}),
    },
  };
}

function buyerBody(overrides = {}) {
  const tag = uniq();
  const gstin = overrides.gstin || uniqueGstin();
  return {
    role: 'buyer',
    identifier: gstin,
    password: 'a-strong-password',
    ...overrides,
    profile: {
      name: 'Registering Buyer',
      companyName: 'Reg Foods Pvt Ltd',
      phone: uniquePhone('99'),
      email: `reg-b-${tag}@example.com`,
      gstin,
      district: 'Pune',
      state: 'Maharashtra',
      ...(overrides.profile || {}),
    },
  };
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

async function track(result) {
  if (result.status === 201) {
    const account = await prisma.authAccount.findUnique({ where: { userId: result.json.data.user_id } });
    if (account) created.accounts.push(account.id);
    if (result.json.data.role === 'farmer') created.farmers.push(result.json.data.user_id);
    else created.buyers.push(result.json.data.user_id);
  }
  return result;
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

describe('POST /api/auth/register — request contract', { skip: SKIP_DB }, () => {
  test('an unsupported role, a weak password and unknown fields are 400', async () => {
    for (const role of ['admin', 'FARMER', '']) {
      const body = farmerBody();
      body.role = role;
      assert.equal((await postRegister(body)).status, 400, `role ${role}`);
    }
    const weak = farmerBody();
    weak.password = 'short';
    assert.equal((await postRegister(weak)).status, 400, 'weak password');

    const extra = { ...farmerBody(), isAdmin: true };
    assert.equal((await postRegister(extra)).status, 400, 'unknown top-level field');
    const trust = farmerBody({ profile: { trustScore: 100 } });
    assert.equal((await postRegister(trust)).status, 400, 'trustScore');
    const kyc = farmerBody({ profile: { kycStatus: 'VERIFIED' } });
    assert.equal((await postRegister(kyc)).status, 400, 'kycStatus');
    const clientId = farmerBody({ profile: { id: 'chosen-by-client' } });
    assert.equal((await postRegister(clientId)).status, 400, 'client-supplied id');
  });

  test('an identifier that belongs to no profile identifier is 400', async () => {
    const body = farmerBody();
    body.identifier = 'NOT-ON-THE-PROFILE';
    const before = await prisma.farmer.count();
    const { status, json } = await postRegister(body);
    assert.equal(status, 400);
    assert.match(json.message, /identifier/i);
    assert.equal(await prisma.farmer.count(), before, 'nothing may be persisted');
  });
});

describe('POST /api/auth/register — success', { skip: SKIP_DB }, () => {
  test('1/3/5/6. a farmer registers with a matching credential', async () => {
    const body = farmerBody();
    const { status, json } = await track(await postRegister(body));
    assert.equal(status, 201);
    assert.equal(json.success, true);
    assert.equal(json.data.role, 'farmer');

    const farmer = await prisma.farmer.findUnique({ where: { id: json.data.user_id } });
    assert.ok(farmer, 'the profile must exist');
    const account = await prisma.authAccount.findUnique({ where: { userId: farmer.id } });
    assert.ok(account, 'exactly one credential per profile');
    assert.equal(account.role, 'farmer');
    assert.equal(account.identifierNormalized, normalizeIdentifier(body.identifier, 'farmer'));
  });

  test('2/4. a buyer registers with a matching credential', async () => {
    const body = buyerBody();
    const { status, json } = await track(await postRegister(body));
    assert.equal(status, 201);
    assert.equal(json.data.role, 'buyer');

    const buyer = await prisma.buyer.findUnique({ where: { id: json.data.user_id } });
    const account = await prisma.authAccount.findUnique({ where: { userId: buyer.id } });
    assert.ok(account);
    assert.equal(account.role, 'buyer');
    assert.equal(account.identifierNormalized, normalizeIdentifier(body.identifier, 'buyer'));
  });

  test('7. identifierNormalized matches login normalization', async () => {
    const body = buyerBody();
    body.identifier = body.profile.email.toUpperCase();
    const { status, json } = await track(await postRegister(body));
    assert.equal(status, 201);
    const account = await prisma.authAccount.findUnique({ where: { userId: json.data.user_id } });
    assert.equal(account.identifierNormalized, body.profile.email.toLowerCase());
  });

  test('8/9. the password is stored hashed, never in plaintext', async () => {
    const body = farmerBody();
    const { json } = await track(await postRegister(body));
    const account = await prisma.authAccount.findUnique({ where: { userId: json.data.user_id } });
    assert.match(account.passwordHash, /^scrypt\$v1\$\d+\$\d+\$\d+\$[^$]+\$[^$]+$/);
    assert.ok(!account.passwordHash.includes(body.password));
    assert.equal(await verifyPassword(body.password, account.passwordHash), true);
  });

  test('a new account uses schema defaults and claims no verification', async () => {
    const { json } = await track(await postRegister(farmerBody()));
    const account = await prisma.authAccount.findUnique({ where: { userId: json.data.user_id } });
    assert.equal(account.status, 'ACTIVE');
    assert.equal(account.failedAttempts, 0);
    assert.equal(account.lockedUntil, null);
    assert.equal(account.lastLoginAt, null);
    assert.equal(account.emailVerifiedAt, null, 'no email verification may be claimed');
    assert.equal(account.phoneVerifiedAt, null, 'no phone verification may be claimed');
    const farmer = await prisma.farmer.findUnique({ where: { id: json.data.user_id } });
    assert.equal(farmer.kycStatus, 'PENDING');
  });

  test('21/22/23. the response carries no token, hash or account internals', async () => {
    const { json, text } = await track(await postRegister(farmerBody()));
    assert.deepEqual(Object.keys(json.data).sort(), ['profile', 'role', 'user_id']);
    for (const forbidden of ['access_token', 'passwordHash', 'identifierNormalized', 'failedAttempts', 'lockedUntil', 'PRIVATE']) {
      assert.ok(!text.includes(forbidden), `must not contain ${forbidden}`);
    }
  });
});

describe('POST /api/auth/register — duplicates', { skip: SKIP_DB }, () => {
  test('10/11. a duplicate login identifier is a 409 that leaks nothing', async () => {
    const shared = uniquePhone('95');
    await track(await postRegister(farmerBody({ identifier: shared, profile: { phone: shared } })));
    const before = await prisma.farmer.count();
    const { status, json, text } = await postRegister(farmerBody({ identifier: shared, profile: { phone: shared } }));
    assert.equal(status, 409);
    assert.equal(json.message, 'Identifier already registered');
    assert.ok(!/phone|email|kisan/i.test(text), `must not name the field: ${text}`);
    assert.equal(await prisma.farmer.count(), before, 'the rejected profile must not persist');
  });

  test('12. a duplicate Kisan ID is a safe 409', async () => {
    const first = farmerBody();
    await track(await postRegister(first));
    const { status, json } = await postRegister(farmerBody({ profile: { kisanId: first.profile.kisanId } }));
    assert.equal(status, 409);
    assert.equal(json.message, 'Identifier already registered');
  });

  test('13. a duplicate GSTIN is a safe 409', async () => {
    const gstin = uniqueGstin();
    await track(await postRegister(buyerBody({ gstin })));
    const second = buyerBody({ gstin });
    second.identifier = second.profile.email; // only the GSTIN constraint can fire
    const { status, json } = await postRegister(second);
    assert.equal(status, 409);
    assert.equal(json.message, 'Identifier already registered');
  });

  test('a duplicate profile email is a safe 409', async () => {
    const first = farmerBody();
    await track(await postRegister(first));
    const { status } = await postRegister(farmerBody({ profile: { email: first.profile.email } }));
    assert.equal(status, 409);
  });
});

describe('POST /api/auth/register — atomicity', { skip: SKIP_DB }, () => {
  test('19. a credential failure leaves no profile behind', async () => {
    const before = await prisma.farmer.count();
    // Force the credential write to fail on a duplicate that the integrity gate
    // cannot catch: a pre-existing account for a DIFFERENT user with the same
    // normalized identifier is impossible, so instead collide on userId by
    // reusing an existing profile id through a crafted duplicate.
    const body = farmerBody();
    await track(await postRegister(body));

    // Re-register the identical body: the profile insert succeeds, then the
    // AuthAccount insert violates identifierNormalized, so the whole
    // transaction must roll back and no second profile may remain.
    const beforeAfter = await prisma.farmer.count();
    const retry = farmerBody();
    retry.identifier = body.identifier;
    retry.profile.kisanId = body.profile.kisanId;
    const { status } = await postRegister(retry);
    assert.equal(status, 409);
    assert.equal(await prisma.farmer.count(), beforeAfter, 'the rolled-back profile must not persist');
    void before;
  });

  test('20. a profile failure leaves no credential behind', async () => {
    const before = await prisma.authAccount.count();
    // A GSTIN that passes validation but violates the buyers.gstin unique
    // constraint aborts the transaction after nothing else has been written.
    const gstin = uniqueGstin();
    await track(await postRegister(buyerBody({ gstin })));
    const accountsBefore = await prisma.authAccount.count();
    const second = buyerBody({ gstin });
    second.identifier = second.profile.email;
    assert.equal((await postRegister(second)).status, 409);
    assert.equal(await prisma.authAccount.count(), accountsBefore, 'no extra credential may persist');
    void before;
  });
});

describe('a registered account can log in immediately', { skip: SKIP_DB }, () => {
  test('24. a newly registered farmer logs in', async () => {
    const body = farmerBody();
    const registered = await track(await postRegister(body));
    assert.equal(registered.status, 201);
    const login = await postLogin({ role: 'farmer', identifier: body.identifier, password: body.password });
    assert.equal(login.status, 200);
    assert.equal(login.json.data.user_id, registered.json.data.user_id);
  });

  test('25/26/27. the issued token carries the profile sub and role', async () => {
    const body = buyerBody();
    await track(await postRegister(body));
    const login = await postLogin({ role: 'buyer', identifier: body.identifier, password: body.password });
    assert.equal(login.status, 200);
    const { payload } = await jose.jwtVerify(login.json.data.access_token, nodeCrypto.createPublicKey(testKeys.publicKey), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['RS256'],
    });
    assert.equal(payload.sub, login.json.data.user_id);
    assert.equal(payload.role, 'buyer');
  });

  test('a wrong password still fails after registration', async () => {
    const body = farmerBody();
    await track(await postRegister(body));
    const login = await postLogin({ role: 'farmer', identifier: body.identifier, password: 'not-the-password' });
    assert.equal(login.status, 401);
    assert.equal(login.json.message, 'Invalid credentials');
  });
});
