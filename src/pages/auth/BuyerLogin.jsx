import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Building2, Mail, Lock, ArrowRight,
  AlertCircle, CheckCircle2, KeyRound, Sparkles,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import LanguageSelector from '../../components/LanguageSelector'

export default function BuyerLogin() {
  const { login, loginGoogle, resetPassword } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()

  const [emailOrPhone, setEmailOrPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Forgot password dialog
  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  // Quick fill demo buyer credentials
  function handleFillDemo() {
    setEmailOrPhone('buyer@fasalsethu.in')
    setPassword('password123')
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (!emailOrPhone.trim() || !password) {
      setError(t('errors.requiredFields'))
      return
    }

    setLoading(true)
    const result = await login({
      emailOrPhone: emailOrPhone.trim(),
      password,
      expectedRole: 'buyer',
    })

    if (result.success) {
      // Check if user is actually a farmer trying to log in at buyer portal
      if (result.profile?.role === 'farmer') {
        setError(t('auth.roleMismatch', { userRole: 'Farmer', targetPortal: 'Farmer Portal' }))
        setTimeout(() => {
          navigate('/farmer/dashboard')
        }, 1800)
      } else {
        const destination = location.state?.from?.pathname || '/buyer/dashboard'
        navigate(destination, { replace: true })
      }
    } else {
      setError(result.error)
    }
    setLoading(false)
  }

  async function handleGoogleLogin() {
    setError(null)
    setLoading(true)
    const result = await loginGoogle('buyer')
    if (result.success) {
      if (result.profile?.role === 'farmer') {
        navigate('/farmer/dashboard')
      } else {
        navigate('/buyer/dashboard', { replace: true })
      }
    } else {
      setError(result.error)
    }
    setLoading(false)
  }

  async function handleSendReset(e) {
    e.preventDefault()
    if (!resetEmail.trim()) return
    setResetLoading(true)
    const res = await resetPassword(resetEmail.trim())
    setResetLoading(false)
    if (res.success) {
      setSuccessMsg('Password reset link sent! Please check your inbox.')
      setShowForgot(false)
      setResetEmail('')
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-sky-950 to-slate-950 text-white relative flex flex-col justify-between overflow-x-hidden">
      {/* Top Background Ambient Glows */}
      <div className="absolute top-10 right-1/3 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-20 w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/portal-select" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
            <Building2 className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <span className="font-display font-black text-xl tracking-tight text-white flex items-center gap-1.5">
              {t('common.appName')}
              <span className="text-sky-400">.</span>
            </span>
            <p className="text-[10px] font-mono text-sky-400/80 tracking-widest uppercase">
              {t('portals.buyer.title')}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <LanguageSelector variant="dark" />
          <Link
            to="/portal-select"
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-sky-200 transition-colors"
          >
            {t('common.portalSelect')}
          </Link>
        </div>
      </header>

      {/* Center Auth Card */}
      <main className="relative z-10 w-full max-w-md mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/90 backdrop-blur-xl border border-sky-500/30 rounded-3xl p-8 shadow-2xl shadow-sky-950/80"
        >
          {/* Card Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shadow-md shadow-sky-500/20">
              <Building2 className="w-7 h-7" />
            </div>
            <span className="inline-block px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-sky-900/80 text-sky-300 border border-sky-500/30 mb-2">
              {t('portals.buyer.title')}
            </span>
            <h1 className="font-display font-black text-2xl text-white">
              {t('auth.buyerLoginTitle')}
            </h1>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
              {t('auth.buyerLoginSubtitle')}
            </p>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="mb-5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email / Phone Field */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                {t('auth.emailOrPhone')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={emailOrPhone}
                  onChange={e => setEmailOrPhone(e.target.value)}
                  placeholder="e.g., buyer@fasalsethu.in or 9811098765"
                  required
                  className="w-full px-4 py-3 pl-10 rounded-2xl bg-slate-950/80 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all"
                />
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-300">
                  {t('auth.password')}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgot(true)
                    setError(null)
                  }}
                  className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold transition-colors"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pl-10 rounded-2xl bg-slate-950/80 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all"
                />
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-400 hover:from-sky-400 hover:to-emerald-300 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{t('auth.loginButton')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Autofill Button for Instant Testing */}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleFillDemo}
              className="w-full py-2 px-3 rounded-xl bg-sky-950/60 border border-sky-500/30 text-sky-300 hover:bg-sky-900/60 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-300" />
              <span>Fill Demo Buyer Account (buyer@fasalsethu.in)</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <span className="relative px-3 bg-slate-900 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              {t('common.or')}
            </span>
          </div>

          {/* Continue with Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{t('auth.continueGoogle')}</span>
          </button>

          {/* Footer Card Links */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center space-y-2">
            <p className="text-xs text-gray-400">
              {t('auth.noAccount')}{' '}
              <Link to="/buyer/register" className="text-sky-300 hover:underline font-bold">
                {t('auth.registerBuyer')}
              </Link>
            </p>
            <p className="text-[11px] text-gray-500">
              Are you a farmer or producer?{' '}
              <Link to="/farmer/login" className="text-lime-400 hover:underline">
                Switch to Farmer Portal
              </Link>
            </p>
          </div>
        </motion.div>
      </main>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-sky-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-2 mb-2 text-sky-400">
              <KeyRound className="w-5 h-5" />
              <h3 className="font-bold text-base text-white">{t('auth.resetTitle')}</h3>
            </div>
            <p className="text-xs text-gray-300 mb-4">{t('auth.resetSubtitle')}</p>

            <form onSubmit={handleSendReset} className="space-y-4">
              <input
                type="email"
                required
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                placeholder="Enter your registered business email"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/20 text-white text-xs focus:outline-none focus:border-sky-400"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="flex-1 py-2 rounded-xl bg-white/10 text-xs font-semibold hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 py-2 rounded-xl bg-sky-500 text-slate-950 text-xs font-bold hover:bg-sky-400"
                >
                  {resetLoading ? 'Sending...' : t('auth.sendResetLink')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Footer */}
      <footer className="relative z-10 w-full text-center py-4 text-[11px] text-gray-500">
        <p>Protected by FasalSethu Enterprise Security & Firebase Authentication</p>
      </footer>
    </div>
  )
}
