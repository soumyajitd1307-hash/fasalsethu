/**
 * First-party RS256 signing key and public JWKS tests.
 *
 * Every key used here is generated inside the test process and thrown away
 * afterwards. No private key material is stored in the repository, and the
 * suite must still pass when AUTH_PRIVATE_KEY is absent for unrelated tests.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');
const path = require('node:path');

const jose = require('jose');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const HAVE_DB = !!process.env.DATABASE_URL;

const ISSUER = 'https://api.fasalsethu.test/';
const AUDIENCE = 'fasalsethu-api';
const KID = 'unit-test-key-1';
// Deliberately different from the config default so "TTL is applied" is a real
// assertion rather than a coincidence.
const TTL_SECONDS = 900;

const PRIVATE_JWK_PARAMS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'];

let app;
let server;
let baseUrl = '';
let env;
let jwksModule;
let testKeys;

function generateTestKeyPair(modulusLength = 2048) {
  return nodeCrypto.generateKeyPairSync('rsa', {
    modulusLength,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
}

async function api(pathname, headers = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, { headers, signal: AbortSignal.timeout(15000) });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json, text: await res.text().catch(() => '') };
}

/** Restores every variable this suite mutates. */
function snapshotEnv() {
  return {
    authPrivateKey: env.authPrivateKey,
    authKeyId: env.authKeyId,
    auth0Issuer: env.auth0Issuer,
    auth0Audience: env.auth0Audience,
    authTrustedIssuers: env.authTrustedIssuers,
    accessTokenTtlSeconds: env.accessTokenTtlSeconds,
  };
}

function restoreEnv(saved) {
  Object.assign(env, saved);
  jwksModule.resetSigningKeyCache();
}

async function verify(token) {
  return jose.jwtVerify(token, nodeCrypto.createPublicKey(testKeys.publicKey), {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ['RS256'],
  });
}

before(async () => {
  testKeys = generateTestKeyPair();

  // A real deployment stores the PEM as one escaped line; exercise that exact
  // shape so the normalization path is what the tests actually cover.
  process.env.AUTH_PRIVATE_KEY = testKeys.privateKey.replace(/\n/g, '\\n');
  process.env.AUTH_KEY_ID = KID;
  process.env.AUTH0_ISSUER_BASE_URL = ISSUER;
  process.env.AUTH0_AUDIENCE = AUDIENCE;
  delete process.env.AUTH_TRUSTED_ISSUERS;
  process.env.ACCESS_TOKEN_TTL_SECONDS = String(TTL_SECONDS);

  app = require('../src/app');
  env = require('../src/config/env');
  jwksModule = require('../src/keys/jwks');

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
});

describe('key loading', () => {
  test('1. a valid configured key produces the expected public JWK', async () => {
    const expected = await jose.exportJWK(nodeCrypto.createPublicKey(testKeys.publicKey));
    const jwks = await jwksModule.publicJwks();

    assert.equal(jwks.keys.length, 1);
    assert.equal(jwks.keys[0].kty, expected.kty);
    assert.equal(jwks.keys[0].n, expected.n);
    assert.equal(jwks.keys[0].e, expected.e);
  });

  test('2. the JWKS document contains only public parameters', async () => {
    const jwks = await jwksModule.publicJwks();
    assert.deepEqual(Object.keys(jwks.keys[0]).sort(), ['alg', 'e', 'kid', 'kty', 'n', 'use']);
  });

  test('3. the JWKS document never exposes private parameters', async () => {
    const jwks = await jwksModule.publicJwks();
    const serialized = JSON.stringify(jwks);
    for (const param of PRIVATE_JWK_PARAMS) {
      assert.equal(Object.prototype.hasOwnProperty.call(jwks.keys[0], param), false, `must not expose ${param}`);
      assert.ok(!serialized.includes(`"${param}"`), `must not contain ${param}`);
    }
    assert.ok(!serialized.includes('PRIVATE'), 'must not contain PEM private key material');
    assert.ok(!serialized.includes('BEGIN'), 'must not contain PEM blocks');
  });

  test('4. kid comes from configuration', async () => {
    const jwks = await jwksModule.publicJwks();
    assert.equal(jwks.keys[0].kid, KID);

    const saved = snapshotEnv();
    try {
      env.authKeyId = 'rotated-key-2';
      jwksModule.resetSigningKeyCache();
      const rotated = await jwksModule.publicJwks();
      assert.equal(rotated.keys[0].kid, 'rotated-key-2');
    } finally {
      restoreEnv(saved);
    }
  });

  test('5. alg is RS256 and 6. use is sig', async () => {
    const jwks = await jwksModule.publicJwks();
    assert.equal(jwks.keys[0].alg, 'RS256');
    assert.equal(jwks.keys[0].use, 'sig');
  });

  test('the key is imported once and cached, so the kid stays stable per key', async () => {
    // Behavioural proof of caching: while the cache is warm, changing the
    // configured kid has no effect, which is only possible if the key material
    // is not re-read on every call.
    const saved = snapshotEnv();
    try {
      const before = await jwksModule.getSigningKeyInfo();
      assert.equal(before.kid, KID);

      env.authKeyId = 'should-be-ignored-while-cached';
      const during = await jwksModule.getSigningKeyInfo();
      assert.equal(during.kid, KID, 'a warm cache must not re-read configuration');
      assert.equal(during.publicJwk.n, before.publicJwk.n, 'the key material must be reused');

      // An explicit reset (key rotation) does pick the new configuration up.
      jwksModule.resetSigningKeyCache();
      const after = await jwksModule.getSigningKeyInfo();
      assert.equal(after.kid, 'should-be-ignored-while-cached');
    } finally {
      restoreEnv(saved);
    }
  });

  test('the private key is not reachable through the module surface', () => {
    const surface = Object.keys(jwksModule);
    assert.ok(!surface.includes('getSigningKey'), 'the raw signing key must not be exported');
    assert.ok(!surface.includes('loadSigningKey'));
    assert.ok(!surface.includes('buildSigningKey'));
    // Constants and the error type are legitimate exports; what must never
    // appear is anything that carries key material.
    for (const name of surface) {
      assert.ok(
        ['ALG', 'MIN_RSA_MODULUS_BITS', 'SigningKeyError'].includes(name) || typeof jwksModule[name] === 'function',
        `unexpected non-function export: ${name}`
      );
    }
    assert.equal(jwksModule.ALG, 'RS256');
  });

  test('getSigningKeyInfo exposes the kid and public JWK only', async () => {
    const info = await jwksModule.getSigningKeyInfo();
    assert.deepEqual(Object.keys(info).sort(), ['kid', 'publicJwk']);
    assert.deepEqual(Object.keys(info.publicJwk).sort(), ['alg', 'e', 'kid', 'kty', 'n', 'use']);
  });

  test('an escaped-newline PEM is normalized before import', () => {
    const { normalizePrivateKey } = jwksModule;
    const pem = '-----BEGIN PRIVATE KEY-----\\nAAAA\\n-----END PRIVATE KEY-----';
    assert.equal(normalizePrivateKey(pem), '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----');
    // Real newlines must pass through untouched.
    assert.equal(normalizePrivateKey(pem.replace(/\\n/g, '\n')), '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----');
  });

  test('15. a missing private key fails clearly and never falls back to a generated one', async () => {
    const saved = snapshotEnv();
    try {
      env.authPrivateKey = null;
      jwksModule.resetSigningKeyCache();
      await assert.rejects(
        () => jwksModule.signAccessToken({ sub: 'u1', role: 'farmer' }),
        (err) => {
          assert.equal(err.name, 'SigningKeyError');
          assert.equal(err.status, 503);
          assert.match(err.message, /AUTH_PRIVATE_KEY is not set/);
          return true;
        }
      );
      await assert.rejects(() => jwksModule.publicJwks(), /AUTH_PRIVATE_KEY is not set/);
    } finally {
      restoreEnv(saved);
    }
  });

  test('a missing key id also fails clearly', async () => {
    const saved = snapshotEnv();
    try {
      env.authKeyId = null;
      jwksModule.resetSigningKeyCache();
      await assert.rejects(() => jwksModule.signAccessToken({ sub: 'u1' }), /AUTH_KEY_ID is not set/);
    } finally {
      restoreEnv(saved);
    }
  });

  test('16. an invalid private key fails clearly instead of being replaced', async () => {
    const saved = snapshotEnv();
    for (const bad of ['not-a-key', '-----BEGIN PRIVATE KEY-----\nnope\n-----END PRIVATE KEY-----']) {
      try {
        env.authPrivateKey = bad;
        jwksModule.resetSigningKeyCache();
        await assert.rejects(
          () => jwksModule.signAccessToken({ sub: 'u1' }),
          (err) => {
            assert.equal(err.name, 'SigningKeyError');
            assert.equal(err.status, 503);
            // The failure message must not echo the supplied key.
            assert.ok(!err.message.includes(bad), 'must not echo key material');
            return true;
          }
        );
      } finally {
        restoreEnv(saved);
      }
    }
  });

  test('a non-RSA or undersized key is refused', async () => {
    const saved = snapshotEnv();
    try {
      const ec = nodeCrypto.generateKeyPairSync('ec', {
        namedCurve: 'P-256',
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });
      env.authPrivateKey = ec.privateKey;
      jwksModule.resetSigningKeyCache();
      await assert.rejects(() => jwksModule.publicJwks(), /must be an RSA private key/);

      const weak = generateTestKeyPair(1024);
      env.authPrivateKey = weak.privateKey;
      jwksModule.resetSigningKeyCache();
      await assert.rejects(() => jwksModule.publicJwks(), /too weak/);
    } finally {
      restoreEnv(saved);
    }
  });
});

describe('access token signing', () => {
  test('7. signAccessToken produces a verifiable RS256 token', async () => {
    const token = await jwksModule.signAccessToken({ sub: 'clx0f8farmer', role: 'farmer' });
    assert.equal(typeof token, 'string');
    assert.equal(token.split('.').length, 3);
    const { payload, protectedHeader } = await verify(token);
    assert.equal(protectedHeader.alg, 'RS256');
    assert.equal(protectedHeader.kid, KID);
    assert.equal(payload.sub, 'clx0f8farmer');
    assert.equal(payload.role, 'farmer');
  });

  test('8. the token carries the configured issuer and 9. the configured audience', async () => {
    const token = await jwksModule.signAccessToken({ sub: 'u1', role: 'buyer' });
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    assert.equal(header.iss, undefined, 'issuer is a payload claim, not a header claim');
    assert.equal(payload.iss, ISSUER);
    assert.equal(payload.aud, AUDIENCE);
  });

  test('10. the token has iat and exp, and 11. the configured TTL is applied', async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await jwksModule.signAccessToken({ sub: 'u1', role: 'farmer' });
    const { payload } = await verify(token);
    assert.equal(typeof payload.iat, 'number');
    assert.equal(typeof payload.exp, 'number');
    assert.equal(payload.exp - payload.iat, TTL_SECONDS);
    assert.ok(payload.iat >= before - 5 && payload.iat <= before + 5, 'iat must be now');
  });

  test('12/13/14. a caller cannot override the issuer, audience or algorithm', async () => {
    for (const claim of ['iss', 'aud', 'alg', 'kid', 'iat', 'exp', 'nbf']) {
      await assert.rejects(
        () => jwksModule.signAccessToken({ sub: 'u1', [claim]: 'attacker-value' }),
        new RegExp(`'${claim}' is set by the server`),
        `caller must not control ${claim}`
      );
    }
  });

  test('a caller cannot smuggle a claim through the prototype chain', async () => {
    // JSON.parse makes "__proto__" an own property, so it survives a naive
    // typeof check. It must be refused outright rather than signed.
    await assert.rejects(
      () => jwksModule.signAccessToken(JSON.parse('{"sub":"u1","__proto__":{"iss":"https://evil.example/"}}')),
      /'__proto__' is not an allowed claim/
    );
    // A nested object under an ordinary key is fine and stays data.
    const token = await jwksModule.signAccessToken({ sub: 'u1', role: 'farmer', profile: { district: 'Nashik' } });
    const { payload } = await verify(token);
    assert.equal(payload.iss, ISSUER);
    assert.deepEqual(payload.profile, { district: 'Nashik' });
  });

  test('a non-object claims argument is rejected', async () => {
    for (const bad of [null, 'sub=u1', 42, ['sub']]) {
      await assert.rejects(() => jwksModule.signAccessToken(bad), /expects an object of claims/);
    }
  });

  test('signing refuses when the issuer or audience is unconfigured', async () => {
    const saved = snapshotEnv();
    try {
      env.auth0Issuer = null;
      jwksModule.resetSigningKeyCache();
      await assert.rejects(() => jwksModule.signAccessToken({ sub: 'u1' }), /AUTH0_ISSUER_BASE_URL is not set/);
      env.auth0Issuer = ISSUER;
      env.auth0Audience = null;
      jwksModule.resetSigningKeyCache();
      await assert.rejects(() => jwksModule.signAccessToken({ sub: 'u1' }), /AUTH0_AUDIENCE is not set/);
    } finally {
      restoreEnv(saved);
    }
  });
});

describe('the public JWKS endpoint', () => {
  test('17. the endpoint serves public key material only', async () => {
    const { status, json, text } = await api('/.well-known/jwks.json');
    assert.equal(status, 200);
    assert.equal(json.keys.length, 1);
    assert.deepEqual(Object.keys(json.keys[0]).sort(), ['alg', 'e', 'kid', 'kty', 'n', 'use']);
    assert.equal(json.keys[0].alg, 'RS256');
    assert.equal(json.keys[0].use, 'sig');
    assert.equal(json.keys[0].kid, KID);
    for (const param of PRIVATE_JWK_PARAMS) {
      assert.ok(!text.includes(`"${param}"`), `response must not contain ${param}`);
    }
    assert.ok(!text.includes('PRIVATE'), 'response must not contain PEM private key material');
    assert.ok(!text.includes('BEGIN'), 'response must not contain PEM blocks');
  });

  test('the published JWK is the key that actually signs tokens', async () => {
    const { json } = await api('/.well-known/jwks.json');
    const published = await jose.importJWK(json.keys[0], 'RS256');
    const token = await jwksModule.signAccessToken({ sub: 'u1', role: 'farmer' });
    // Verifying with the PUBLISHED key proves the document is not a decoy.
    const { payload } = await jose.jwtVerify(token, published, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['RS256'],
    });
    assert.equal(payload.sub, 'u1');
  });

  test('the endpoint needs no authentication', async () => {
    const { status } = await api('/.well-known/jwks.json');
    assert.equal(status, 200);
  });

  test('the endpoint reports a configuration error when no key is configured', async () => {
    const saved = snapshotEnv();
    try {
      env.authPrivateKey = null;
      jwksModule.resetSigningKeyCache();
      const { status, json, text } = await api('/.well-known/jwks.json');
      assert.equal(status, 503);
      assert.match(json.message, /AUTH_PRIVATE_KEY is not set/);
      assert.ok(!text.includes('PRIVATE KEY-----'), 'must not leak a PEM block');
    } finally {
      restoreEnv(saved);
    }
  });

  test('an unknown /.well-known path is still a 404', async () => {
    const { status } = await api('/.well-known/not-a-thing');
    assert.equal(status, 404);
  });
});

describe('first-party tokens satisfy the existing verifier', { skip: false }, () => {
  // The point of the whole design: a token minted here is accepted by the SAME
  // requireAuth/dealScopeFor path as any other RS256 token, with the JWKS
  // document discovered from the configured issuer.
  test('18. a first-party token authenticates against the live app', async () => {
    const saved = snapshotEnv();
    try {
      // Point the canonical issuer at this very server so the verifier derives
      // <issuer>/.well-known/jwks.json and fetches it over HTTP.
      env.auth0Issuer = `${baseUrl}/`;
      env.auth0JwksUri = null;
      env.authTrustedIssuers = [];
      jwksModule.resetSigningKeyCache();

      const token = await jwksModule.signAccessToken({ sub: 'clx0f8farmer', role: 'farmer' });
      const { status, json } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
      if (HAVE_DB) {
        assert.equal(status, 200);
        assert.equal(json.success, true);
      } else {
        // Authenticated, then stopped by the absent database.
        assert.equal(status, 503);
        assert.match(json.message, /Database not configured/);
      }
    } finally {
      restoreEnv(saved);
    }
  });

  test('the same token is rejected once the issuer is not trusted', async () => {
    const saved = snapshotEnv();
    try {
      env.auth0Issuer = `${baseUrl}/`;
      env.authTrustedIssuers = ['https://someone-else.example/'];
      jwksModule.resetSigningKeyCache();

      const token = await jwksModule.signAccessToken({ sub: 'clx0f8farmer', role: 'farmer' });
      const { status } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
      assert.equal(status, 401);
    } finally {
      restoreEnv(saved);
    }
  });

  test('a first-party token is still scoped by role exactly like any other', () => {
    const { dealScopeFor, isPrivileged } = require('../src/middleware/auth');
    assert.deepEqual(dealScopeFor({ id: 'clx0f8farmer', role: 'farmer' }), { farmerId: 'clx0f8farmer' });
    assert.deepEqual(dealScopeFor({ id: 'clx0buyer', role: 'buyer' }), { buyerId: 'clx0buyer' });
    assert.equal(isPrivileged({ id: 'clx0f8farmer', role: 'farmer' }), false);
  });
});
