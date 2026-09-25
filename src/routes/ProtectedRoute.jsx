import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function ProtectedRoute({ children, allowedRole }) {
  const { user, role, loading } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()

  // 1. Show loading state while Firebase auth is being checked
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-green-900 border-t-emerald-400 animate-spin" />
          <div
            className="absolute inset-2 rounded-full border-2 border-green-800 border-b-lime-400 animate-spin"
            style={{ animationDirection: 'reverse' }}
          />
        </div>
        <h3 className="font-display font-bold text-white text-lg mb-1">
          {t('common.appName')}
        </h3>
        <p className="text-emerald-400 text-sm font-mono tracking-wide animate-pulse">
          {t('common.checkingAuth')}
        </p>
      </div>
    )
  }

  // 2. Unauthenticated user: redirect to portal selection or role login
  if (!user) {
    const targetLogin = allowedRole === 'buyer' ? '/buyer/login' : '/farmer/login'
    return <Navigate to={targetLogin} state={{ from: location }} replace />
  }

  // 3. Authenticated but wrong role: cross-redirect appropriately
  if (allowedRole && role && role !== allowedRole) {
    // If a Farmer tries to access Buyer dashboard, redirect to /farmer/dashboard
    if (role === 'farmer') {
      return <Navigate to="/farmer/dashboard" replace />
    }
    // If a Buyer tries to access Farmer dashboard, redirect to /buyer/dashboard
    if (role === 'buyer') {
      return <Navigate to="/buyer/dashboard" replace />
    }
    // Fallback
    return <Navigate to="/portal-select" replace />
  }

  return children
}
