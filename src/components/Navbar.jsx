import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, LogOut, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { status, role, user, logout } = useAuth()

  useEffect(() => {
    setMobileOpen(false)
  }, [location])

  const isAuthenticated = status === 'authenticated'
  const displayName = (user && (user.name || user.companyName)) || (role === 'buyer' ? 'Buyer' : 'Farmer')

  /**
   * Signs out. The local session is cleared by authService.logout() even when
   * the backend call fails, so the UI can never be left showing a signed-in
   * shell with no valid credential.
   */
  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <header className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto flex items-center justify-between gap-6 sm:gap-8 px-5 sm:px-7 py-2.5 rounded-full bg-white/85 backdrop-blur-md border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:bg-white/95 transition-all duration-300"
        >
          {/* Brand: Fasal sethu */}
          <Link to="/" className="flex items-center gap-2 group select-none">
            <div className="w-5 h-5 rounded-full border-[3px] border-[#ea580c] flex items-center justify-center group-hover:scale-105 transition-transform">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ea580c]" />
            </div>
            <span className="font-display font-bold text-gray-900 text-base tracking-tight">Fasal sethu</span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700">
            <Link to="/" className="hover:text-black transition-colors">Home</Link>
            <a href="#platform" className="hover:text-black transition-colors">Usecases</a>
            <Link to="/seller" className="hover:text-black transition-colors">Farmer Portal</Link>
            <Link to="/buyer" className="hover:text-black transition-colors">Buyer Portal</Link>
          </nav>

          {/* Right Action: session-aware */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-800 text-xs font-semibold max-w-[160px]"
                  title={displayName}
                >
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{displayName}</span>
                  <span className="text-[10px] uppercase tracking-wide text-green-600/80">
                    {role === 'buyer' ? 'Buyer' : 'Farmer'}
                  </span>
                </span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 hover:text-black text-xs sm:text-sm font-semibold transition-all duration-200"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </>
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
            className="fixed top-24 left-4 right-4 z-50 p-6 rounded-3xl bg-white/95 backdrop-blur-xl border border-white/60 shadow-2xl flex flex-col gap-4 md:hidden"
          >
            <Link to="/" className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100">Home</Link>
            <a href="#platform" onClick={() => setMobileOpen(false)} className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100">Usecases</a>
            <Link to="/seller" className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100">Farmer Portal</Link>
            <Link to="/buyer" className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100">Buyer Portal</Link>
            <div className="pt-2 flex flex-col gap-2">
              {isAuthenticated ? (
                <>
                  <div className="px-3 py-2 rounded-2xl bg-green-50 border border-green-200 text-green-800 text-sm font-semibold truncate">
                    {displayName} · {role === 'buyer' ? 'Buyer' : 'Farmer'}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-center py-3 rounded-full border border-gray-200 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </>
              ) : (
                <Link to="/login" className="w-full text-center py-3 rounded-full bg-[#131722] text-white font-semibold text-sm">
                  Login
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
