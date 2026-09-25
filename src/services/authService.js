/**
 * FasalSetu Authentication Service
 * Wraps Auth0 authentication state & API token helpers.
 */
import { apiClient } from './apiClient'

export const authService = {
  /**
   * Register the Auth0 getAccessTokenSilently function with the apiClient
   * to automatically attach JWT Bearer tokens to backend requests.
   */
  initializeApiTokenInterceptor(getAccessTokenSilently) {
    if (typeof getAccessTokenSilently === 'function') {
      apiClient.setTokenGetter(async () => {
        try {
          const audience = import.meta.env.VITE_AUTH0_AUDIENCE
          const token = await getAccessTokenSilently({
            authorizationParams: audience ? { audience } : undefined,
          })
          return token
        } catch (err) {
          // In development or when audience is not registered, silently return null
          return null
        }
      })
    }
  },

  /**
   * Determine user role from Auth0 user claims
   */
  getUserRole(user) {
    if (!user) return 'Guest'
    return (
      user['https://fasalsetu.in/roles']?.[0] ||
      user['https://fasalsetu.in/role'] ||
      user.role ||
      'Farmer'
    )
  },

  /**
   * Format display name for farmer or buyer
   */
  getDisplayName(user) {
    if (!user) return 'Farmer'
    return user.name || user.nickname || user.email?.split('@')[0] || 'Farmer'
  },
}
