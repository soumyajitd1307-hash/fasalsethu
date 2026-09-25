const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

describe('Auth0 JWT Verification Middleware', () => {
  let server = null;
  let baseUrl = '';

  before(async () => {
    // Ensure test environment does not bypass auth for this suite
    delete process.env.DISABLE_AUTH_FOR_TESTS;
    const app = require('../src/app');
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    if (server) server.close();
  });

  test('Public route GET /api/health succeeds without Authorization header', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'ok');
  });

  test('Public route GET /api/crop-listings allows unauthenticated browsing', async () => {
    const res = await fetch(`${baseUrl}/api/crop-listings`);
    // Should not return 401 Unauthorized
    assert.notEqual(res.status, 401);
  });

  test('Protected route GET /api/health/auth-verify rejects missing token with 401', async () => {
    const res = await fetch(`${baseUrl}/api/health/auth-verify`);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.status, 'error');
    assert.ok(json.message.includes('Unauthorized') || json.message.includes('token'));
  });

  test('Protected route GET /api/health/auth-verify rejects malformed token with 401', async () => {
    const res = await fetch(`${baseUrl}/api/health/auth-verify`, {
      headers: {
        Authorization: 'Bearer invalid.malformed.token',
      },
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.status, 'error');
    assert.ok(json.message);
  });

  test('Protected route POST /api/crop-listings rejects unauthenticated mutation with 401', async () => {
    const res = await fetch(`${baseUrl}/api/crop-listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cropName: 'Tomato',
        quantity: 50,
      }),
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.status, 'error');
  });

  test('Protected route POST /api/farmers rejects unauthenticated profile creation with 401', async () => {
    const res = await fetch(`${baseUrl}/api/farmers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Ramesh Patel',
        phone: '+919876543210',
      }),
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.status, 'error');
  });
});
