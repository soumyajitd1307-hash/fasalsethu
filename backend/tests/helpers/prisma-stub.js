/**
 * TEST-ONLY in-memory Prisma stand-in.
 *
 * The authoritative coverage for auth is the tests/integration.*.test.js suites,
 * which run against a real PostgreSQL database and report as BLOCKED when
 * DATABASE_URL is absent. This helper exists so the auth control flow is still
 * executed on a machine without PostgreSQL.
 *
 * It deliberately reproduces the two Prisma behaviours the auth code depends on:
 *  1. UNIQUE constraints, which surface as an error with `code === 'P2002'`.
 *     Registration relies on the database — not a pre-check — to reject
 *     duplicates, so without this the 409 path would be untested.
 *  2. Interactive-transaction atomicity: a callback that throws rolls every
 *     write back, so "profile without credential" cannot survive.
 *
 * Never imported by production code.
 */

const { normalizeIdentifier } = require('../../src/auth/identifier');
const { hashPassword } = require('../../src/auth/password');

function clone(row) {
  return row ? { ...row } : null;
}

/** Mirrors Prisma's P2002 unique-constraint failure. */
function uniqueViolation(target) {
  const err = new Error('Unique constraint failed on the given fields');
  err.code = 'P2002';
  err.meta = { target };
  return err;
}

function isUniqueViolation(err) {
  return Boolean(err) && err.code === 'P2002';
}

/** Date-aware equality, so a compare-and-set can pin a timestamp. */
function valuesMatch(actual, wanted) {
  const a = actual === undefined ? null : actual;
  const w = wanted === undefined ? null : wanted;
  if (w instanceof Date || a instanceof Date) {
    return w instanceof Date && a instanceof Date && w.getTime() === a.getTime();
  }
  return a === w;
}

/** Supports the comparison operators Prisma's filter syntax allows. */
function matchesFilter(actual, expected) {
  const a = actual === undefined ? null : actual;
  if (expected === null) return a === null;
  if (expected instanceof Date) return valuesMatch(a, expected);
  if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
    return Object.entries(expected).every(([op, operand]) => {
      switch (op) {
        case 'gt':
          return a > operand;
        case 'gte':
          return a >= operand;
        case 'lt':
          return a < operand;
        case 'lte':
          return a <= operand;
        case 'not':
          return !valuesMatch(a, operand);
        case 'in':
          return operand.some((value) => valuesMatch(a, value));
        case 'equals':
          return valuesMatch(a, operand);
        default:
          throw new Error(`prisma-stub: unsupported filter operator '${op}'`);
      }
    });
  }
  return valuesMatch(a, expected);
}

/**
 * Applies an updateMany, which the login lockout and the refresh/logout family
 * revocation both rely on. Returns { count } exactly as Prisma does, so a
 * conditional update that matches nothing reports 0.
 *
 * Every matching row is updated, not just the first: real Prisma's updateMany
 * is set-based, and a family revocation must affect the whole family. The
 * single-use "claim" updates still match at most one row because their filter
 * pins a unique `id`.
 */
function applyUpdateMany(collection, where, data) {
  let count = 0;
  for (const row of collection.values()) {
    if (!Object.entries(where).every(([field, expected]) => matchesFilter(row[field], expected))) continue;
    for (const [field, value] of Object.entries(data)) row[field] = value;
    row.updatedAt = new Date();
    count += 1;
  }
  return { count };
}

/** Supports the owner filters dealService builds for a verified identity. */
function matchesDeal(deal, where = {}) {
  return Object.entries(where).every(([field, expected]) => (expected === undefined ? true : deal[field] === expected));
}

function makeStore() {
  const authAccounts = new Map();
  const refreshTokens = new Map();
  const farmers = new Map();
  const buyers = new Map();
  const deals = new Map();
  let seq = 0;
  const nextId = (prefix) => `${prefix}stub${(seq += 1)}`;

  // Only these columns are unique in the real schema.
  const FARMER_UNIQUE = ['email', 'kisanId'];
  const BUYER_UNIQUE = ['email', 'gstin'];
  const ACCOUNT_UNIQUE = ['userId', 'identifierNormalized'];
  const REFRESH_UNIQUE = ['tokenHash'];

  function assertUnique(collection, row, fields) {
    for (const field of fields) {
      const value = row[field];
      if (value === undefined || value === null) continue; // NULLs never collide
      for (const other of collection.values()) {
        if (other !== row && other[field] === value) throw uniqueViolation([field]);
      }
    }
  }

  function insert(collection, row) {
    collection.set(row.id, row);
    return clone(row);
  }

  const store = {
    authAccounts,
    refreshTokens,
    farmers,
    buyers,
    deals,
    nextId,
    PASSWORD,

    /**
     * Test hook: makes refreshToken.findUnique yield to the event loop so two
     * concurrent refresh() calls can both read a token before either claims it.
     * That turns the "cannot rotate twice" test into a real race instead of two
     * sequential calls.
     */
    interleaveLookups(on) {
      store.interleave = Boolean(on);
    },

    /** Adds a credential for an existing profile (e.g. a phone login). */
    async addAccount({ userId, role, identifier, password }) {
      const row = {
        id: nextId('acct'),
        userId,
        role,
        identifier,
        identifierNormalized: normalizeIdentifier(identifier, role),
        passwordHash: await hashPassword(password === undefined ? PASSWORD : password),
        status: 'ACTIVE',
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
      };
      assertUnique(authAccounts, row, ACCOUNT_UNIQUE);
      return insert(authAccounts, row);
    },

    /** Forces the next matching create() to fail, to test rollback. */
    failNextCreate(model) {
      store.failingCreate = model;
    },

    prisma: {
      authAccount: {
        /**
         * Generic unique-key lookup. Real Prisma resolves whichever unique field
         * the filter names, and the auth code legitimately looks an account up
         * both ways: login by identifierNormalized, refresh by userId.
         */
        async findUnique({ where }) {
          for (const row of authAccounts.values()) {
            if (Object.keys(where).length > 0 && Object.entries(where).every(([f, v]) => matchesFilter(row[f], v))) {
              return clone(row);
            }
          }
          return null;
        },
        async findFirst({ where }) {
          for (const row of authAccounts.values()) {
            if (Object.entries(where).every(([f, v]) => row[f] === v)) return clone(row);
          }
          return null;
        },
        async create({ data }) {
          if (store.failingCreate === 'authAccount') {
            store.failingCreate = null;
            throw new Error('simulated authAccount failure');
          }
          const row = {
            id: nextId('acct'),
            createdAt: new Date(),
            updatedAt: new Date(),
            // Schema defaults, which registration must not duplicate.
            status: 'ACTIVE',
            failedAttempts: 0,
            lockedUntil: null,
            lastLoginAt: null,
            emailVerifiedAt: null,
            phoneVerifiedAt: null,
            ...data,
          };
          assertUnique(authAccounts, row, ACCOUNT_UNIQUE);
          return insert(authAccounts, row);
        },
        async updateMany({ where, data }) {
          return applyUpdateMany(authAccounts, where, data);
        },
      },
      farmer: {
        async findUnique({ where }) {
          return clone(farmers.get(where.id)) || null;
        },
        async create({ data }) {
          if (store.failingCreate === 'farmer') {
            store.failingCreate = null;
            throw new Error('simulated farmer failure');
          }
          const row = {
            id: nextId('farmer'),
            // Schema defaults.
            kycStatus: 'PENDING',
            trustScore: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...normalizeOptional(data),
          };
          assertUnique(farmers, row, FARMER_UNIQUE);
          return insert(farmers, row);
        },
      },
      buyer: {
        async findUnique({ where }) {
          return clone(buyers.get(where.id)) || null;
        },
        async create({ data }) {
          if (store.failingCreate === 'buyer') {
            store.failingCreate = null;
            throw new Error('simulated buyer failure');
          }
          const row = {
            id: nextId('buyer'),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...normalizeOptional(data),
          };
          assertUnique(buyers, row, BUYER_UNIQUE);
          return insert(buyers, row);
        },
      },
      refreshToken: {
        async findUnique({ where }) {
          // Optional yield so concurrent callers interleave (test hook).
          if (store.interleave) await new Promise((resolve) => setImmediate(resolve));
          for (const row of refreshTokens.values()) {
            if (Object.entries(where).every(([f, v]) => matchesFilter(row[f], v))) return clone(row);
          }
          return null;
        },
        async findMany({ where } = {}) {
          return [...refreshTokens.values()]
            .filter((row) => Object.entries(where || {}).every(([f, v]) => matchesFilter(row[f], v)))
            .map(clone);
        },
        async create({ data }) {
          const row = { id: nextId('refresh'), revokedAt: null, createdAt: new Date(), ...data };
          assertUnique(refreshTokens, row, REFRESH_UNIQUE);
          return insert(refreshTokens, row);
        },
        async updateMany({ where, data }) {
          return applyUpdateMany(refreshTokens, where, data);
        },
        async count({ where } = {}) {
          return [...refreshTokens.values()].filter((row) =>
            Object.entries(where || {}).every(([f, v]) => matchesFilter(row[f], v))
          ).length;
        },
      },
      deal: {
        async findMany({ where }) {
          return [...deals.values()].filter((d) => matchesDeal(d, where)).map(clone);
        },
        async count({ where }) {
          return [...deals.values()].filter((d) => matchesDeal(d, where)).length;
        },
      },

      /**
       * Supports both Prisma forms:
       *  - an ARRAY is the read-only batch form used by the list endpoints;
       *  - a CALLBACK is the interactive form, which gets snapshot/rollback
       *    semantics so a throw discards every write, exactly like Prisma.
       */
      async $transaction(input) {
        if (Array.isArray(input)) return Promise.all(input);

        const snapshot = {
          farmers: new Map([...farmers].map(([k, v]) => [k, { ...v }])),
          buyers: new Map([...buyers].map(([k, v]) => [k, { ...v }])),
          authAccounts: new Map([...authAccounts].map(([k, v]) => [k, { ...v }])),
          refreshTokens: new Map([...refreshTokens].map(([k, v]) => [k, { ...v }])),
        };
        try {
          return await input(store.prisma);
        } catch (err) {
          farmers.clear();
          buyers.clear();
          authAccounts.clear();
          refreshTokens.clear();
          for (const [k, v] of snapshot.farmers) farmers.set(k, v);
          for (const [k, v] of snapshot.buyers) buyers.set(k, v);
          for (const [k, v] of snapshot.authAccounts) authAccounts.set(k, v);
          for (const [k, v] of snapshot.refreshTokens) refreshTokens.set(k, v);
          throw err;
        }
      },
    },
  };

  return store;
}

const PASSWORD = 'correct-horse-battery-staple';

/** Prisma omits `undefined` fields; a stub row should still show NULL. */
function normalizeOptional(data) {
  const out = {};
  for (const [key, value] of Object.entries(data)) out[key] = value === undefined ? null : value;
  return out;
}

module.exports = { makeStore, uniqueViolation, isUniqueViolation, PASSWORD };
