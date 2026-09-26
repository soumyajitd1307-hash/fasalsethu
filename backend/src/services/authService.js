/**
 * First-party credential authentication.
 *
 * Exchanges a role + identifier + password for a signed access token whose
 * `sub` is the Farmer.id or Buyer.id the existing B3 authorization already
 * expects. Nothing here trusts a client-supplied user id, and no identity is
 * ever read from a request header.
 *
 * Every failure — unknown identifier, wrong password, disabled account, locked
 * account, missing profile, mismatched role, corrupt stored hash — produces the
 * SAME 401 "Invalid credentials". Callers cannot learn which accounts exist.
 *
 * Registration is deliberately NOT here: a missing AuthAccount is just a failed
 * login, and this module never creates one.
 */

const { getPrisma } = require('../config/database');
const env = require('../config/env');
const { verifyPassword, burnVerificationTime, hashPassword } = require('../auth/password');
const { normalizeIdentifier, profileIdentifiers } = require('../auth/identifier');
const { generateRefreshToken, hashRefreshToken, newFamilyId } = require('../auth/refreshToken');
const { signAccessToken } = require('../keys/jwks');

const ROLES = Object.freeze({ FARMER: 'farmer', BUYER: 'buyer' });
const ACTIVE_STATUS = 'ACTIVE';

// Fields safe to hand back to a client. A strict subset of what
// GET /api/farmers/:id and GET /api/buyers/:id already expose, and never
// anything from AuthAccount. Shared by login, register and refresh so they all
// describe a profile identically.
const FARMER_PROFILE_FIELDS = ['id', 'name', 'phone', 'email', 'kisanId', 'village', 'district', 'state', 'kycStatus'];
const BUYER_PROFILE_FIELDS = ['id', 'name', 'companyName', 'phone', 'email', 'gstin', 'district', 'state', 'buyerType'];

/**
 * The claims carried by a first-party access token.
 *
 * Shared by every token-issuing path so they cannot drift apart. `sub` is the
 * profile id, which is exactly what the existing B3 authorization compares
 * against. The signing primitive owns iss/aud/alg/kid/iat/exp.
 */
function accessTokenClaims(role, profile) {
  return {
    sub: profile.id,
    role,
    email: profile.email || undefined,
    name: profile.name || undefined,
  };
}

/**
 * Projects a stored profile row onto the public field set for its role.
 *
 * @param {string} role 'farmer' | 'buyer'
 * @param {object} row the Prisma row
 */
function publicProfile(role, row) {
  const fields = role === ROLES.FARMER ? FARMER_PROFILE_FIELDS : BUYER_PROFILE_FIELDS;
  const out = {};
  for (const field of fields) out[field] = row[field] === undefined ? null : row[field];
  return out;
}

/** The one message every authentication failure returns. */
function invalidCredentials() {
  const err = new Error('Invalid credentials');
  err.status = 401;
  return err;
}

function dbNotConfigured() {
  const err = new Error('Database not configured (DATABASE_URL is not set)');
  err.status = 503;
  return err;
}

function clientOrThrow() {
  const prisma = getPrisma();
  if (!prisma) throw dbNotConfigured();
  return prisma;
}

function isLocked(account, now) {
  return Boolean(account.lockedUntil) && account.lockedUntil.getTime() > now.getTime();
}

/**
 * Records a failed password attempt and applies the lockout policy.
 *
 * Uses a compare-and-set update (the WHERE clause repeats the values that were
 * read) so two concurrent failures cannot both read the same counter and lose an
 * increment. When the threshold is reached the account is locked for the
 * configured window AND the counter resets, which is what keeps the lockout
 * bounded instead of permanent.
 */
async function registerFailedAttempt(prisma, account, now) {
  const threshold = env.authLockoutMaxAttempts;
  const attempts = (account.failedAttempts || 0) + 1;
  const shouldLock = attempts >= threshold;

  const data = shouldLock
    ? {
        failedAttempts: 0,
        lockedUntil: new Date(now.getTime() + env.authLockoutDurationMinutes * 60 * 1000),
      }
    : { failedAttempts: attempts };

  await prisma.authAccount.updateMany({
    where: {
      id: account.id,
      failedAttempts: account.failedAttempts || 0,
      lockedUntil: account.lockedUntil,
    },
    data,
  });
}

/**
 * Clears the lockout state and stamps the login. Also a compare-and-set so a
 * lock applied by a concurrent attempt is not silently wiped.
 */
async function registerSuccessfulLogin(prisma, account, now) {
  await prisma.authAccount.updateMany({
    where: {
      id: account.id,
      failedAttempts: account.failedAttempts || 0,
      lockedUntil: account.lockedUntil,
    },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: now,
    },
  });
}

/**
 * Loads the profile an AuthAccount points at and proves the link is sound.
 *
 * AuthAccount has no foreign key on purpose, so the profile is looked up in the
 * table that matches the role. A farmer account pointing at a buyer id (or at
 * nothing) therefore fails here instead of authenticating anybody.
 */
async function resolveProfile(prisma, account, identifierNormalized) {
  if (account.role === ROLES.FARMER) {
    const farmer = await prisma.farmer.findUnique({ where: { id: account.userId } });
    if (!farmer) return null;
    if (!profileIdentifiers(farmer, ROLES.FARMER).includes(identifierNormalized)) return null;
    return { role: ROLES.FARMER, profile: publicProfile(ROLES.FARMER, farmer) };
  }

  if (account.role === ROLES.BUYER) {
    const buyer = await prisma.buyer.findUnique({ where: { id: account.userId } });
    if (!buyer) return null;
    if (!profileIdentifiers(buyer, ROLES.BUYER).includes(identifierNormalized)) return null;
    return { role: ROLES.BUYER, profile: publicProfile(ROLES.BUYER, buyer) };
  }

  return null;
}

/**
 * Authenticates a farmer or buyer and mints an access token.
 *
 * @param {{role: string, identifier: string, password: string}} input
 * @returns {Promise<{access_token: string, token_type: string, expires_in: number, role: string, user_id: string, profile: object}>}
 * @throws 401 for every authentication failure, 400 for a malformed request,
 *   503 when the database or the signing key is unavailable.
 */
async function login({ role, identifier, password }) {
  const prisma = clientOrThrow();
  const now = new Date();
  // Normalized with the REQUESTED role, so a GSTIN-shaped value supplied to the
  // farmer portal is treated as a Kisan ID and vice versa. The same function
  // must be used with the same role when the credential is created.
  const identifierNormalized = normalizeIdentifier(identifier, role);

  if (!identifierNormalized) {
    await burnVerificationTime(password);
    throw invalidCredentials();
  }

  // Scoped by BOTH role and normalized identifier: a client cannot ask for a
  // different role than the one the credential was created under.
  const account = await prisma.authAccount.findUnique({
    where: { identifierNormalized },
  });

  if (!account || account.role !== role) {
    // Spend comparable time so a missing account is not distinguishable by
    // response latency, then fail identically.
    await burnVerificationTime(password);
    throw invalidCredentials();
  }

  if (account.status !== ACTIVE_STATUS) {
    await burnVerificationTime(password);
    throw invalidCredentials();
  }

  if (isLocked(account, now)) {
    // Deliberately does not extend the lock or count as a new attempt.
    await burnVerificationTime(password);
    throw invalidCredentials();
  }

  const passwordOk = await verifyPassword(password, account.passwordHash);
  if (!passwordOk) {
    await registerFailedAttempt(prisma, account, now);
    throw invalidCredentials();
  }

  const resolved = await resolveProfile(prisma, account, identifierNormalized);
  if (!resolved) {
    // Correct password but the account does not describe a real, matching
    // profile. No state is changed, and the caller learns nothing.
    throw invalidCredentials();
  }

  await registerSuccessfulLogin(prisma, account, now);

  // The signing primitive owns iss/aud/alg/kid/iat/exp. Only the identity and
  // display claims come from here.
  const accessToken = await signAccessToken(accessTokenClaims(resolved.role, resolved.profile));

  // Mint the first refresh token of a new family. Without this the refresh
  // endpoint could never receive a valid token, so it is part of implementing
  // refresh rather than a separate feature. Only the digest is stored.
  const rawRefreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: resolved.profile.id,
      role: resolved.role,
      tokenHash: hashRefreshToken(rawRefreshToken),
      familyId: newFamilyId(),
      expiresAt: refreshExpiry(now),
    },
  });

  return {
    access_token: accessToken,
    refresh_token: rawRefreshToken,
    token_type: 'Bearer',
    expires_in: env.accessTokenTtlSeconds,
    role: resolved.role,
    user_id: resolved.profile.id,
    profile: resolved.profile,
  };
}

// --- Registration -----------------------------------------------------------

// Fields written to each profile table. Listed explicitly rather than spreading
// the request, so a field the caller must never control (id, kycStatus,
// trustScore, timestamps, verification flags) cannot be injected even if the
// request schema is later loosened.
const FARMER_WRITABLE = ['name', 'phone', 'email', 'kisanId', 'village', 'district', 'state', 'latitude', 'longitude'];
const BUYER_WRITABLE = [
  'name',
  'companyName',
  'phone',
  'email',
  'gstin',
  'buyerType',
  'village',
  'district',
  'state',
  'latitude',
  'longitude',
];

/**
 * Narrows a validated profile body to the columns its table actually has.
 * `undefined` becomes `null` so "not supplied" is stored as NULL rather than
 * silently relying on Prisma's field omission.
 */
function buildProfileData(role, profile) {
  const writable = role === ROLES.FARMER ? FARMER_WRITABLE : BUYER_WRITABLE;
  const data = {};
  for (const field of writable) {
    if (profile[field] !== undefined) data[field] = profile[field] === undefined ? null : profile[field];
  }
  return data;
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

/** Deliberately vague: it must not reveal whose identifier it is. */
function identifierConflict() {
  const err = new Error('Identifier already registered');
  err.status = 409;
  return err;
}

/**
 * Creates a Farmer or Buyer profile together with its login credential.
 *
 * The profile and the AuthAccount are written in ONE interactive transaction:
 * a profile must never survive without its credential, and vice versa. All
 * other account state is left to the schema defaults — status ACTIVE,
 * failedAttempts 0, lockedUntil null, lastLoginAt null, and crucially
 * phoneVerifiedAt / emailVerifiedAt NULL, because nothing has verified this
 * account yet.
 *
 * No token is issued here; the client logs in with its new credentials.
 *
 * @param {{role: string, identifier: string, password: string, profile: object}} input
 */
async function register({ role, identifier, password, profile }) {
  const prisma = clientOrThrow();

  // Same function, same role argument as login, so the normalized value is
  // identical for identical input.
  const identifierNormalized = normalizeIdentifier(identifier, role);
  if (!identifierNormalized) {
    throw badRequest('A valid identifier is required');
  }

  // scrypt is deliberately slow, so it runs BEFORE the transaction opens:
  // hashing inside one would hold a pooled connection open for ~100ms per
  // registration and needlessly widen the window for lock contention.
  const passwordHash = await hashPassword(password);

  try {
    return await prisma.$transaction(async (tx) => {
      const profileData = buildProfileData(role, profile);
      const created =
        role === ROLES.FARMER ? await tx.farmer.create({ data: profileData }) : await tx.buyer.create({ data: profileData });

      // Integrity gate, enforced before the credential is written: the login
      // identifier must be one this profile actually owns, otherwise login
      // could never resolve the account (login enforces the same rule).
      if (!profileIdentifiers(created, role).includes(identifierNormalized)) {
        throw badRequest('identifier does not match any identifier on the profile');
      }

      const account = await tx.authAccount.create({
        data: {
          userId: created.id,
          role,
          identifier: String(identifier).trim(),
          identifierNormalized,
          passwordHash,
        },
      });

      // Post-conditions required of the stored pair. A violation means the two
      // rows disagree, which must abort rather than commit a broken account.
      if (account.userId !== created.id || account.role !== role) {
        throw new Error('AuthAccount does not match the created profile');
      }
      if (account.identifierNormalized !== identifierNormalized) {
        throw new Error('AuthAccount identifier does not match the requested identifier');
      }

      return {
        user_id: created.id,
        role,
        profile: publicProfile(role, created),
      };
    });
  } catch (err) {
    // The database unique constraints are the authoritative duplicate check:
    // a pre-flight lookup could still race two concurrent registrations, while
    // P2002 cannot. Mapped to one generic 409 that names no field and exposes
    // no other user's data.
    if (err && err.code === 'P2002') throw identifierConflict();
    throw err;
  }
}

// --- Current identity -------------------------------------------------------

/**
 * The JWT identity did not resolve to a profile that still exists.
 *
 * 401 rather than 404: the caller already proved possession of a valid token,
 * so this says nothing about any other account, and 404 would wrongly imply a
 * resource-addressing problem.
 */
function identityUnavailable() {
  const err = new Error('Authenticated account is no longer available');
  err.status = 401;
  return err;
}

/**
 * Resolves the profile behind an already-verified identity.
 *
 * `user` is `req.user`, produced exclusively by requireAuth from the verified
 * JWT. Nothing here reads a body, a query parameter, a path parameter, a cookie
 * or a header, so a caller cannot choose whose profile is returned.
 *
 * The role selects exactly one table and there is no cross-role fallback: a
 * farmer token can only ever resolve a Farmer and a buyer token only a Buyer, so
 * one can never read the other's profile. Any other role (for example `admin`,
 * which is a cross-participant role with no profile of its own) is refused.
 *
 * Account status is deliberately NOT re-checked here. The existing convention
 * is that it is enforced when a token is issued (see login), and staleness is
 * bounded by ACCESS_TOKEN_TTL_SECONDS. Enforcing it on this endpoint alone
 * would make a deactivated user get 401 from /me while /api/deals still
 * answered 200 for the same token. If per-request revocation is ever wanted it
 * belongs in requireAuth, so every protected endpoint shares one policy.
 *
 * @param {{id: string, role: string}} user req.user
 * @returns {Promise<{user_id: string, role: string, profile: object}>}
 */
async function me(user) {
  if (!user || !user.id || !user.role) throw identityUnavailable();
  const prisma = clientOrThrow();

  if (user.role === ROLES.FARMER) {
    const farmer = await prisma.farmer.findUnique({ where: { id: user.id } });
    if (!farmer) throw identityUnavailable();
    return { user_id: farmer.id, role: ROLES.FARMER, profile: publicProfile(ROLES.FARMER, farmer) };
  }

  if (user.role === ROLES.BUYER) {
    const buyer = await prisma.buyer.findUnique({ where: { id: user.id } });
    if (!buyer) throw identityUnavailable();
    return { user_id: buyer.id, role: ROLES.BUYER, profile: publicProfile(ROLES.BUYER, buyer) };
  }

  throw identityUnavailable();
}

// --- Refresh token rotation -------------------------------------------------

/**
 * Every refresh failure returns this one message. A caller must not be able to
 * distinguish "no such token" from "expired", "revoked", "already rotated" or
 * "the profile is gone", because that difference is exactly what an attacker
 * enumerating stolen tokens wants.
 */
function invalidRefreshToken() {
  const err = new Error('Invalid refresh token');
  err.status = 401;
  return err;
}

/** Internal signal: this token was already spent, so the family is compromised. */
function reuseDetected() {
  const err = new Error('Refresh token reuse detected');
  err.reuseDetected = true;
  return err;
}

function refreshExpiry(now) {
  return new Date(now.getTime() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

/**
 * Revokes every still-live token in a family. Called when reuse is detected so
 * that a stolen token cannot be rotated even once before the legitimate client
 * notices, and so the attacker and the victim are both locked out.
 */
async function revokeFamily(prisma, familyId, now) {
  if (!familyId) return;
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: now },
  });
}

/**
 * Exchanges a refresh token for a fresh access token and refresh token.
 *
 * The token is opaque: it is looked up by SHA-256 digest, never parsed or
 * decoded, and the raw value is never persisted or logged.
 *
 * Rotation is single-use and enforced by a CONDITIONAL update
 * (`WHERE revokedAt IS NULL`). That is the whole concurrency story: the
 * database decides which of two simultaneous requests wins, and the loser
 * matches no row, so a token can never be rotated twice. Presenting an
 * already-revoked token is treated as reuse and kills the whole family.
 *
 * @param {{refresh_token: string}} input
 * @returns {Promise<{access_token: string, refresh_token: string, token_type: string, expires_in: number, role: string, user_id: string, profile: object}>}
 */
async function refresh({ refresh_token: presented }) {
  const prisma = clientOrThrow();
  const now = new Date();
  const tokenHash = hashRefreshToken(presented);

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored) throw invalidRefreshToken();

  // Already revoked means this token was rotated before, so whoever holds it now
  // is not the original client. Burn the family and issue nothing.
  if (stored.revokedAt) {
    await revokeFamily(prisma, stored.familyId, now);
    throw invalidRefreshToken();
  }

  if (stored.expiresAt.getTime() <= now.getTime()) {
    throw invalidRefreshToken();
  }

  // The role on the token selects exactly one profile table, with no cross-role
  // fallback, so a token can never be exchanged for the other role's profile.
  let profile = null;
  if (stored.role === ROLES.FARMER) {
    profile = await prisma.farmer.findUnique({ where: { id: stored.userId } });
  } else if (stored.role === ROLES.BUYER) {
    profile = await prisma.buyer.findUnique({ where: { id: stored.userId } });
  }
  if (!profile) {
    // The credential outlived its profile; the family is unusable.
    await revokeFamily(prisma, stored.familyId, now);
    throw invalidRefreshToken();
  }

  // Refresh is a token-ISSUANCE point, exactly like login, so the existing
  // convention of enforcing account status at issuance applies here too.
  // Without this a suspended account could keep minting access tokens for the
  // whole REFRESH_TOKEN_TTL_DAYS window, which would make suspension pointless.
  const account = await prisma.authAccount.findUnique({ where: { userId: stored.userId } });
  if (!account || account.status !== ACTIVE_STATUS || account.role !== stored.role) {
    await revokeFamily(prisma, stored.familyId, now);
    throw invalidRefreshToken();
  }

  const role = stored.role;
  const publicData = publicProfile(role, profile);

  // Signed before the rotation is committed: if signing is unavailable the
  // caller's refresh token stays usable instead of being burned for nothing.
  const accessToken = await signAccessToken(accessTokenClaims(role, publicData));

  const rawToken = generateRefreshToken();
  // Cap the successor at the incoming expiry so a family has an ABSOLUTE
  // lifetime: an actively used session still dies when the original window
  // ends, rather than sliding forward forever.
  const expiresAt = new Date(Math.min(refreshExpiry(now).getTime(), stored.expiresAt.getTime()));

  try {
    await prisma.$transaction(async (tx) => {
      // Single-use claim. Exactly one concurrent caller can flip revokedAt from
      // NULL, so a token can be rotated at most once.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (claimed.count === 0) throw reuseDetected();

      await tx.refreshToken.create({
        data: {
          userId: stored.userId,
          role: stored.role,
          tokenHash: hashRefreshToken(rawToken),
          // The family is preserved, which is what links the successor to its
          // ancestors for reuse detection.
          familyId: stored.familyId,
          expiresAt,
        },
      });
    });
  } catch (err) {
    if (err && err.reuseDetected) {
      // Lost the race, or a duplicate arrived after a successful rotation.
      // The transaction rolled back, so revoke the family out here.
      await revokeFamily(prisma, stored.familyId, new Date());
      throw invalidRefreshToken();
    }
    throw err;
  }

  return {
    access_token: accessToken,
    refresh_token: rawToken,
    token_type: 'Bearer',
    expires_in: env.accessTokenTtlSeconds,
    role,
    user_id: publicData.id,
    profile: publicData,
  };
}

// --- Logout ----------------------------------------------------------------

/**
 * Revokes the refresh-token credential supplied by the caller, ending the whole
 * session rather than a single token.
 *
 * No Authorization header is required: the refresh token IS the credential, and
 * an access token is deliberately not accepted, so signing out does not depend
 * on an access token that may already have expired.
 *
 * The refresh token is located by the same SHA-256 digest and never parsed, so
 * the format and hashing are identical to refresh and no new scheme is
 * introduced.
 *
 * Revocation is a soft UPDATE of revokedAt: rows are kept, so the reuse
 * detection in refresh() still recognises a spent token instead of it looking
 * like a token that never existed.
 *
 * Concurrency reuses the mechanism established in refresh(): a conditional
 * update is the atomic gate, inside the same kind of interactive transaction.
 * That matters because logout can race an in-flight refresh — and if the
 * refresh won, the family has a fresh LIVE successor that a naive
 * revoke-one-row logout would miss. The conditional claim detects that, and
 * the family is then revoked unconditionally so an explicit logout always ends
 * the session.
 *
 * @param {{refresh_token: string}} input
 * @returns {Promise<{message: string}>}
 */
async function logout({ refresh_token: presented }) {
  const prisma = clientOrThrow();
  const now = new Date();
  const tokenHash = hashRefreshToken(presented);

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  // Unknown token: nothing to revoke, and the same answer as every other
  // failure so this endpoint is not an existence oracle.
  if (!stored) throw invalidRefreshToken();

  if (stored.revokedAt) {
    // This token was already spent, so per the auth conventions logout is not a
    // successful authentication event and the generic response is returned. The
    // family is still revoked, because a rotated token leaves a LIVE successor
    // behind and an explicit logout must not leave a usable session running.
    await revokeFamily(prisma, stored.familyId, now);
    throw invalidRefreshToken();
  }

  if (stored.expiresAt.getTime() <= now.getTime()) {
    // Expired, so not a successful event either. No revocation is needed: every
    // descendant inherits the family expiry, so the whole family is already
    // dead and revoking it would be a no-op.
    throw invalidRefreshToken();
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Atomic claim: exactly one caller can flip this row out of "live".
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (claimed.count === 0) throw reuseDetected();

      // Then kill everything else still live in the same family.
      await tx.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
  } catch (err) {
    if (err && err.reuseDetected) {
      // A concurrent refresh claimed the token first and minted a successor.
      // Roll the transaction back and revoke the family out here, so logout
      // still ends the session it was asked to end.
      await revokeFamily(prisma, stored.familyId, new Date());
      throw invalidRefreshToken();
    }
    throw err;
  }

  // Deliberately minimal: no token, no identity, no internals. Nothing here
  // reveals whether the token existed, since the only other outcome is the same
  // 401 every failure returns.
  return { message: 'Logged out successfully' };
}

module.exports = {
  ROLES,
  ACTIVE_STATUS,
  FARMER_PROFILE_FIELDS,
  BUYER_PROFILE_FIELDS,
  publicProfile,
  accessTokenClaims,
  login,
  register,
  me,
  refresh,
  logout,
  invalidCredentials,
  identityUnavailable,
  invalidRefreshToken,
  revokeFamily,
  // Exported for focused unit tests of the policy.
  registerFailedAttempt,
  registerSuccessfulLogin,
  isLocked,
  resolveProfile,
  buildProfileData,
};
