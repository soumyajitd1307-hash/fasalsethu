import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ArrowRight } from 'lucide-react'

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

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
          {/* Brand: Haven Orange Circular Icon */}
          <Link to="/" className="flex items-center gap-2 group select-none">
            <div className="w-5 h-5 rounded-full border-[3px] border-[#ea580c] flex items-center justify-center group-hover:scale-105 transition-transform">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ea580c]" />
            </div>
            <span className="font-display font-bold text-gray-900 text-base tracking-tight">Haven</span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700">
            <Link to="/" className="hover:text-black transition-colors">Home</Link>
            <a href="#platform" className="hover:text-black transition-colors">Usecases</a>
            <Link to="/buyer" className="hover:text-black transition-colors">Pricing</Link>
            <Link to="/seller" className="hover:text-black transition-colors">Careers</Link>
            <a href="#about" className="hover:text-black transition-colors">Contact</a>
          </nav>

          {/* Right Action: Login Button */}
          <div className="flex items-center gap-3">
            <Link
              to="/seller"
              className="px-5 py-1.5 rounded-full bg-[#131722] hover:bg-black text-white text-xs sm:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow"
            >
              Login
            </Link>

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
            <Link to="/buyer" className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100">Pricing / Buyer Portal</Link>
            <Link to="/seller" className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100">Careers / Farmer Portal</Link>
            <a href="#about" onClick={() => setMobileOpen(false)} className="text-gray-800 font-semibold text-base py-2 border-b border-gray-100">Contact</a>
            <div className="pt-2 flex flex-col gap-2">
              <Link to="/seller" className="w-full text-center py-3 rounded-full bg-[#131722] text-white font-semibold text-sm">
                Login / Farmer Portal
              </Link>
              <Link to="/buyer" className="w-full text-center py-3 rounded-full border border-gray-300 text-gray-800 font-semibold text-sm">
                Buyer Portal
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
