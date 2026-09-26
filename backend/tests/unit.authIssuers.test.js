// Trusted-issuer verification tests.
//
// Extends — never replaces — tests/unit.auth.test.js, which still covers the
// single-issuer path end to end. Here several local JWKS servers stand in for
// several issuers that all share one audience, plus the explicit-JWKS-URI and
// fail-closed paths. RS256 only, exact issuer matching, audience enforced.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const { createHarness } = require('./helpers/jwt-test-server');

// Load backend/.env (if present) so DB availability never depends on require
// order. dotenv never overrides real environment variables, and the Auth0 test
// env below is applied in `before` before the app is required.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
// These tests are not DB-gated: a request that authenticates successfully
// answers 200 with a database and 503 with the "Database not configured"
// error without one, and both outcomes are asserted precisely below.
const HAVE_DB = !!process.env.DATABASE_URL;

const AUDIENCE = 'trusted-issuers-audience';
const UNRESOLVABLE_ISSUER = 'https://issuer.invalid/';

let app;
let server;
let baseUrl = '';
let primary;
let second;
let outsider;
let env;
let auth;

async function api(pathname, headers = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, { headers, signal: AbortSignal.timeout(15000) });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

/**
 * A request that authenticated successfully but then hit the missing database
 * answers 503 with a *Database* message; a 503 raised by the auth layer says
 * *Authentication*. Keeping the two distinguishable is what lets these tests
 * assert fail-closed behaviour precisely.
 */
function assertAuthenticated(status, json, label) {
  if (HAVE_DB) {
    assert.equal(status, 200, `${label}: expected 200`);
  } else {
    assert.equal(status, 503, `${label}: expected 503 from the missing database`);
    assert.match(json.message, /Database not configured/, `${label}: must be the DB error, not the auth error`);
  }
}

function snapshotEnv() {
  return {
    auth0Issuer: env.auth0Issuer,
    auth0JwksUri: env.auth0JwksUri,
    authTrustedIssuers: env.authTrustedIssuers,
  };
}

function restoreEnv(saved) {
  env.auth0Issuer = saved.auth0Issuer;
  env.auth0JwksUri = saved.auth0JwksUri;
  env.authTrustedIssuers = saved.authTrustedIssuers;
}

/**
 * Boots the real Express app in a child process with an exact set of auth
 * variables (undefined entries are removed), proving the server starts for
 * deployments that set only the pre-existing variables.
 */
function bootWithEnv(vars) {
  const childEnv = { ...process.env };
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete childEnv[key];
    else childEnv[key] = value;
  }
  return spawnSync(
    process.execPath,
    ['-e', "const a=require('./src/app');console.log(a?'booted':'?')"],
    { cwd: path.join(__dirname, '..'), env: childEnv, encoding: 'utf8' }
  );
}

before(async () => {
  primary = await createHarness({ audience: AUDIENCE });
  second = await createHarness({ audience: AUDIENCE });
  outsider = await createHarness({ audience: AUDIENCE });

  // Padding whitespace and an empty entry are deliberate: parsing must trim
  // them away rather than treating them as an issuer.
  process.env.AUTH0_ISSUER_BASE_URL = primary.issuer;
  process.env.AUTH0_AUDIENCE = AUDIENCE;
  process.env.AUTH_TRUSTED_ISSUERS = `  ${primary.issuer} , ,${second.issuer}  `;

  // Require AFTER env is set so config picks up the test issuer/audience.
  app = require('../src/app');
  env = require('../src/config/env');
  auth = require('../src/middleware/auth');

  const http = require('node:http');
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
  if (primary) await primary.close();
  if (second) await second.close();
  if (outsider) await outsider.close();
});

describe('trusted issuer configuration', () => {
  test('the configured list is parsed, trimmed, de-duplicated and canonical', () => {
    const { parseTrustedIssuers } = require('../src/config/env');
    assert.deepEqual(
      parseTrustedIssuers(' https://a.example/ , https://b.example/ ,, https://a.example/ '),
      ['https://a.example/', 'https://b.example/']
    );
    // A missing trailing slash is canonicalised so matching stays exact.
    assert.deepEqual(parseTrustedIssuers('https://a.example'), ['https://a.example/']);
  });

  test('an empty or absent list is not an error', () => {
    const { parseTrustedIssuers } = require('../src/config/env');
    assert.deepEqual(parseTrustedIssuers(undefined), []);
    assert.deepEqual(parseTrustedIssuers(''), []);
    assert.deepEqual(parseTrustedIssuers('   ,  , '), []);
  });

  test('a malformed issuer entry is rejected instead of silently dropped', () => {
    const { parseTrustedIssuers } = require('../src/config/env');
    for (const bad of ['not-a-url', 'ftp://x.example/', 'javascript:alert(1)', '/relative']) {
      assert.throws(
        () => parseTrustedIssuers(`https://good.example/, ${bad}`),
        /AUTH_TRUSTED_ISSUERS/,
        `expected rejection of ${JSON.stringify(bad)}`
      );
    }
    // The valid neighbour must not smuggle the bad entry through.
    assert.throws(() => parseTrustedIssuers(`https://good.example/, nope`), /AUTH_TRUSTED_ISSUERS/);
  });

  test('a malformed AUTH_TRUSTED_ISSUERS stops the process from booting', () => {
    const target = path.join(__dirname, '..', 'src', 'config', 'env.js');
    const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(target)})`], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, AUTH_TRUSTED_ISSUERS: 'https://good.example/, not-a-url' },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, 'expected a non-zero exit while loading configuration');
    assert.match(result.stderr, /AUTH_TRUSTED_ISSUERS/);
  });

  test('a well-formed AUTH_TRUSTED_ISSUERS boots cleanly', () => {
    const target = path.join(__dirname, '..', 'src', 'config', 'env.js');
    const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(target)})`], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, AUTH_TRUSTED_ISSUERS: 'https://a.example/, https://b.example/' },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `expected a clean boot, got: ${result.stderr}`);
  });

  test('the app still builds with only the pre-existing Auth0 variables', () => {
    const result = bootWithEnv({
      AUTH0_ISSUER_BASE_URL: 'https://tenant.example/',
      AUTH0_AUDIENCE: 'fasalsethu-api',
      AUTH_TRUSTED_ISSUERS: undefined,
      AUTH0_JWKS_URI: undefined,
      AUTH_PRIVATE_KEY: undefined,
      AUTH_KEY_ID: undefined,
      ACCESS_TOKEN_TTL_SECONDS: undefined,
      REFRESH_TOKEN_TTL_DAYS: undefined,
    });
    assert.equal(result.status, 0, `expected a clean boot, got: ${result.stderr}`);
  });

  test('the app still builds with no authentication variables at all', () => {
    const result = bootWithEnv({
      AUTH0_ISSUER_BASE_URL: undefined,
      AUTH0_AUDIENCE: undefined,
      AUTH_TRUSTED_ISSUERS: undefined,
      AUTH0_JWKS_URI: undefined,
    });
    assert.equal(result.status, 0, `expected a clean boot, got: ${result.stderr}`);
    // Booting is not authentication: with nothing configured the verifier has
    // no issuer to trust and must fail closed per request (covered separately).
    const config = require('../src/config/env');
    const saved = snapshotEnv();
    try {
      env.authTrustedIssuers = [];
      env.auth0Issuer = null;
      assert.deepEqual(auth.trustedIssuers(), []);
    } finally {
      restoreEnv(saved);
      void config;
    }
  });

  test('the new lifetimes and key settings default without being configured', () => {
    const target = path.join(__dirname, '..', 'src', 'config', 'env.js');
    const result = spawnSync(
      process.execPath,
      ['-e', `const e=require(${JSON.stringify(target)});console.log(JSON.stringify({a:e.accessTokenTtlSeconds,r:e.refreshTokenTtlDays,k:e.authPrivateKey,i:e.authKeyId,j:e.auth0JwksUri,t:e.authTrustedIssuers}))`],
      {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          AUTH0_ISSUER_BASE_URL: undefined,
          AUTH_TRUSTED_ISSUERS: undefined,
          AUTH0_JWKS_URI: undefined,
          AUTH_PRIVATE_KEY: undefined,
          AUTH_KEY_ID: undefined,
          ACCESS_TOKEN_TTL_SECONDS: undefined,
          REFRESH_TOKEN_TTL_DAYS: undefined,
        },
        encoding: 'utf8',
      }
    );
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(result.stdout.trim());
    assert.deepEqual(config, {
      a: 3600,
      r: 30,
      k: null,
      i: null,
      j: null,
      t: [],
    });
  });

  test('a non-positive or non-integer lifetime is rejected at configuration load', () => {
    const target = path.join(__dirname, '..', 'src', 'config', 'env.js');
    for (const bad of ['0', '-1', '1.5', 'soon']) {
      const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(target)})`], {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, ACCESS_TOKEN_TTL_SECONDS: bad },
        encoding: 'utf8',
      });
      assert.notEqual(result.status, 0, `expected rejection of ${JSON.stringify(bad)}`);
      assert.match(result.stderr, /ACCESS_TOKEN_TTL_SECONDS/);
    }
  });

  test('AUTH_TRUSTED_ISSUERS replaces the single issuer when present', () => {
    const saved = snapshotEnv();
    try {
      // Only the outsider is trusted: the primary issuer must stop working.
      env.authTrustedIssuers = [outsider.issuer];
      assert.deepEqual(auth.trustedIssuers(), [outsider.issuer]);
      // With the list emptied, the original single-issuer behaviour returns.
      env.authTrustedIssuers = [];
      assert.deepEqual(auth.trustedIssuers(), [primary.issuer]);
    } finally {
      restoreEnv(saved);
    }
  });
});

describe('JWKS resolution', () => {
  test('the JWKS URL is derived from the issuer when none is configured', () => {
    const saved = snapshotEnv();
    try {
      env.auth0JwksUri = null;
      assert.equal(auth.jwksUrlForIssuer('https://tenant.example/'), 'https://tenant.example/.well-known/jwks.json');
      // An issuer without a trailing slash resolves identically.
      assert.equal(auth.jwksUrlForIssuer('https://tenant.example'), 'https://tenant.example/.well-known/jwks.json');
      // A trusted issuer with a path keeps that path.
      assert.equal(
        auth.jwksUrlForIssuer('https://tenant.example/tenant/'),
        'https://tenant.example/tenant/.well-known/jwks.json'
      );
    } finally {
      restoreEnv(saved);
    }
  });

  test('an explicit JWKS URI overrides derivation for the primary issuer only', () => {
    const saved = snapshotEnv();
    try {
      env.auth0Issuer = 'https://primary.example/';
      env.auth0JwksUri = 'https://keys.example/custom-jwks.json';
      assert.equal(auth.jwksUrlForIssuer('https://primary.example/'), 'https://keys.example/custom-jwks.json');
      // Additional trusted issuers keep the derived path.
      assert.equal(
        auth.jwksUrlForIssuer('https://other.example/'),
        'https://other.example/.well-known/jwks.json'
      );
    } finally {
      restoreEnv(saved);
    }
  });
});

describe('token verification against the trusted issuer list', () => {
  test('1. a token from a configured trusted issuer is accepted', async () => {
    const token = await primary.mint({ sub: 'u-primary', role: 'farmer' });
    const { status, json } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
    assertAuthenticated(status, json, 'primary issuer');
  });

  test('2. a second trusted issuer verifies against the same audience', async () => {
    const token = await second.mint({ sub: 'u-second', role: 'buyer' });
    const { status, json } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
    assertAuthenticated(status, json, 'second trusted issuer');
  });

  test('3. an issuer that is not on the list is rejected', async () => {
    const token = await outsider.mint({ sub: 'u-outsider', role: 'farmer' });
    const { status, json } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
    assert.equal(status, 401);
    assert.equal(json.status, 'error');
  });

  test('4. a wrong audience is rejected for every trusted issuer', async () => {
    for (const harness of [primary, second]) {
      const token = await harness.mint({ sub: 'u-aud', role: 'farmer', aud: 'wrong-audience' });
      const { status } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
      assert.equal(status, 401, 'wrong audience must not verify');
    }
  });

  test('5. HS256 is rejected for every trusted issuer', async () => {
    for (const harness of [primary, second]) {
      const token = await harness.mint({ sub: 'u-hs', role: 'farmer', alg: 'HS256', key: 'shared-secret' });
      const { status } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
      assert.equal(status, 401, 'HS256 must not verify');
    }
  });

  test('6. an unexpected issuer inside the token is rejected', async () => {
    const token = await primary.mint({ sub: 'u-iss', role: 'farmer', iss: 'https://evil.example/' });
    const { status } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
    assert.equal(status, 401);
  });

  test('7. a missing Authorization header is still 401', async () => {
    const { status, json } = await api('/api/notifications');
    assert.equal(status, 401);
    assert.equal(json.status, 'error');
  });

  test('8. malformed Bearer credentials are still 401', async () => {
    for (const header of ['Bearer', 'Bearer ', 'Token abc.def.ghi', 'Bearer not.a.jwt.at.all', '']) {
      const { status } = await api('/api/notifications', { Authorization: header });
      assert.equal(status, 401, `header ${JSON.stringify(header)}`);
    }
  });

  test('9. x-user-id alone still cannot authenticate', async () => {
    const { status, json } = await api('/api/notifications', {
      'x-user-id': 'somebody-else',
      'x-user-role': 'admin',
    });
    assert.equal(status, 401);
    assert.equal(json.status, 'error');
  });

  test('10. a jku header pointing at an untrusted JWKS is ignored', async () => {
    // Signed by the primary issuer's real key, but advertising the outsider's
    // JWKS. Verification must use configured keys only, so the token is valid
    // on issuer/audience/signature alone — proving jku is never dereferenced.
    const token = await primary.mint({
      sub: 'u-jku',
      role: 'farmer',
      header: { jku: `${outsider.jwksUrl}/.well-known/jwks.json` },
    });
    const { status, json } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
    assertAuthenticated(status, json, 'jku must be ignored, not dereferenced');
  });

  test('11. an explicitly configured JWKS URI is honoured for verification', async () => {
    const saved = snapshotEnv();
    try {
      // Single-issuer mode pointed at a host that does not resolve, with the
      // JWKS document supplied explicitly. If derivation were still used this
      // request could not verify.
      env.authTrustedIssuers = [];
      env.auth0Issuer = UNRESOLVABLE_ISSUER;
      env.auth0JwksUri = `${primary.jwksUrl}/.well-known/jwks.json`;
      const token = await primary.mint({ sub: 'u-explicit-jwks', role: 'farmer', iss: UNRESOLVABLE_ISSUER });
      const { status, json } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
      assertAuthenticated(status, json, 'explicit JWKS URI');
    } finally {
      restoreEnv(saved);
    }
  });

  test('12. derivation still works when no explicit JWKS URI is set', async () => {
    const saved = snapshotEnv();
    try {
      env.authTrustedIssuers = [];
      env.auth0Issuer = primary.issuer;
      env.auth0JwksUri = null;
      const token = await primary.mint({ sub: 'u-derived-jwks', role: 'farmer' });
      const { status, json } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
      assertAuthenticated(status, json, 'derived JWKS URI');
    } finally {
      restoreEnv(saved);
    }
  });

  test('13. no configured issuer still fails closed with 503', async () => {
    const saved = snapshotEnv();
    try {
      env.authTrustedIssuers = [];
      env.auth0Issuer = null;
      const { status, json } = await api('/api/notifications', {
        Authorization: `Bearer ${await primary.mint({ sub: 'u-x', role: 'farmer' })}`,
      });
      assert.equal(status, 503);
      assert.match(json.message, /Authentication is not configured/);
    } finally {
      restoreEnv(saved);
    }
  });

  test('14. an expired token is still rejected', async () => {
    const token = await primary.mint({
      sub: 'u-exp',
      role: 'farmer',
      expiresIn: new Date(Date.now() - 60000),
    });
    const { status } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
    assert.equal(status, 401);
  });
});

describe('identity extraction and privileged roles are unchanged', () => {
  // Pure helpers: no HTTP, no database. These pin the req.user contract and
  // the role semantics that B3 authorization depends on.
  test('15. scope still comes only from the verified id and role', () => {
    assert.deepEqual(auth.dealScopeFor({ id: 'F1', role: 'farmer' }), { farmerId: 'F1' });
    assert.deepEqual(auth.dealScopeFor({ id: 'B1', role: 'buyer' }), { buyerId: 'B1' });
    assert.equal(auth.dealScopeFor({ id: 'F1', role: 'farmer' }).buyerId, undefined);
    assert.equal(auth.dealScopeFor({ id: 'B1', role: 'buyer' }).farmerId, undefined);
  });

  test('16. admin/system remain the only cross-participant roles', () => {
    assert.equal(auth.isPrivileged({ id: 'A1', role: 'admin' }), true);
    assert.equal(auth.isPrivileged({ id: 'S1', role: 'system' }), true);
    assert.equal(auth.isPrivileged({ id: 'F1', role: 'farmer' }), false);
    assert.equal(auth.isPrivileged({ id: 'U1', role: 'user' }), false);
    assert.equal(auth.dealScopeFor({ id: 'A1', role: 'admin' }), null);
  });

  test('17. a missing or unprivileged role is still refused', () => {
    assert.throws(() => auth.dealScopeFor({ id: 'U1', role: 'user' }), (err) => err.status === 403);
    assert.throws(() => auth.dealScopeFor(null), (err) => err.status === 401);
  });

  test('18. participant authorization still requires ownership', () => {
    const deal = { id: 'D1', farmerId: 'F1', buyerId: 'B1' };
    assert.doesNotThrow(() => auth.authorizeDealParticipant(deal, { id: 'F1', role: 'farmer' }));
    assert.doesNotThrow(() => auth.authorizeDealParticipant(deal, { id: 'B1', role: 'buyer' }));
    assert.throws(
      () => auth.authorizeDealParticipant(deal, { id: 'X1', role: 'farmer' }),
      (err) => err.status === 403
    );
    assert.throws(() => auth.authorizeDealParticipant(deal, null), (err) => err.status === 401);
  });
});
