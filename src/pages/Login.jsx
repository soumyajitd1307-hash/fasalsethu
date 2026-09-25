import React, { useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ShieldCheck,
  Sprout,
  Users,
  TrendingUp,
  ArrowRight,
  Lock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react'

export default function Login() {
  const { loginWithRedirect, isAuthenticated, isLoading, user, error } = useAuth0()
  const navigate = useNavigate()
  const location = useLocation()

  const domain = import.meta.env.VITE_AUTH0_DOMAIN
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID
  const isAuth0Configured = Boolean(domain && clientId && !domain.includes('dummy') && !clientId.includes('dummy'))

  // Get return path from location state if available
  const returnTo = location.state?.returnTo || '/dashboard'

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate(returnTo, { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate, returnTo])

  const handleLogin = (isSignUp = false) => {
    if (!isAuth0Configured) {
      alert(
        'Auth0 is not configured yet. Please configure VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID in your .env file.'
      )
      return
    }

    loginWithRedirect({
      appState: { returnTo },
      authorizationParams: isSignUp ? { screen_hint: 'signup' } : undefined,
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/60 via-white to-amber-50/30 pt-28 pb-20 px-4 flex items-center justify-center">
      <div className="w-full max-w-4xl mx-auto grid md:grid-cols-12 gap-8 items-center">
        
        {/* Left Col: Farmer & Platform Highlights */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="md:col-span-6 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-green-100 border border-green-200 text-green-800 text-xs sm:text-sm font-semibold">
            <Sparkles className="w-4 h-4 text-green-600" />
            <span>Official FasalSetu Direct Marketplace</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display text-gray-950 tracking-tight leading-tight">
            Fair Prices. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-700 via-emerald-600 to-lime-600">
              Direct Farmer Access.
            </span>
          </h1>

          <p className="text-gray-600 text-base sm:text-lg leading-relaxed">
            Welcome to FasalSetu. Securely log in to access live mandi prices, manage crop listings, negotiate with verified institutional buyers, and track instant payments.
          </p>

          {/* Value props */}
          <div className="space-y-3 pt-2">
            {[
              {
                icon: Sprout,
                title: 'Farmer & Buyer Empowerment',
                desc: 'Zero middleman commission with direct APMC mandi price comparison.',
              },
              {
                icon: ShieldCheck,
                title: 'Auth0 Bank-Grade Security',
                desc: 'Tamper-proof login protecting your farm contracts and payout details.',
              },
              {
                icon: TrendingUp,
                title: 'Real-Time Price Intelligence',
                desc: 'Dynamic AI pricing insights for Nashik Red onion, Sharbati wheat, & more.',
              },
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/80 border border-green-100/80 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-200/60 flex items-center justify-center shrink-0 text-green-700">
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">{item.title}</h4>
                  <p className="text-gray-500 text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right Col: Auth0 Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="md:col-span-6"
        >
          <div className="bg-white rounded-3xl p-7 sm:p-9 border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.08)] relative overflow-hidden">
            
            {/* Top decorative accent */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-green-500 via-emerald-500 to-lime-500" />

            {/* Brand Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full border-[3px] border-[#ea580c] flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ea580c]" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-gray-900 text-lg leading-tight">FasalSetu</h2>
                  <p className="text-gray-400 text-xs">Secure Universal Portal</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                <Lock className="w-3.5 h-3.5 text-green-600" />
                <span>Auth0 Protected</span>
              </div>
            </div>

            {/* Error banner if Auth0 returned an error */}
            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold">Sign-in Notice</p>
                  <p className="text-xs mt-0.5">
                    We couldn't complete your sign-in ({error.message || 'Authentication error'}). Please try again.
                  </p>
                </div>
              </div>
            )}

            {/* If user is already authenticated */}
            {isAuthenticated && user ? (
              <div className="space-y-5 text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-100 border-2 border-green-500 flex items-center justify-center mx-auto text-green-700">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Welcome back, {user.name || user.nickname || 'User'}!
                  </h3>
                  <p className="text-gray-500 text-sm mt-1">
                    You are currently authenticated via Auth0.
                  </p>
                </div>
                <button
                  onClick={() => navigate(returnTo)}
                  className="w-full py-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-base shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-2"
                >
                  Proceed to Dashboard <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            ) : (
              /* Main Login Action */
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold font-display text-gray-900">
                    Sign in to your account
                  </h3>
                  <p className="text-gray-500 text-sm mt-1">
                    Farmers, FPOs, Agri-Officers, and Institutional Buyers
                  </p>
                </div>

                {/* Primary Button: Auth0 Universal Login */}
                <button
                  id="auth0-login-btn"
                  onClick={() => handleLogin(false)}
                  disabled={isLoading}
                  className="w-full py-4 px-6 rounded-2xl bg-gray-950 hover:bg-black active:scale-[0.99] text-white font-bold text-base sm:text-lg shadow-xl shadow-black/10 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Connecting to Auth0...</span>
                    </div>
                  ) : (
                    <>
                      <span>Continue with Auth0 Universal Login</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>

                {/* Secondary Option: New Registration */}
                <button
                  onClick={() => handleLogin(true)}
                  disabled={isLoading}
                  className="w-full py-3 px-6 rounded-2xl bg-green-50 hover:bg-green-100 border border-green-200 text-green-900 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <span>New to FasalSetu? Create a Free Account</span>
                </button>

                {/* Notice regarding Auth0 Configuration if missing */}
                {!isAuth0Configured && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                      <HelpCircle className="w-4 h-4" />
                      <span>Auth0 Setup in Progress</span>
                    </div>
                    <p>
                      Set <code className="font-mono bg-amber-100 px-1 rounded">VITE_AUTH0_DOMAIN</code> and{' '}
                      <code className="font-mono bg-amber-100 px-1 rounded">VITE_AUTH0_CLIENT_ID</code> in{' '}
                      <code className="font-mono bg-amber-100 px-1 rounded">.env</code> to connect your Auth0 tenant.
                    </p>
                  </div>
                )}

                {/* Security Footer */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                    256-Bit SSL Encrypted
                  </span>
                  <Link to="/" className="hover:text-gray-700 underline underline-offset-2">
                    Back to Home
                  </Link>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
