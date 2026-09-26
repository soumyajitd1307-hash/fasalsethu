/**
 * Login flow tests against an in-memory Prisma stand-in.
 *
 * The authoritative coverage for login is tests/integration.authLogin.test.js,
 * which runs against a real PostgreSQL database and is BLOCKED when no
 * DATABASE_URL is present. This file exists so the login CONTROL FLOW is still
 * executed on a machine without PostgreSQL: it stubs only the four Prisma
 * calls authService makes and drives the real Express app over HTTP, so the
 * route, the zod contract, the controller, the service and the signing
 * primitive are all genuinely exercised.
 *
 * The stub deliberately emulates Prisma semantics that the service depends on:
 * a unique lookup returning null when absent, and updateMany acting as a
 * compare-and-set (the WHERE clause repeats the values that were read).
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const nodeCrypto = require('node:crypto');

// Match the other integration suites: a non-development NODE_ENV keeps the
// error handler from attaching stack traces, so response-shape assertions
// reflect what production returns.
process.env.NODE_ENV = 'test';

// This suite issues many authentication requests from a single address, so the
// production rate-limit budget would throttle it. The limiter's own behaviour
// is covered by tests/unit.rateLimit.test.js, which uses deliberately tiny
// budgets. These overrides must be set before config/env is first required.
process.env.AUTH_CREDENTIAL_RATE_LIMIT_MAX = '100000';
process.env.AUTH_TOKEN_RATE_LIMIT_MAX = '100000';

const jose = require('jose');

const { hashPassword } = require('../src/auth/password');
const { normalizeIdentifier } = require('../src/auth/identifier');
const { makeStore, PASSWORD } = require('./helpers/prisma-stub');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ISSUER = 'https://api.fasalsethu.test/';
const AUDIENCE = 'fasalsethu-api';
const KID = 'stub-login-key-1';

let app;
let server;
let baseUrl = '';
let env;
let jwksModule;
let testKeys;
let store;

async function seedFarmerAccount(overrides = {}) {
  const farmer = {
    id: store.nextId('farmer'),
    name: 'Stub Farmer',
    phone: `+9198${String(store.farmers.size + 100000000).slice(0, 8)}`,
    email: `stub-f-${store.farmers.size + 1}@example.com`,
    kisanId: `KISAN-STUB-${store.farmers.size + 1}`,
    village: null,
    district: 'Nashik',
    state: 'Maharashtra',
    kycStatus: 'PENDING',
  };
  store.farmers.set(farmer.id, farmer);

  // AuthAccount.userId is UNIQUE, so a profile has exactly ONE credential.
  // `identifierField` chooses which of the profile's identifiers keys it.
  const identifier =
    overrides.identifier || farmer[overrides.identifierField || 'kisanId'];
  const account = {
    id: store.nextId('acct'),
    userId: overrides.userId || farmer.id,
    role: 'farmer',
    identifier,
    identifierNormalized: normalizeIdentifier(identifier, 'farmer'),
    // `undefined` (not falsy) decides, so a deliberately empty stored hash stays
    // empty instead of being silently replaced with a real one.
    passwordHash: overrides.passwordHash === undefined ? await hashPassword(overrides.password || PASSWORD) : overrides.passwordHash,
    status: 'ACTIVE',
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    ...(overrides.account || {}),
  };
  if (overrides.identifierNormalized) account.identifierNormalized = overrides.identifierNormalized;
  store.authAccounts.set(account.id, account);
  return { farmer, account };
}

async function seedBuyerAccount(overrides = {}) {
  const n = store.buyers.size + 1;
  const buyer = {
    id: store.nextId('buyer'),
    name: 'Stub Buyer',
    companyName: 'Stub Foods',
    phone: `+9199${String(n + 100000000).slice(0, 8)}`,
    email: `stub-b-${n}@example.com`,
    gstin: `27ABCDE${String(n).padStart(7, '0')}`,
    district: 'Pune',
    state: 'Maharashtra',
    buyerType: 'RETAILER',
  };
  store.buyers.set(buyer.id, buyer);

  // One credential per profile; `identifierField` picks which identifier keys it.
  const identifier = overrides.identifier || buyer[overrides.identifierField || 'gstin'];
  const account = {
    id: store.nextId('acct'),
    userId: overrides.userId || buyer.id,
    role: 'buyer',
    identifier,
    identifierNormalized: normalizeIdentifier(identifier, 'buyer'),
    passwordHash: overrides.passwordHash === undefined ? await hashPassword(overrides.password || PASSWORD) : overrides.passwordHash,
    status: 'ACTIVE',
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    ...(overrides.account || {}),
  };
  if (overrides.identifierNormalized) account.identifierNormalized = overrides.identifierNormalized;
  store.authAccounts.set(account.id, account);
  return { buyer, account };
}

async function postLogin(body, headers = {}) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
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

before(async () => {
  store = makeStore();

  testKeys = nodeCrypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  // The environment must be in place BEFORE anything pulls in config/env,
  // because that module snapshots the values once at load time.
  process.env.AUTH_PRIVATE_KEY = testKeys.privateKey;
  process.env.AUTH_KEY_ID = KID;
  process.env.AUTH0_ISSUER_BASE_URL = ISSUER;
  process.env.AUTH0_AUDIENCE = AUDIENCE;
  delete process.env.AUTH_TRUSTED_ISSUERS;
  process.env.AUTH_LOCKOUT_MAX_ATTEMPTS = '3';
  process.env.AUTH_LOCKOUT_DURATION_MINUTES = '5';

  // Swap the data layer before authService is required, so the service captures
  // the stub. Cached module state is per test file, so this cannot leak into the
  // real integration suites.
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

/** Every authentication failure must look identical from outside. */
async function assertGeneric401(response, label) {
  assert.equal(response.status, 401, `${label}: expected 401`);
  assert.deepEqual(Object.keys(response.json).sort(), ['message', 'status'], `${label}: no extra fields`);
  assert.equal(response.json.message, 'Invalid credentials', `${label}: generic message`);
  assert.ok(
    !/password|hash|attempt|lock|exist|suspend|farm|buyer|role|prisma/i.test(response.text),
    `${label}: leaked detail in ${response.text}`
  );
}

describe('login request contract', () => {
  test('a bad role, a missing field or an unknown field is a 400', async () => {
    const cases = [
      { role: 'admin', identifier: 'a@example.com', password: 'pw' },
      { role: 'farmer', password: 'pw' },
      { role: 'farmer', identifier: 'a@example.com' },
      { role: 'farmer', identifier: '', password: 'pw' },
      { role: 'farmer', identifier: 'a@example.com', password: '' },
      { role: 'farmer', identifier: 'a@example.com', password: 'pw', iss: 'https://evil.example/' },
      { role: 'farmer', identifier: 'a@example.com', password: 'pw', aud: 'other' },
      { role: 'farmer', identifier: 'a@example.com', password: 'pw', sub: 'someone-else' },
    ];
    for (const body of cases) {
      const { status } = await postLogin(body);
      assert.equal(status, 400, `expected 400 for ${JSON.stringify(body)}`);
    }
  });

  test('a duplicate role key in the raw body cannot smuggle a privileged role', async () => {
    // Sent as a literal string, because a JS object literal would collapse the
    // duplicate before it ever reached the server.
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"role":"farmer","identifier":"a@example.com","password":"pw","role":"admin"}',
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(res.status, 400, 'the last role value is admin, which is not a login role');
  });

  test('the route needs no Authorization header', async () => {
    const { status, json } = await postLogin({ role: 'farmer', identifier: 'ghost@example.com', password: 'pw' });
    assert.equal(status, 401);
    assert.equal(json.message, 'Invalid credentials');
  });
});

describe('successful login', () => {
  test('1. a farmer logs in with a Kisan ID and receives a usable token', async () => {
    const { farmer, account } = await seedFarmerAccount();
    const { status, json } = await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: PASSWORD });

    assert.equal(status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.role, 'farmer');
    assert.equal(json.data.user_id, farmer.id);
    assert.equal(json.data.token_type, 'Bearer');
    assert.equal(json.data.expires_in, env.accessTokenTtlSeconds);
    assert.equal(json.data.profile.id, farmer.id);
    assert.equal(json.data.profile.kisanId, farmer.kisanId);
    assert.equal(json.data.profile.district, 'Nashik');
    void account;
  });

  test('a farmer logs in with a mobile number', async () => {
    // The schema allows one credential per profile, so this profile's single
    // credential is keyed by its phone rather than its Kisan ID.
    const { farmer } = await seedFarmerAccount({ identifierField: 'phone' });
    const { status, json } = await postLogin({ role: 'farmer', identifier: farmer.phone, password: PASSWORD });
    assert.equal(status, 200);
    assert.equal(json.data.user_id, farmer.id);
  });

  test('2. a buyer logs in with a GSTIN', async () => {
    const { buyer } = await seedBuyerAccount();
    const { status, json } = await postLogin({ role: 'buyer', identifier: buyer.gstin, password: PASSWORD });
    assert.equal(status, 200);
    assert.equal(json.data.role, 'buyer');
    assert.equal(json.data.user_id, buyer.id);
    assert.equal(json.data.profile.gstin, buyer.gstin);
    assert.equal(json.data.profile.companyName, 'Stub Foods');
  });

  test('a buyer email login is case-insensitive', async () => {
    const { buyer } = await seedBuyerAccount({ identifierField: 'email' });
    const { status, json } = await postLogin({
      role: 'buyer',
      identifier: buyer.email.toUpperCase(),
      password: PASSWORD,
    });
    assert.equal(status, 200);
    assert.equal(json.data.user_id, buyer.id);
  });

  test('15. a successful login stamps lastLoginAt', async () => {
    const { farmer, account } = await seedFarmerAccount();
    assert.equal(account.lastLoginAt, null);
    await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: PASSWORD });
    assert.ok(store.authAccounts.get(account.id).lastLoginAt instanceof Date);
  });
});

describe('generic authentication failures', () => {
  test('3. a wrong password is a generic 401', async () => {
    const { farmer } = await seedFarmerAccount();
    await assertGeneric401(
      await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: 'wrong-password' }),
      'wrong password'
    );
  });

  test('4. an unknown identifier returns a byte-identical response', async () => {
    const { farmer } = await seedFarmerAccount();
    const wrongPassword = await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: 'wrong-password' });
    const unknown = await postLogin({ role: 'farmer', identifier: 'ghost-nobody@example.com', password: 'wrong-password' });
    await assertGeneric401(unknown, 'unknown identifier');
    assert.equal(wrongPassword.text, unknown.text, 'the two responses must be indistinguishable');
  });

  test('5. an inactive account is indistinguishable', async () => {
    const { farmer } = await seedFarmerAccount({ account: { status: 'SUSPENDED' } });
    await assertGeneric401(
      await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: PASSWORD }),
      'inactive account'
    );
  });

  test('6. a locked account is indistinguishable', async () => {
    const { farmer } = await seedFarmerAccount({ account: { lockedUntil: new Date(Date.now() + 3600_000) } });
    await assertGeneric401(
      await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: PASSWORD }),
      'locked account'
    );
  });

  test('7. a malformed stored hash fails safely with the same 401', async () => {
    for (const bad of ['not-a-hash', 'scrypt$v1$broken', 'scrypt$v1$1$1$1$aaaa$bbbb', '']) {
      const { farmer } = await seedFarmerAccount({ passwordHash: bad });
      await assertGeneric401(
        await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: PASSWORD }),
        `malformed hash ${JSON.stringify(bad)}`
      );
    }
  });

  test('8. a farmer credential cannot authenticate as a buyer', async () => {
    const { farmer } = await seedFarmerAccount();
    await assertGeneric401(
      await postLogin({ role: 'buyer', identifier: farmer.kisanId, password: PASSWORD }),
      'farmer credential as buyer'
    );
  });

  test('9. a buyer credential cannot authenticate as a farmer', async () => {
    const { buyer } = await seedBuyerAccount();
    await assertGeneric401(
      await postLogin({ role: 'farmer', identifier: buyer.gstin, password: PASSWORD }),
      'buyer credential as farmer'
    );
  });

  test('an account pointing at a non-existent profile is refused', async () => {
    await seedFarmerAccount({ identifier: 'orphan@example.com', account: { userId: 'clx0missing' } });
    await assertGeneric401(
      await postLogin({ role: 'farmer', identifier: 'orphan@example.com', password: PASSWORD }),
      'missing profile'
    );
  });

  test('a farmer account pointing at a buyer id is refused', async () => {
    const { buyer } = await seedBuyerAccount();
    await seedFarmerAccount({ identifier: 'mismatch@example.com', account: { userId: buyer.id } });
    await assertGeneric401(
      await postLogin({ role: 'farmer', identifier: 'mismatch@example.com', password: PASSWORD }),
      'role/profile mismatch'
    );
  });

  test('a credential whose identifier is not the profile\'s is refused', async () => {
    const { farmer } = await seedFarmerAccount();
    // Same profile, but the account claims a different identifier.
    await seedFarmerAccount({ identifier: 'someone-else@example.com', account: { userId: farmer.id } });
    await assertGeneric401(
      await postLogin({ role: 'farmer', identifier: 'someone-else@example.com', password: PASSWORD }),
      'identifier not owned by the profile'
    );
  });

  test('x-user-id cannot authenticate', async () => {
    const { farmer } = await seedFarmerAccount();
    const res = await postLogin(
      { role: 'farmer', identifier: 'ghost-nobody@example.com', password: 'pw' },
      { 'x-user-id': farmer.id, 'x-user-role': 'admin' }
    );
    await assertGeneric401(res, 'x-user-id header');
  });

  test('login never creates an account', async () => {
    const before = store.authAccounts.size;
    await postLogin({ role: 'farmer', identifier: 'never-seen@example.com', password: 'pw' });
    assert.equal(store.authAccounts.size, before);
  });
});

describe('lockout policy', () => {
  test('12/13. failures increment the counter, then lock and reset it', async () => {
    const { farmer, account } = await seedFarmerAccount();
    const threshold = env.authLockoutMaxAttempts;

    for (let attempt = 1; attempt < threshold; attempt += 1) {
      await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: 'wrong' });
      assert.equal(store.authAccounts.get(account.id).failedAttempts, attempt, `counter after ${attempt} failures`);
      assert.equal(store.authAccounts.get(account.id).lockedUntil, null, 'no lock before the threshold');
    }

    await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: 'wrong' });
    const row = store.authAccounts.get(account.id);
    assert.ok(row.lockedUntil instanceof Date, 'lockedUntil must be set at the threshold');
    assert.equal(row.failedAttempts, 0, 'the counter resets, keeping the lockout bounded');

    // Even the correct password is refused, identically.
    await assertGeneric401(
      await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: PASSWORD }),
      'locked out'
    );
  });

  test('14. a lock stops applying once it expires', async () => {
    const { farmer, account } = await seedFarmerAccount({ account: { lockedUntil: new Date(Date.now() + 300_000) } });
    assert.equal((await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: PASSWORD })).status, 401);

    store.authAccounts.get(account.id).lockedUntil = new Date(Date.now() - 1000);
    const allowed = await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: PASSWORD });
    assert.equal(allowed.status, 200, 'an expired lock must allow the correct password');
    assert.equal(allowed.json.data.user_id, farmer.id);
  });

  test('10/11. a successful login resets the counter and clears the lock', async () => {
    const { farmer, account } = await seedFarmerAccount({ account: { failedAttempts: 2 } });
    store.authAccounts.get(account.id).lockedUntil = new Date(Date.now() - 1000);

    const { status } = await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: PASSWORD });
    assert.equal(status, 200);
    assert.equal(store.authAccounts.get(account.id).failedAttempts, 0);
    assert.equal(store.authAccounts.get(account.id).lockedUntil, null);
  });

  test('a failure against an unknown identifier touches no account', async () => {
    const before = JSON.stringify([...store.authAccounts.values()].map((a) => ({ id: a.id, f: a.failedAttempts })));
    await postLogin({ role: 'farmer', identifier: 'nobody-at-all@example.com', password: 'wrong' });
    const after = JSON.stringify([...store.authAccounts.values()].map((a) => ({ id: a.id, f: a.failedAttempts })));
    assert.equal(after, before, 'no counter may move for an unknown identifier');
  });
});

describe('issued token', () => {
  async function loginFarmer() {
    const { farmer, account } = await seedFarmerAccount();
    const res = await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: PASSWORD });
    assert.equal(res.status, 200);
    const [h, p] = res.json.data.access_token.split('.');
    return {
      farmer,
      account,
      data: res.json.data,
      header: JSON.parse(Buffer.from(h, 'base64url').toString()),
      payload: JSON.parse(Buffer.from(p, 'base64url').toString()),
    };
  }

  test('16/17. sub is the profile id and role is the account role', async () => {
    const { payload, farmer } = await loginFarmer();
    assert.equal(payload.sub, farmer.id);
    assert.equal(payload.role, 'farmer');
  });

  test('18/19. iss and aud come from configuration', async () => {
    const { payload } = await loginFarmer();
    assert.equal(payload.iss, ISSUER);
    assert.equal(payload.aud, AUDIENCE);
  });

  test('20. the token is RS256 under the configured kid and verifies', async () => {
    const { header, data } = await loginFarmer();
    assert.equal(header.alg, 'RS256');
    assert.equal(header.kid, KID);
    const { payload } = await jose.jwtVerify(data.access_token, nodeCrypto.createPublicKey(testKeys.publicKey), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['RS256'],
    });
    assert.equal(payload.role, 'farmer');
  });

  test('10/11. iat/exp are present and the configured TTL is applied', async () => {
    const { payload } = await loginFarmer();
    assert.equal(typeof payload.iat, 'number');
    assert.equal(typeof payload.exp, 'number');
    assert.equal(payload.exp - payload.iat, env.accessTokenTtlSeconds);
  });

  test('a buyer token carries the buyer identity', async () => {
    const { buyer } = await seedBuyerAccount();
    const { status, json } = await postLogin({ role: 'buyer', identifier: buyer.gstin, password: PASSWORD });
    assert.equal(status, 200);
    const payload = JSON.parse(Buffer.from(json.data.access_token.split('.')[1], 'base64url').toString());
    assert.equal(payload.sub, buyer.id);
    assert.equal(payload.role, 'buyer');
  });

  test('21/22. the response leaks no password hash or AuthAccount internals', async () => {
    const { data } = await loginFarmer();
    const flat = JSON.stringify(data);
    for (const forbidden of [
      'passwordHash',
      'password',
      'identifierNormalized',
      'failedAttempts',
      'lockedUntil',
      'lastLoginAt',
      'PRIVATE',
      'BEGIN',
    ]) {
      assert.ok(!flat.includes(forbidden), `response must not contain ${forbidden}`);
    }
    // Nor may the account's raw identifier leak beyond the profile's own field.
    assert.ok(!Object.prototype.hasOwnProperty.call(data, 'account'));
  });

  test('23. a missing signing key fails with 503 and issues no token', async () => {
    const { farmer } = await seedFarmerAccount();
    const saved = env.authPrivateKey;
    try {
      env.authPrivateKey = null;
      jwksModule.resetSigningKeyCache();
      const { status, text } = await postLogin({
        role: 'farmer',
        identifier: farmer.kisanId,
        password: PASSWORD,
      });
      assert.equal(status, 503);
      assert.ok(!text.includes('access_token'), 'no token may be issued');
      assert.ok(!text.includes('BEGIN'), 'no key material may leak');
    } finally {
      env.authPrivateKey = saved;
      jwksModule.resetSigningKeyCache();
    }
  });
});

describe('the issued token satisfies the existing verifier and B3 authorization', () => {
  /**
   * Points the configured issuer at this test server for the duration of `fn`,
   * so the verifier's derived JWKS URL (<issuer>/.well-known/jwks.json) actually
   * resolves. Signing uses the same value, so the token verifies.
   */
  async function withSelfHostedIssuer(fn) {
    const saved = env.auth0Issuer;
    env.auth0Issuer = `${baseUrl}/`;
    jwksModule.resetSigningKeyCache();
    try {
      return await fn();
    } finally {
      env.auth0Issuer = saved;
      jwksModule.resetSigningKeyCache();
    }
  }

  test('24. requireAuth accepts a token issued by login', async () => {
    await withSelfHostedIssuer(async () => {
      const { farmer } = await seedFarmerAccount();
      const login = await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: PASSWORD });
      assert.equal(login.status, 200);
      assert.equal(login.json.payload, undefined);

      const res = await fetch(`${baseUrl}/api/deals`, {
        headers: { Authorization: `Bearer ${login.json.data.access_token}` },
        signal: AbortSignal.timeout(20000),
      });
      // The DB is stubbed, so a 200 proves authentication AND authorization
      // succeeded end to end through the untouched middleware.
      assert.equal(res.status, 200, `expected 200, got ${res.status}`);
      const body = await res.json();
      assert.equal(body.success, true);
    });
  });

  test('25. B3 scopes the issued identity to its own records only', async () => {
    await withSelfHostedIssuer(async () => {
      const { farmer } = await seedFarmerAccount();
      const other = await seedFarmerAccount();
      const login = await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: PASSWORD });
      const auth = { Authorization: `Bearer ${login.json.data.access_token}` };

      // Another farmer's history is refused by the unchanged middleware.
      const forbidden = await fetch(`${baseUrl}/api/deals/farmer/${other.farmer.id}`, {
        headers: auth,
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(forbidden.status, 403);

      // A farmer token cannot read buyer history.
      const crossRole = await fetch(`${baseUrl}/api/deals/buyer/anything`, {
        headers: auth,
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(crossRole.status, 403);
    });
  });

  test('a token minted for one farmer cannot act as another', async () => {
    await withSelfHostedIssuer(async () => {
      const a = await seedFarmerAccount();
      const b = await seedFarmerAccount();
      const login = await postLogin({ role: 'farmer', identifier: a.farmer.kisanId, password: PASSWORD });
      const res = await fetch(`${baseUrl}/api/deals/farmer/${b.farmer.id}`, {
        headers: { Authorization: `Bearer ${login.json.data.access_token}` },
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(res.status, 403, 'the token must be bound to its own profile');
    });
  });

  test('the trusted-issuer rules still apply to an issued token', async () => {
    await withSelfHostedIssuer(async () => {
      const { farmer } = await seedFarmerAccount();
      const login = await postLogin({ role: 'farmer', identifier: farmer.kisanId, password: PASSWORD });
      const savedIssuers = env.authTrustedIssuers;
      try {
        // Drop our own issuer from the trusted set: the token must stop working.
        env.authTrustedIssuers = ['https://someone-else.example/'];
        const res = await fetch(`${baseUrl}/api/deals`, {
          headers: { Authorization: `Bearer ${login.json.data.access_token}` },
          signal: AbortSignal.timeout(20000),
        });
        assert.equal(res.status, 401);
      } finally {
        env.authTrustedIssuers = savedIssuers;
      }
    });
  });
});
