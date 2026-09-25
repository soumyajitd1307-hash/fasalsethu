/**
 * Centralized API Client
 * AgriBridge Farmer-Buyer Marketplace (SIH Project M5)
 * 
 * Provides unified HTTP request methods with:
 * - Base URL from environment variable VITE_API_BASE_URL
 * - Request timeout & abort control
 * - Standardized JSON request & error parsing
 * - Automatic detection of backend availability
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const ENABLE_MOCK_FALLBACK = import.meta.env.VITE_ENABLE_MOCK_FALLBACK !== 'false'
const DEFAULT_TIMEOUT_MS = 6000

export class ApiError extends Error {
  constructor(message, status = 500, data = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

let tokenGetter = null

/**
 * Standard fetch wrapper
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

  // Attach Auth0 access token if a token getter is registered
  if (tokenGetter && !headers['Authorization']) {
    try {
      const token = await tokenGetter()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    } catch {
      // Ignore silent token retrieval errors for public routes
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
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
      throw new ApiError(errorMsg, response.status, data)
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

  setTokenGetter(fn) {
    tokenGetter = fn
  },
}
