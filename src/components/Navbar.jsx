import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ArrowRight, User, LogOut, LayoutDashboard } from 'lucide-react'
import { useAuth0 } from '@auth0/auth0-react'

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { isAuthenticated, user, logout } = useAuth0()

  useEffect(() => {
    setMobileOpen(false)
  }, [location])

  const handleLogout = () => {
    const baseUrl = import.meta.env.BASE_URL || '/'
    logout({
      logoutParams: {
        returnTo: window.location.origin + (baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`),
      },
    })
  }

  return (
    <>
      <header className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto flex items-center justify-between gap-4 sm:gap-7 px-4 sm:px-6 py-2 rounded-full bg-white/90 backdrop-blur-md border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:bg-white/95 transition-all duration-300 max-w-5xl w-full"
        >
          {/* Brand: Haven Orange Circular Icon */}
          <Link to="/" className="flex items-center gap-2 group select-none shrink-0">
            <div className="w-5 h-5 rounded-full border-[3px] border-[#ea580c] flex items-center justify-center group-hover:scale-105 transition-transform">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ea580c]" />
            </div>
            <span className="font-display font-bold text-gray-900 text-base tracking-tight">FasalSetu</span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-700">
            <Link to="/" className="hover:text-black transition-colors">Home</Link>
            <a href="#platform" className="hover:text-black transition-colors">Usecases</a>
            <Link to="/buyer" className="hover:text-black transition-colors">Pricing</Link>
            <Link to="/seller" className="hover:text-black transition-colors">Careers</Link>
            <a href="#about" className="hover:text-black transition-colors">Contact</a>
            {isAuthenticated && (
              <Link
                to="/dashboard"
                className="text-green-700 font-semibold hover:text-green-800 transition-colors flex items-center gap-1.5"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
            )}
          </nav>

          {/* Right Action: Login / User Profile */}
          <div className="flex items-center gap-2.5">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full bg-green-50 border border-green-200/80 hover:bg-green-100 transition-colors text-xs font-semibold text-green-900"
                >
                  {user?.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name || 'User'}
                      className="w-6 h-6 rounded-full object-cover border border-green-400"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-green-700 text-white flex items-center justify-center text-[10px]">
                      {(user?.name || user?.nickname || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:inline max-w-[100px] truncate">
                    {user?.name || user?.nickname || 'Account'}
                  </span>
                </Link>

                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-5 py-1.5 rounded-full bg-[#131722] hover:bg-black text-white text-xs sm:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow"
              >
                Login
              </Link>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-full text-gray-700 hover:text-black transition-colors"
              aria-label="Toggle Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </motion.div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            className="fixed top-24 left-4 right-4 z-50 p-6 rounded-3xl bg-white/95 backdrop-blur-xl border border-white/60 shadow-2xl flex flex-col gap-3 md:hidden"
          >
            <Link to="/" className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100">Home</Link>
            <a href="#platform" onClick={() => setMobileOpen(false)} className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100">Usecases</a>
            <Link to="/buyer" className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100">Pricing / Buyer Portal</Link>
            <Link to="/seller" className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100">Careers / Farmer Portal</Link>
            <a href="#about" onClick={() => setMobileOpen(false)} className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100">Contact</a>
            
            {isAuthenticated && (
              <Link
                to="/dashboard"
                className="text-green-800 font-bold text-base py-2 border-b border-green-100 flex items-center gap-2"
              >
                <LayoutDashboard className="w-5 h-5 text-green-600" />
                <span>My Farmer Dashboard</span>
              </Link>
            )}

            <div className="pt-2 flex flex-col gap-2">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="w-full text-center py-3 rounded-full bg-red-50 text-red-700 border border-red-200 font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out ({user?.name || 'Account'})</span>
                </button>
              ) : (
                <>
                  <Link to="/login" className="w-full text-center py-3 rounded-full bg-[#131722] text-white font-semibold text-sm">
                    Login / Sign In
                  </Link>
                  <Link to="/seller" className="w-full text-center py-3 rounded-full border border-gray-300 text-gray-800 font-semibold text-sm">
                    Explore Farmer Portal
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

