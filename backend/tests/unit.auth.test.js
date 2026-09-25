// Authentication tests: strict Auth0-style RS256 JWT verification.
// Uses a local JWKS server + freshly minted tokens (no network beyond
// 127.0.0.1, no real secrets). Cases 1-8 need no database; 9-10 are
// DB-gated like the other integration suites.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createHarness } = require('./helpers/jwt-test-server');

const HAVE_DB = !!process.env.DATABASE_URL;
const SKIP_DB = HAVE_DB ? false : 'BLOCKED: DATABASE_URL not set — needs local PostgreSQL';

let app;
let server;
let baseUrl = '';
let harness;
let badSigner;
const created = { farmers: [], buyers: [], userIds: [] };

async function api(path, headers = {}) {
  const res = await fetch(`${baseUrl}${path}`, { headers, signal: AbortSignal.timeout(15000) });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

function assertNoLeak(json, label) {
  assert.ok(json && typeof json === 'object', `${label}: expected JSON body`);
  const text = JSON.stringify(json);
  assert.ok(!text.includes('PRIVATE KEY') && !text.includes('-----BEGIN'), `${label}: leaked key material`);
}

before(async () => {
  harness = await createHarness();
  harness.applyEnv();
  badSigner = await harness.wrongKeyHarness();
  // Require AFTER env is set so config picks up the test issuer/audience.
  app = require('../src/app');
  const http = require('node:http');
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  try {
    if (created.userIds.length > 0) {
      const { getPrisma } = require('../src/config/database');
      const prisma = getPrisma();
      await prisma.notification.deleteMany({ where: { userId: { in: created.userIds } } });
      for (const id of created.farmers) {
        await prisma.farmer.deleteMany({ where: { id } });
      }
      for (const id of created.buyers) {
        await prisma.buyer.deleteMany({ where: { id } });
      }
      await prisma.$disconnect();
    }
  } catch (err) {
    console.warn(`cleanup warning (test data may remain): ${err.message}`);
  }
  await new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
  if (harness) await harness.close();
});

describe('JWT authentication (local JWKS)', () => {

  test('1. missing Authorization header -> 401', async () => {
    const { status, json } = await api('/api/notifications');
    assert.equal(status, 401);
    assert.equal(json.status, 'error');
    assertNoLeak(json, 'missing token');
  });

  test('2. malformed Bearer credentials -> 401', async () => {
    for (const header of ['Bearer', 'Bearer ', 'Token abc.def.ghi', 'Bearer not.a.jwt.at.all', '']) {
      const { status } = await api('/api/notifications', { Authorization: header });
      assert.equal(status, 401, `header ${JSON.stringify(header)}`);
    }
  });

  test('3. invalid signature (wrong key, same kid) -> 401', async () => {
    const token = await badSigner.mintBad({ sub: 'u1', role: 'farmer' });
    const { status, json } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
    assert.equal(status, 401);
    assertNoLeak(json, 'bad signature');
  });

  test('4. wrong issuer -> 401', async () => {
    const token = await harness.mint({ sub: 'u1', role: 'farmer', iss: 'https://evil.example/' });
    const { status } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
    assert.equal(status, 401);
  });

  test('5. wrong audience -> 401', async () => {
    const token = await harness.mint({ sub: 'u1', role: 'farmer', aud: 'wrong-audience' });
    const { status } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
    assert.equal(status, 401);
  });

  test('6. expired token -> 401', async () => {
    const token = await harness.mint({ sub: 'u1', role: 'farmer', expiresIn: new Date(Date.now() - 60000) });
    const { status } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
    assert.equal(status, 401);
  });

  test('7. non-RS256 algorithm (HS256) is rejected -> 401', async () => {
    const token = await harness.mint({ sub: 'u1', role: 'farmer', alg: 'HS256', key: 'shared-secret' });
    const { status } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
    assert.equal(status, 401);
  });

  test('8. x-user-id alone (no Bearer token) cannot authenticate -> 401', async () => {
    const { status, json } = await api('/api/notifications', {
      'x-user-id': 'somebody-else',
      'x-user-role': 'admin',
    });
    assert.equal(status, 401);
    assert.equal(json.status, 'error');
  });

  test('7b. valid token passes authentication (200 with DB, 503 honest without)', async () => {
    const token = await harness.mint({ sub: 'u-valid', role: 'farmer' });
    const { status, json } = await api('/api/notifications', { Authorization: `Bearer ${token}` });
    if (HAVE_DB) {
      assert.equal(status, 200);
      assert.equal(json.success, true);
    } else {
      // Auth passed; the database dependency reports itself.
      assert.equal(status, 503);
      assert.match(json.message, /not configured/);
    }
  });
});

describe('deal authorization with verified identity', { skip: SKIP_DB }, () => {
  async function makeParties(tag) {
    const farmerService = require('../src/services/farmerService');
    const buyerService = require('../src/services/buyerService');
    const farmer = await farmerService.createFarmer({
      name: `Auth Deal Farmer ${tag}`,
      phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      email: `auth-deal-f-${tag}-${Date.now().toString(36)}@example.com`,
    });
    const buyer = await buyerService.createBuyer({
      name: `Auth Deal Buyer ${tag}`,
      phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      email: `auth-deal-b-${tag}-${Date.now().toString(36)}@example.com`,
    });
    created.farmers.push(farmer.id);
    created.buyers.push(buyer.id);
    created.userIds.push(farmer.id, buyer.id);
    return { farmerId: farmer.id, buyerId: buyer.id };
  }

  test('9. authenticated user cannot read another farmer history -> 403', async () => {
    const { farmerId } = await makeParties('X9');
    const impostor = await harness.mint({ sub: 'impostor-id', role: 'farmer' });
    const { status, json } = await api(`/api/deals/farmer/${farmerId}`, {
      Authorization: `Bearer ${impostor}`,
    });
    assert.equal(status, 403);
    assert.match(json.message, /Access denied/);
  });

  test('10. owner with valid token reads own history -> 200', async () => {
    const { farmerId } = await makeParties('X10');
    const token = await harness.mint({ sub: farmerId, role: 'farmer' });
    const { status, json } = await api(`/api/deals/farmer/${farmerId}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(status, 200);
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
  });
});
