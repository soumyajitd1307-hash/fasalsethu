import React from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { motion } from 'framer-motion'
import {
  User,
  ShieldCheck,
  MapPin,
  Sparkles,
  Calendar,
  LogOut,
  CheckCircle2,
} from 'lucide-react'
import FarmerDashboard from '../components/FarmerDashboard'

export default function Dashboard() {
  const { user, logout } = useAuth0()

  const handleLogout = () => {
    const baseUrl = import.meta.env.BASE_URL || '/'
    logout({
      logoutParams: {
        returnTo: window.location.origin + (baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`),
      },
    })
  }

  // Extract roles if present in Auth0 custom namespace claims or default to 'Farmer'
  const userRole =
    user?.['https://fasalsetu.in/roles']?.[0] ||
    user?.role ||
    'Verified Farmer'

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      {/* Authenticated User Header Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-green-900 via-emerald-900 to-gray-900 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-green-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* User Profile info */}
          <div className="flex items-center gap-4 relative z-10">
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name || 'User profile'}
                className="w-14 h-14 rounded-2xl border-2 border-green-400/60 object-cover shadow-md"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-green-700 border-2 border-green-400/60 flex items-center justify-center text-white font-bold text-xl shadow-md">
                {(user?.name || user?.nickname || 'U').charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-white">
                  Welcome, {user?.name || user?.nickname || 'Farmer'}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-500/20 border border-green-400/40 text-green-300 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {userRole}
                </span>
              </div>
              <p className="text-green-200/80 text-xs sm:text-sm mt-0.5 flex items-center gap-3">
                <span>{user?.email || 'Auth0 Authenticated'}</span>
                <span className="inline-flex items-center gap-1 text-xs text-lime-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Active Session
                </span>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 relative z-10 self-start md:self-auto">
            <div className="px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-xs text-gray-200 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-lime-400" />
              <span>{new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-1.5 rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Render the Existing Farmer Dashboard */}
      <FarmerDashboard />
    </div>
  )
}
