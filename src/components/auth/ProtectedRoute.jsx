import React, { useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { useLocation, Link } from 'react-router-dom'
import { ShieldCheck, AlertTriangle, ArrowRight } from 'lucide-react'

/**
 * Route protection component for FasalSetu authenticated areas.
 * Checks Auth0 authentication state and redirects unauthenticated users
 * to Auth0 Universal Login, preserving the requested route.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, loginWithRedirect, error } = useAuth0()
  const location = useLocation()

  const domain = import.meta.env.VITE_AUTH0_DOMAIN
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID
  const isAuth0Configured = Boolean(domain && clientId && !domain.includes('dummy') && !clientId.includes('dummy'))

  useEffect(() => {
    if (!isLoading && !isAuthenticated && isAuth0Configured) {
      loginWithRedirect({
        appState: { returnTo: location.pathname + location.search },
      })
    }
  }, [isLoading, isAuthenticated, isAuth0Configured, location, loginWithRedirect])

  // Auth0 Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-green-100 border-t-green-600 animate-spin" />
            <div
              className="absolute inset-3 rounded-full border-2 border-green-100 border-b-lime-500 animate-spin"
              style={{ animationDirection: 'reverse' }}
            />
          </div>
          <h3 className="text-gray-900 font-display font-semibold text-lg">
            Verifying Secure Session
          </h3>
          <p className="text-gray-500 text-sm">
            Please wait while FasalSetu verifies your authentication with Auth0...
          </p>
        </div>
      </div>
    )
  }

  // Auth0 Configuration Warning for Local Development
  if (!isAuth0Configured && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-20">
        <div className="bg-white border border-amber-200 rounded-3xl p-8 max-w-lg w-full shadow-xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4 text-amber-600">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold font-display text-gray-900 mb-2">
            Auth0 Configuration Needed
          </h2>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            This protected route requires Auth0 credentials. Please set{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 text-xs font-mono">
              VITE_AUTH0_DOMAIN
            </code>{' '}
            and{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 text-xs font-mono">
              VITE_AUTH0_CLIENT_ID
            </code>{' '}
            in your <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 text-xs font-mono">.env</code> file.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/login"
              className="px-6 py-2.5 rounded-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
            >
              Go to Login Page <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/"
              className="px-6 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Error during authentication
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-20">
        <div className="bg-white border border-red-200 rounded-3xl p-8 max-w-md w-full shadow-xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4 text-red-600">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold font-display text-gray-900 mb-2">
            Authentication Error
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            We couldn't verify your session. Please sign in again.
          </p>
          <button
            onClick={() => loginWithRedirect({ appState: { returnTo: location.pathname } })}
            className="w-full py-3 rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors shadow"
          >
            Retry Login
          </button>
        </div>
      </div>
    )
  }

  // If authenticated, render children
  if (isAuthenticated) {
    return children
  }

  return null
}
