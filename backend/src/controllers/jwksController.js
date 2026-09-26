/**
 * Public JWKS Controller.
 *
 * Publishes ONLY the public half of the configured signing key so that any
 * verifier holding a FasalSethu-issued RS256 token can check its signature.
 * No endpoint, response or log path here can reach the private key.
 */

const { publicJwks } = require('../keys/jwks');

async function getJwks(req, res, next) {
  try {
    // Safe to cache briefly; the document changes only when the key is rotated.
    res.set('Cache-Control', 'public, max-age=300');
    const jwks = await publicJwks();
    return res.json(jwks);
  } catch (err) {
    // A missing or unusable signing key is a server-configuration problem,
    // not a client error. SigningKeyError carries the right status and a
    // message that never contains key material.
    return next(err);
  }
}

module.exports = { getJwks };
