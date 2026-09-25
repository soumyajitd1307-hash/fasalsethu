import React, { useEffect } from 'react'
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../../services/authService'

/**
 * Helper to link Auth0's getAccessTokenSilently with apiClient
 */
function ApiTokenInitializer({ children }) {
  const { getAccessTokenSilently } = useAuth0()

  useEffect(() => {
    authService.initializeApiTokenInterceptor(getAccessTokenSilently)
  }, [getAccessTokenSilently])

  return children
}

/**
 * Auth0Provider wrapper that integrates with React Router DOM navigation.
 * Handles redirect callbacks to restore the user's intended route after authentication.
 */
export default function Auth0ProviderWithNavigate({ children }) {
  const navigate = useNavigate()

  const domain = import.meta.env.VITE_AUTH0_DOMAIN
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE

  const onRedirectCallback = (appState) => {
    // Navigate to original intended route or fallback to dashboard
    const returnTo = appState?.returnTo || '/dashboard'
    navigate(returnTo, { replace: true })
  }

  // Base URL calculation to support subpath hosting (e.g. GitHub Pages)
  const baseUrl = import.meta.env.BASE_URL || '/'
  const redirectUri = window.location.origin + (baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)

  // If Auth0 environment variables are not configured, render children with a safe fallback
  if (!domain || !clientId) {
    return (
      <Auth0Provider
        domain={domain || 'dummy-domain.auth0.com'}
        clientId={clientId || 'dummy-client-id'}
        authorizationParams={{
          redirect_uri: redirectUri,
          ...(audience ? { audience } : {}),
        }}
        onRedirectCallback={onRedirectCallback}
      >
        <ApiTokenInitializer>{children}</ApiTokenInitializer>
      </Auth0Provider>
    )
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        ...(audience ? { audience } : {}),
      }}
      onRedirectCallback={onRedirectCallback}
      cacheLocation="localstorage"
    >
      <ApiTokenInitializer>{children}</ApiTokenInitializer>
    </Auth0Provider>
  )
}

