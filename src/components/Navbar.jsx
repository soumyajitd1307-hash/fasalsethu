import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ArrowRight, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import LanguageSelector from './LanguageSelector'

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, role, profile, isAuthenticated, isFarmer, logout } = useAuth()

  useEffect(() => {
    setMobileOpen(false)
  }, [location])

  return (
    <>
      <header className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto flex items-center justify-between gap-6 sm:gap-8 px-5 sm:px-7 py-2.5 rounded-full bg-white/85 backdrop-blur-md border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:bg-white/95 transition-all duration-300"
        >
          {/* Brand: FasalSethu Emblem */}
          <Link to="/" className="flex items-center gap-2.5 group select-none">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-600 to-emerald-800 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform text-white">
              <span className="text-base leading-none">🌱</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-black text-gray-900 text-base sm:text-lg tracking-tight leading-none">
                Fasal<span className="text-green-600">Sethu</span>
              </span>
              <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider leading-none mt-0.5">
                Marketplace
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-gray-700">
            <Link to="/" className="hover:text-green-700 transition-colors">Home</Link>
            <Link to="/seller" className="hover:text-green-700 transition-colors flex items-center gap-1.5">
              <span>Farmer Portal</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-green-100 text-green-800 rounded-full font-bold">Sell</span>
            </Link>
            <Link to="/buyer" className="hover:text-green-700 transition-colors flex items-center gap-1.5">
              <span>Buyer Hub</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full font-bold">Source</span>
            </Link>
            <a href="/#markets" className="hover:text-green-700 transition-colors">Mandi Rates</a>
            <a href="/#how" className="hover:text-green-700 transition-colors">How It Works</a>
          </nav>

          {/* Right Action: Auth State & Portals */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSelector variant="light" />

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link
                  to={isFarmer ? '/farmer/dashboard' : '/buyer/dashboard'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold hover:bg-emerald-100 transition-all shadow-xs"
                >
                  <span>{isFarmer ? '👨‍🌾' : '🏢'}</span>
                  <span className="max-w-[110px] truncate">{profile?.name || user?.displayName || (isFarmer ? 'Farmer' : 'Buyer')}</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded-full uppercase tracking-wider font-extrabold">
                    {role}
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={async () => {
                    await logout()
                    navigate('/portal-select')
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/portal-select"
                  className="px-3.5 py-1.5 rounded-full bg-green-700 hover:bg-green-800 text-white text-xs sm:text-sm font-bold transition-all shadow-sm hover:shadow flex items-center gap-1.5"
                >
                  <span>🔑 Portal Login</span>
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-full text-gray-700 hover:text-black transition-colors"
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
            className="fixed top-24 left-4 right-4 z-50 p-6 rounded-3xl bg-white/95 backdrop-blur-xl border border-green-100 shadow-2xl flex flex-col gap-4 lg:hidden"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <span className="text-xl">🌱</span>
              <span className="font-display font-black text-gray-900 text-lg">
                Fasal<span className="text-green-600">Sethu</span>
              </span>
            </div>
            <Link to="/" className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100 hover:text-green-700">Home</Link>
            <Link to="/seller" className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100 flex items-center justify-between hover:text-green-700">
              <span>🌾 Farmer Command Center</span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Sell Crops</span>
            </Link>
            <Link to="/buyer" className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100 flex items-center justify-between hover:text-green-700">
              <span>🏢 Buyer Sourcing Hub</span>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Buy Direct</span>
            </Link>
            <a href="/#markets" onClick={() => setMobileOpen(false)} className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100 hover:text-green-700">
              📊 Live APMC Mandi Rates
            </a>
            <div className="pt-2 flex flex-col gap-2">
              {isAuthenticated ? (
                <>
                  <Link
                    to={isFarmer ? '/farmer/dashboard' : '/buyer/dashboard'}
                    className="w-full text-center py-3 rounded-full bg-green-700 text-white font-bold text-sm shadow-sm"
                  >
                    Open {isFarmer ? 'Farmer' : 'Buyer'} Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      await logout()
                      navigate('/portal-select')
                    }}
                    className="w-full text-center py-2.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-sm"
                  >
                    Sign Out ({profile?.name || user?.displayName || role})
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/portal-select"
                    className="w-full text-center py-3 rounded-full bg-green-700 text-white font-bold text-sm shadow-sm"
                  >
                    🔑 Select Portal & Login
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to="/farmer/login"
                      className="text-center py-2 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold"
                    >
                      Farmer Sign In
                    </Link>
                    <Link
                      to="/buyer/login"
                      className="text-center py-2 rounded-xl bg-sky-50 text-sky-800 text-xs font-bold"
                    >
                      Buyer Sign In
                    </Link>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
