// TEST-ONLY JWT harness (never imported by production code).
// Spins a local JWKS endpoint backed by a freshly generated RSA keypair and
// mints real RS256 JWTs against it. No network beyond 127.0.0.1, no secrets:
// the keys exist only for the lifetime of the test process.
const http = require('node:http');
const crypto = require('node:crypto');
const { once } = require('node:events');
const jose = require('jose');

const KID = 'test-key-1';

async function createHarness({ audience = 'test-audience' } = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = await jose.exportJWK(publicKey);
  publicJwk.kid = KID;
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  const server = http.createServer((req, res) => {
    if (req.url === '/.well-known/jwks.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const jwksUrl = `http://127.0.0.1:${server.address().port}`;
  // The test issuer is the JWKS base URL itself (mirrors Auth0, where the
  // JWKS document lives at <issuer>/.well-known/jwks.json).
  const issuer = `${jwksUrl}/`;

  async function mint({ sub, role = 'user', iss = issuer, aud = audience, key = privateKey, kid = KID, alg = 'RS256', expiresIn = '1h', extra = {}, header = {} }) {
    if (alg === 'HS256') {
      const secret = typeof key === 'string' ? new TextEncoder().encode(key) : key;
      return new jose.SignJWT({ sub, role, ...extra })
        .setProtectedHeader({ alg: 'HS256', kid })
        .setIssuer(iss)
        .setAudience(aud)
        .setExpirationTime(expiresIn)
        .sign(secret);
    }
    // `header` lets a test add protected-header claims (e.g. `jku`) to prove
    // the verifier ignores anything but the configured JWKS URL.
    return new jose.SignJWT({ sub, role, ...extra })
      .setProtectedHeader({ alg, kid, typ: 'JWT', ...header })
      .setIssuer(iss)
      .setAudience(aud)
      .setExpirationTime(expiresIn)
      .sign(key);
  }

  async function wrongKeyHarness() {
    // Same issuer/audience/kid, different signing key -> invalid signature.
    const { publicKey: otherPub, privateKey: otherPriv } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    void otherPub;
    return {
      mintBad: (opts = {}) => mint({ ...opts, key: otherPriv }),
    };
  }

  // Auth env for the backend under test (set before any request is made).
  function applyEnv() {
    process.env.AUTH0_ISSUER_BASE_URL = jwksUrl;
    process.env.AUTH0_AUDIENCE = audience;
  }

  async function close() {
    await new Promise((resolve) => server.close(resolve));
  }

  return { issuer, audience, jwksUrl, mint, wrongKeyHarness, applyEnv, close };
}

module.exports = { createHarness };
