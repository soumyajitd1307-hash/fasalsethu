import React, { Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import Home from './pages/Home'
import Seller from './pages/Seller'
import Buyer from './pages/Buyer'
import LoginHub from './pages/LoginHub'
import FarmerLogin from './pages/FarmerLogin'
import BuyerLogin from './pages/BuyerLogin'
import FarmerRegister from './pages/FarmerRegister'
import BuyerRegister from './pages/BuyerRegister'

/* ── Scroll to top on route change ── */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [pathname])
  return null
}

/* ── Page loading fallback ── */
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-4 border-green-100 border-t-green-500 animate-spin" />
          <div className="absolute inset-3 rounded-full border-2 border-green-100 border-b-lime-400 animate-spin" style={{ animationDirection: 'reverse' }} />
        </div>
        <p className="text-green-600 text-sm font-medium">Loading AgriBridge...</p>
      </div>
    </div>
  )
}

/* ── Animated routes ── */
function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        <Routes location={location} key={location.pathname}>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginHub />} />
          <Route path="/login/farmer" element={<FarmerLogin />} />
          <Route path="/login/buyer" element={<BuyerLogin />} />
          <Route path="/farmer-register" element={<FarmerRegister />} />
          <Route path="/buyer-register" element={<BuyerRegister />} />
          {/* /buyer is a public marketing page today, so it stays unguarded. */}
          <Route path="/buyer" element={<Buyer />} />
          {/* Farmer-only: /seller renders the live FarmerDashboard. */}
          <Route
            path="/seller"
            element={
              <ProtectedRoute allow={['farmer']}>
                <Seller />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Home />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <HashRouter>
      {/* AuthProvider sits inside the router so session-driven redirects work. */}
      <AuthProvider>
        <ScrollToTop />
        <div className="relative min-h-screen bg-white">
          <Navbar />
          <Suspense fallback={<PageLoader />}>
            <AnimatedRoutes />
          </Suspense>
          <Footer />
        </div>
      </AuthProvider>
    </HashRouter>
  )
}
