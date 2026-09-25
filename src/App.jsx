import React, { Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LanguageProvider } from './context/LanguageContext'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Seller from './pages/Seller'
import Buyer from './pages/Buyer'
import PortalSelection from './pages/auth/PortalSelection'
import FarmerLogin from './pages/auth/FarmerLogin'
import FarmerRegister from './pages/auth/FarmerRegister'
import BuyerLogin from './pages/auth/BuyerLogin'
import BuyerRegister from './pages/auth/BuyerRegister'

/* ── Scroll to top on route change ── */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pathname])
  return null
}

/* ── Page loading fallback ── */
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-4 border-green-100 border-t-green-500 animate-spin" />
          <div
            className="absolute inset-3 rounded-full border-2 border-green-100 border-b-lime-400 animate-spin"
            style={{ animationDirection: 'reverse' }}
          />
        </div>
        <p className="text-green-600 text-sm font-medium">Loading FasalSethu...</p>
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
          {/* Public Website */}
          <Route path="/" element={<Home />} />

          {/* Authentication & Portal Selection */}
          <Route path="/portal-select" element={<PortalSelection />} />
          <Route path="/auth" element={<Navigate to="/portal-select" replace />} />
          <Route path="/login" element={<Navigate to="/portal-select" replace />} />

          {/* Farmer Portal Auth */}
          <Route path="/farmer/login" element={<FarmerLogin />} />
          <Route path="/farmer/register" element={<FarmerRegister />} />

          {/* Buyer Portal Auth */}
          <Route path="/buyer/login" element={<BuyerLogin />} />
          <Route path="/buyer/register" element={<BuyerRegister />} />

          {/* Protected Farmer Dashboard */}
          <Route
            path="/farmer/dashboard"
            element={
              <ProtectedRoute allowedRole="farmer">
                <Seller />
              </ProtectedRoute>
            }
          />
          {/* Legacy /seller route redirects/maps to Farmer Dashboard with protection */}
          <Route
            path="/seller"
            element={
              <ProtectedRoute allowedRole="farmer">
                <Seller />
              </ProtectedRoute>
            }
          />

          {/* Protected Buyer Dashboard */}
          <Route
            path="/buyer/dashboard"
            element={
              <ProtectedRoute allowedRole="buyer">
                <Buyer />
              </ProtectedRoute>
            }
          />
          {/* Legacy /buyer route maps to Buyer Dashboard with protection */}
          <Route
            path="/buyer"
            element={
              <ProtectedRoute allowedRole="buyer">
                <Buyer />
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

/* ── App Shell Layout (hides main navbar on dedicated auth portals) ── */
function AppLayout() {
  const location = useLocation()
  const path = location.pathname

  const isAuthRoute =
    path.startsWith('/farmer/login') ||
    path.startsWith('/farmer/register') ||
    path.startsWith('/buyer/login') ||
    path.startsWith('/buyer/register') ||
    path === '/portal-select' ||
    path === '/auth' ||
    path === '/login'

  return (
    <div className="relative min-h-screen bg-white">
      {!isAuthRoute && <Navbar />}
      <Suspense fallback={<PageLoader />}>
        <AnimatedRoutes />
      </Suspense>
      {!isAuthRoute && <Footer />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <LanguageProvider>
        <AuthProvider>
          <ScrollToTop />
          <AppLayout />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  )
}
