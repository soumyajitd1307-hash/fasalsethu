import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Role-aware route guard.
 *
 * Rules:
 *  - while the session is being restored, render a full-page loader so a reload
 *    never flashes the login form at an authenticated user;
 *  - anonymous users are sent to the portal chooser;
 *  - an authenticated user with the wrong role is sent to THEIR OWN portal
 *    rather than shown a dead end, and never to the page they asked for;
 *  - role comes from the verified session only. Nothing here reads a URL
 *    parameter, a query string or a route name to decide who the user is.
 *
 * The backend remains the authority on every request; this is a UX boundary,
 * not an authorization control.
 */

// Where each role belongs. `/buyer` is a public marketing page today, so it is
// the natural landing spot for a signed-in buyer.
const ROLE_HOME = {
  farmer: '/seller',
  buyer: '/buyer',
}

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-4 border-green-100 border-t-green-500 animate-spin" />
          <div className="absolute inset-3 rounded-full border-2 border-green-100 border-b-lime-400 animate-spin" style={{ animationDirection: 'reverse' }} />
        </div>
        <p className="text-green-600 text-sm font-medium">Restoring your session...</p>
      </div>
    </div>
  )
}

export default function ProtectedRoute({ allow = [], children }) {
  const { status, role } = useAuth()
  const location = useLocation()

  if (status === 'restoring') {
    return <FullPageLoader />
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Empty `allow` means "any authenticated role".
  if (allow.length > 0 && !allow.includes(role)) {
    return <Navigate to={ROLE_HOME[role] || '/'} replace />
  }

  return children
}
