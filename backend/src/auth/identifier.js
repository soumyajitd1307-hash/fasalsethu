/**
 * Login identifier normalization.
 *
 * The frontend collects different things per portal — a Kisan ID or mobile
 * number for a farmer, a GSTIN or corporate email for a buyer — but the login
 * request carries a single opaque `identifier` string. The type is therefore
 * derived from the shape of the value, with one deterministic function used by
 * BOTH registration and login so the two can never disagree.
 *
 * Normalization is deliberately conservative:
 *  - whitespace around a value is always insignificant;
 *  - an email is lowercased, which is the universal convention and matches the
 *    case-insensitive mailbox it identifies;
 *  - a phone number keeps its digits and a leading '+', with only formatting
 *    characters removed. Country codes are NEVER guessed or stripped, because
 *    doing so would merge two genuinely different numbers;
 *  - a GSTIN is uppercased, which is its canonical form by specification;
 *  - anything else (a Kisan ID) is only whitespace-collapsed, so two Kisan IDs
 *    that differ by case stay distinct.
 *
 * No rule maps one identifier type onto another, so normalization can never
 * make a farmer identifier collide with a buyer identifier.
 */

const GSTIN_LENGTH = 15;
const FARMER = 'farmer';
const BUYER = 'buyer';

/**
 * @typedef {'email'|'phone'|'gstin'|'kisanId'} IdentifierType
 */

/**
 * Classifies an identifier by shape, scoped to the account type.
 *
 * The role matters: a GSTIN only ever identifies a buyer and a Kisan ID only
 * ever identifies a farmer, exactly as the schema models them. Without that
 * scope a 15-character alphanumeric Kisan ID would be indistinguishable from a
 * GSTIN — and because the two normalize differently (canonical uppercase vs
 * case-preserved) that ambiguity would silently merge two distinct valid
 * identifiers.
 *
 * @param {string} value
 * @param {string} [role] 'farmer' | 'buyer'
 * @returns {IdentifierType}
 */
function detectIdentifierType(value, role) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return 'kisanId';

  if (raw.includes('@')) return 'email';

  // A phone number is digits, an optional leading '+', and formatting
  // characters. The digit count excludes the formatting.
  if (/^\+?[\d\s().-]+$/.test(raw)) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) return 'phone';
  }

  // Canonical-shape GSTIN, considered only where a GSTIN can exist.
  if (role !== FARMER && /^[A-Za-z0-9]{15}$/.test(raw.replace(/\s/g, ''))) return 'gstin';

  return 'kisanId';
}

/**
 * Deterministic normalized form used for AuthAccount lookups.
 *
 * @param {string} value
 * @param {string} [role] 'farmer' | 'buyer' — must be the same role used when
 *   the credential was created, so registration and login always agree.
 * @returns {string}
 */
function normalizeIdentifier(value, role) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';

  switch (detectIdentifierType(raw, role)) {
    case 'email':
      return raw.toLowerCase();
    case 'phone': {
      // Keep an explicit international prefix, drop presentation characters.
      const hasPlus = raw.trimStart().startsWith('+');
      const digits = raw.replace(/\D/g, '');
      return hasPlus ? `+${digits}` : digits;
    }
    case 'gstin':
      return raw.replace(/\s/g, '').toUpperCase();
    case 'kisanId':
    default:
      return raw.replace(/\s+/g, ' ');
  }
}

/**
 * The candidate identifiers a profile can be reached by, each normalized the
 * same way. Used to confirm that an AuthAccount really does describe the
 * profile it points at, rather than trusting the stored link blindly.
 *
 * @param {{email?:string|null, phone?:string|null, kisanId?:string|null, gstin?:string|null}} profile
 * @param {string} [role]
 * @returns {string[]}
 */
function profileIdentifiers(profile, role) {
  if (!profile) return [];
  const fields =
    role === BUYER ? [profile.email, profile.phone, profile.gstin] : [profile.email, profile.phone, profile.kisanId];
  return fields
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .map((value) => normalizeIdentifier(value, role))
    .filter((value) => value !== '');
}

module.exports = {
  GSTIN_LENGTH,
  FARMER,
  BUYER,
  detectIdentifierType,
  normalizeIdentifier,
  profileIdentifiers,
};
