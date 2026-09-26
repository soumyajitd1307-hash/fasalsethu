/**
 * Centralized API Client
 * AgriBridge Farmer-Buyer Marketplace (SIH Project M5)
 * 
 * Provides unified HTTP request methods with:
 * - Base URL from environment variable VITE_API_BASE_URL
 * - Request timeout & abort control
 * - Standardized JSON request & error parsing
 * - Automatic detection of backend availability
 * - Optional bearer-token injection with a single retry after ONE refresh
 *
 * Authentication hooks are injected by AuthContext at runtime rather than
 * imported, so this module stays free of React and free of a circular
 * dependency on authService.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const ENABLE_MOCK_FALLBACK = import.meta.env.VITE_ENABLE_MOCK_FALLBACK !== 'false'
const DEFAULT_TIMEOUT_MS = 6000

// Injected by AuthContext: { getAccessToken, refreshAccessToken, onSessionExpired }
let authHooks = null

/**
 * Registers the authentication hooks. Passing null removes them.
 * Kept as a function (not a bare object) so tests and non-React callers can
 * drive the client without mounting React.
 */
export function setAuthHooks(hooks) {
  authHooks = hooks || null
}

export class ApiError extends Error {
  constructor(message, status = 500, data = null, headers = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    // Raw response headers, so callers can read `Retry-After` on a 429 (and any
    // other rate-limit headers) without this module interpreting them.
    this.headers = headers
  }

  /** Seconds to wait before retrying, from `Retry-After`. Null when absent. */
  get retryAfterSeconds() {
    if (!this.headers) return null
    const raw = this.headers.get ? this.headers.get('retry-after') : null
    if (!raw) return null
    const seconds = Number(raw)
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null
  }
}

function isAuthEndpoint(endpoint) {
  return String(endpoint).replace(/^\//, '').startsWith('auth/')
}

/**
 * Standard fetch wrapper
 *
 * @param {string} endpoint
 * @param {object} [options]
 * @param {boolean} [options.skipAuthRetry] never attempt a refresh+retry
 * @param {string}  [options.accessToken] override the token for this request
 * @param {boolean} [options._isRetry] internal: marks an already-retried request
 */
async function request(endpoint, options = {}) {
  // If no base URL is defined, throw so the service can gracefully fall back to mock
  if (!API_BASE_URL) {
    throw new ApiError('No backend base URL configured in VITE_API_BASE_URL', 503)
  }

  const url = `${API_BASE_URL}/${endpoint.replace(/^\//, '')}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT_MS)

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  }

  // Attach the bearer token when one exists. Auth endpoints opt out: the login
  // and register calls must never carry a stale token, and /me passes its own.
  const isAuth = isAuthEndpoint(endpoint)
  const token = options.accessToken || (authHooks && !isAuth ? authHooks.getAccessToken() : null)
  if (token) headers.Authorization = `Bearer ${token}`

  // Strip this module's own control options so they are never handed to fetch.
  const { skipAuthRetry, accessToken: _accessToken, _isRetry, timeout, ...fetchOptions } = options
  void skipAuthRetry
  void _accessToken
  void _isRetry
  void timeout

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const contentType = response.headers.get('content-type') || ''
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    if (!response.ok) {
      const errorMsg =
        (data && data.message) || (data && data.error) || `Request failed with status ${response.status}`
      const error = new ApiError(errorMsg, response.status, data, response.headers)

      // One 401 -> one refresh -> one retry. Never recursive, never repeated:
      // `options._isRetry` guarantees a retried request cannot refresh again,
      // so a genuinely expired session fails fast instead of looping.
      const canRetry =
        response.status === 401 &&
        !options._isRetry &&
        !options.skipAuthRetry &&
        !isAuth &&
        authHooks &&
        typeof authHooks.refreshAccessToken === 'function'

      if (canRetry) {
        try {
          await authHooks.refreshAccessToken()
          return await request(endpoint, { ...options, _isRetry: true })
        } catch {
          // Refresh failed: the session is over. Tell the app so it can clear
          // state and route to login, then surface the original 401.
          if (typeof authHooks.onSessionExpired === 'function') {
            try {
              authHooks.onSessionExpired()
            } catch {
              /* ignore listener errors */
            }
          }
          throw error
        }
      }

      throw error
    }

    return data
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new ApiError(`Request timeout after ${options.timeout || DEFAULT_TIMEOUT_MS}ms`, 408)
    }
    if (err instanceof ApiError) {
      throw err
    }
    throw new ApiError(err.message || 'Network error connecting to backend API', 500)
  }
}

export const apiClient = {
  isConfigured() {
    return Boolean(API_BASE_URL)
  },

  shouldFallback() {
    return ENABLE_MOCK_FALLBACK
  },

  getBaseUrl() {
    return API_BASE_URL
  },

  get(endpoint, queryParams = {}, options = {}) {
    const cleanParams = Object.entries(queryParams).filter(
      ([, v]) => v !== undefined && v !== null && v !== '' && v !== 'ALL'
    )
    const queryString = new URLSearchParams(cleanParams).toString()
    const finalUrl = queryString ? `${endpoint}?${queryString}` : endpoint
    return request(finalUrl, { ...options, method: 'GET' })
  },

  post(endpoint, data = {}, options = {}) {
    return request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  patch(endpoint, data = {}, options = {}) {
    return request(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  delete(endpoint, options = {}) {
    return request(endpoint, { ...options, method: 'DELETE' })
  },
}
