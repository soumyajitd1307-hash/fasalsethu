import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sprout, ShieldCheck, Lock, Eye, EyeOff,
  ArrowRight, ArrowLeft, CheckCircle2, Globe, HelpCircle,
  Wheat, Building2, AlertCircle
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

/**
 * Farmer sign-in against the real backend.
 *
 * The previous implementation faked authentication with setTimeout and an OTP
 * flow that nothing verified. Both are gone: there is no OTP provider on the
 * server, so the form no longer offers or simulates one, and the password is
 * submitted to POST /api/auth/login for real.
 *
 * A farmer signs in with a Kisan ID, mobile number or email, all of which the
 * backend accepts as the single `identifier` field.
 */
export default function FarmerLogin() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedLang, setSelectedLang] = useState('English')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const languages = ['English', 'हिन्दी', 'मराठी', 'ਪੰਜਾਬੀ', 'తెలుగు']

  /**
   * Turns a backend error into something safe to show. Only the server's own
   * message is surfaced; nothing about internals, tokens or account existence
   * is added here. The backend deliberately answers every failed sign-in with
   * the same generic message, so this cannot leak whether an account exists.
   */
  function describeError(err) {
    const status = err && err.status

    if (status === 400) {
      return 'Please check your details and try again.'
    }
    if (status === 401) {
      return (err && err.message) || 'Invalid credentials.'
    }
    if (status === 429) {
      const retryAfter = err.retryAfterSeconds
      return retryAfter
        ? `Too many attempts. Please try again in ${retryAfter} seconds.`
        : 'Too many attempts. Please try again shortly.'
    }
    if (status === 503) {
      return 'The service is temporarily unavailable. Please try again later.'
    }
    return 'Unable to sign in right now. Please try again.'
  }

  function collectFieldErrors(err) {
    const details = err && err.data && err.data.details
    if (!details) return {}
    // zod flatten(): { fieldName: [messages] }
    const out = {}
    for (const [field, messages] of Object.entries(details)) {
      const key = field === 'identifier' ? 'identifier' : field
      if (Array.isArray(messages) && messages.length > 0) out[key] = messages[0]
    }
    return out
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    if (!identifier.trim() || !password) {
      setFieldErrors({
        ...(identifier.trim() ? {} : { identifier: 'Enter your Kisan ID or mobile number' }),
        ...(password ? {} : { password: 'Enter your password' }),
      })
      return
    }

    setIsLoading(true)
    try {
      await login('farmer', identifier.trim(), password)
      setSuccess(true)
      // Brief confirmation, then into the farmer portal.
      setTimeout(() => navigate('/seller', { replace: true }), 900)
    } catch (err) {
      setFieldErrors(collectFieldErrors(err))
      setError(describeError(err))
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 bg-gradient-to-b from-green-50/50 via-white to-emerald-50/30 flex flex-col justify-center relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-green-200/35 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-emerald-100/40 rounded-full blur-2xl pointer-events-none" />

      <div className="max-w-md w-full mx-auto relative z-10">
        {/* Back to Portal Hub & Switch to Buyer */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-800 hover:text-green-950 transition-colors bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-green-100 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Portals
          </Link>

          <Link
            to="/login/buyer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-200 shadow-sm group"
          >
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            Buyer Login
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Farmer Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white/95 backdrop-blur-xl border border-green-200/80 rounded-3xl p-6 sm:p-8 shadow-[0_12px_40px_rgba(22,163,74,0.08)]"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-green-600 to-emerald-500 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-green-600/20">
              <Sprout className="w-7 h-7" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-800 text-xs font-semibold mb-2">
              <Wheat className="w-3 h-3 text-green-600" />
              Farmer Portal • किसान द्वार
            </div>
            <h1 className="font-display font-bold text-2xl text-gray-900">
              Farmer Login
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Access mandi rates, manage crop listings & track instant buyer payments
            </p>
          </div>

          {/* Language Selector Bar */}
          <div className="flex items-center justify-between mb-5 px-3 py-2 bg-green-50/70 rounded-xl border border-green-100 text-xs">
            <span className="flex items-center gap-1.5 text-green-900 font-medium">
              <Globe className="w-3.5 h-3.5 text-green-600" />
              Language:
            </span>
            <div className="flex gap-1">
              {languages.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSelectedLang(lang)}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    selectedLang === lang
                      ? 'bg-green-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-green-700'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Sign-in notice: OTP is intentionally not offered.
              The backend has no OTP provider, so presenting one here would be
              a simulation. Password sign-in is the only real path today. */}
          <div className="flex items-start gap-2 mb-5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
            <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0 text-amber-600" />
            <span>
              Mobile OTP sign-in is not available yet. Use your Kisan ID or mobile number with your password.
            </span>
          </div>

          {/* Success Screen */}
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-10 text-center flex flex-col items-center justify-center gap-3"
              >
                <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h3 className="font-display font-bold text-xl text-gray-900">
                  Welcome Back!
                </h3>
                <p className="text-xs text-gray-500">
                  Authentication verified. Redirecting to your Farmer Dashboard...
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Identifier: the backend takes one `identifier` field and
                      accepts a Kisan ID, a mobile number or an email. */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Kisan ID or Mobile Number
                    </label>
                    <div className="relative flex items-center">
                      <Sprout className="w-4 h-4 text-gray-400 absolute left-3.5" />
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="e.g. KISAN-9842 or 9876543210"
                        autoComplete="username"
                        required
                        aria-invalid={Boolean(fieldErrors.identifier)}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none text-sm text-gray-900 transition-all"
                      />
                    </div>
                    {fieldErrors.identifier && (
                      <p className="mt-1 text-[11px] text-red-600">{fieldErrors.identifier}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                      Password
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        required
                        aria-invalid={Boolean(fieldErrors.password)}
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none text-sm text-gray-900 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 text-gray-400 hover:text-gray-600"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="mt-1 text-[11px] text-red-600">{fieldErrors.password}</p>
                    )}
                  </div>

                  {/* Server-side error: 401 invalid credentials, 429 rate limited,
                      503 unavailable. Never renders internals. */}
                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-700"
                    >
                      <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0 text-red-600" />
                      <span>{error}</span>
                    </div>
                  )}

                {/* Remember & Trust */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-600">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500 w-3.5 h-3.5"
                    />
                    Remember this device
                  </label>
                  <span className="flex items-center gap-1 text-[11px] text-green-700 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Government MSP Protected
                  </span>
                </div>

                {/* Submit CTA */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-green-700 to-green-500 hover:from-green-600 hover:to-green-400 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <>
                      <span>Sign In to Farmer Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </AnimatePresence>

          {/* Footer note */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              New to Fasal sethu?{' '}
              <Link to="/farmer-register" className="font-semibold text-green-700 hover:underline">
                Register as a New Farmer →
              </Link>
            </p>
            <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-gray-400">
              <HelpCircle className="w-3 h-3 text-green-600" />
              Kisan Support Toll-Free: <span className="font-semibold text-gray-600">1800-180-1551</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
