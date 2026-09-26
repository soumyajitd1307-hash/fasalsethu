/**
 * First-party authentication service.
 *
 * Owns the entire token lifecycle so no component ever touches storage or
 * builds an auth header itself. Framework-agnostic on purpose: React state lives
 * in context/AuthContext.jsx, never here.
 *
 * TOKEN STORAGE RATIONALE
 *  - Access token: IN MEMORY ONLY. A short-lived bearer token in localStorage is
 *    readable by any injected script, so it is deliberately never persisted. It
 *    is re-obtained on every page load via the refresh token.
 *  - Refresh token: localStorage under ONE namespaced key, because it must
 *    survive a reload for the session to be restored. It is opaque, not a JWT,
 *    and is only ever sent in a request body.
 *  - Tokens are never logged, never placed in a URL, and never put in a header
 *    the app does not control.
 *
 * SINGLE-FLIGHT REFRESH IS A CORRECTNESS REQUIREMENT, NOT AN OPTIMISATION.
 * The backend rotates the refresh token on every use and treats any replay of a
 * spent token as a compromise, revoking the ENTIRE family. If two 401s each
 * triggered their own refresh, the second would present a token the first had
 * already spent, and the user's whole session would be destroyed. Every caller
 * therefore awaits the same in-flight promise.
 */

import { apiClient } from './apiClient'

const REFRESH_TOKEN_STORAGE_KEY = 'fasalsethu.auth.refreshToken'

const AUTH_ENDPOINT_PREFIX = 'auth/'

// In-memory only. Never written to storage.
let accessToken = null
let sessionMeta = null // { role, userId }

const listeners = new Set()

/* ── storage helpers (localStorage may be unavailable: private mode, SSR) ── */

function readStoredRefreshToken() {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredRefreshToken(token) {
  try {
    if (token) window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token)
    else window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    /* storage unavailable: the session simply will not survive a reload */
  }
}

/* ── session state ── */

/**
 * Notifies subscribers (AuthContext) that the session changed. The payload
 * deliberately contains no tokens, so it is safe for UI code to hold.
 */
function emitSession(nextMeta) {
  sessionMeta = nextMeta
  for (const listener of listeners) {
    try {
      listener(nextMeta)
    } catch {
      /* a broken subscriber must not break the auth layer */
    }
  }
}

export function subscribeToSession(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** In-memory access token for request headers. Never persisted. */
export function getAccessToken() {
  return accessToken
}

export function getRefreshToken() {
  return readStoredRefreshToken()
}

export function hasStoredSession() {
  return Boolean(readStoredRefreshToken())
}

export function getSessionMeta() {
  return sessionMeta
}

/**
 * Atomically adopts a token pair returned by the backend. Both halves are
 * replaced together so the in-memory access token and the stored refresh token
 * can never describe different sessions.
 */
function adoptSession(data) {
  accessToken = data.access_token
  writeStoredRefreshToken(data.refresh_token)
  emitSession({ role: data.role, userId: data.user_id })
  return data
}

/** Drops every trace of the session, locally, without calling the backend. */
export function clearSession() {
  accessToken = null
  writeStoredRefreshToken(null)
  emitSession(null)
}

/* ── endpoints ── */

/**
 * `skipAuthRetry` keeps the auth endpoints out of the 401-refresh cycle: a 401
 * from /login means "bad credentials", never "token expired", and retrying it
 * would be both wrong and a way to burn the refresh token.
 */
function authOptions(extra = {}) {
  return { skipAuthRetry: true, ...extra }
}

function unwrap(response) {
  return response && response.data !== undefined ? response.data : response
}

/**
 * Exchanges credentials for a token pair.
 * @param {'farmer'|'buyer'} role
 * @param {string} identifier Kisan ID / phone / email for a farmer, GSTIN / email / phone for a buyer
 * @param {string} password
 */
export async function login(role, identifier, password) {
  const response = await apiClient.post(
    'auth/login',
    { role, identifier, password },
    authOptions()
  )
  return adoptSession(unwrap(response))
}

/**
 * Creates a profile and its credential. The backend issues NO tokens here, so
 * this never authenticates: the user must sign in afterwards.
 * @param {'farmer'|'buyer'} role
 * @param {{identifier: string, password: string, profile: object}} payload
 */
export async function register(role, payload) {
  const response = await apiClient.post(
    'auth/register',
    { role, identifier: payload.identifier, password: payload.password, profile: payload.profile },
    authOptions()
  )
  return unwrap(response)
}

/**
 * Resolves the authenticated profile. Authoritative for identity: the role and
 * profile come from the server, never from the route or from local storage.
 * @param {string} [token] defaults to the in-memory access token
 */
export async function me(token = accessToken) {
  const response = await apiClient.get('auth/me', {}, authOptions({ accessToken: token }))
  return unwrap(response)
}

/**
 * Single-flight refresh.
 *
 * Only one request is ever in flight; concurrent callers await the same
 * promise. On success the new pair replaces the old one atomically. On failure
 * the session is cleared, because a refresh token that cannot be exchanged is
 * not recoverable and leaving it behind would strand the UI in a half-signed-in
 * state.
 */
let refreshInFlight = null

export function refresh() {
  if (refreshInFlight) return refreshInFlight

  const stored = readStoredRefreshToken()
  if (!stored) {
    clearSession()
    return Promise.reject(new Error('No refresh token available'))
  }

  refreshInFlight = (async () => {
    try {
      const response = await apiClient.post('auth/refresh', { refresh_token: stored }, authOptions())
      return adoptSession(unwrap(response))
    } catch (err) {
      clearSession()
      throw err
    } finally {
      // Cleared only after this attempt settles, so late callers still share it.
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

/**
 * Revokes the presented refresh token's whole family server-side.
 *
 * A failure is deliberately swallowed: logout must always end the local session
 * even when the backend rejects the token, because the token is single-use and
 * the user is left holding a credential the server may already have burned.
 * Local state is cleared either way.
 */
export async function logout() {
  const stored = readStoredRefreshToken()
  try {
    if (stored) {
      await apiClient.post('auth/logout', { refresh_token: stored }, authOptions())
    }
  } catch {
    /* ignore: never block logout on a network or server error */
  } finally {
    clearSession()
  }
}

export const AUTH_STORAGE_KEY = REFRESH_TOKEN_STORAGE_KEY
export { AUTH_ENDPOINT_PREFIX }
