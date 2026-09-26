import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, ShieldCheck, Mail, Lock, Eye, EyeOff,
  ArrowRight, ArrowLeft, CheckCircle2, Briefcase, FileText,
  Sprout, Award, AlertCircle
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

/**
 * Buyer sign-in against the real backend.
 *
 * Replaces the previous setTimeout simulation. A buyer signs in with a GSTIN,
 * corporate email or phone number, all of which the backend accepts as the
 * single `identifier` field. The email/GSTIN toggle is kept purely as an input
 * affordance — it never changes what is sent.
 */
export default function BuyerLogin() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [authType, setAuthType] = useState('email') // 'email' | 'gstin'
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  function describeError(err) {
    const status = err && err.status
    if (status === 400) return 'Please check your details and try again.'
    if (status === 401) return (err && err.message) || 'Invalid credentials.'
    if (status === 429) {
      const retryAfter = err.retryAfterSeconds
      return retryAfter
        ? `Too many attempts. Please try again in ${retryAfter} seconds.`
        : 'Too many attempts. Please try again shortly.'
    }
    if (status === 503) return 'The service is temporarily unavailable. Please try again later.'
    return 'Unable to sign in right now. Please try again.'
  }

  function collectFieldErrors(err) {
    const details = err && err.data && err.data.details
    if (!details) return {}
    const out = {}
    for (const [field, messages] of Object.entries(details)) {
      if (Array.isArray(messages) && messages.length > 0) out[field] = messages[0]
    }
    return out
  }

  function handleAuthTypeChange(next) {
    setAuthType(next)
    setIdentifier('')
    setFieldErrors({})
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    if (!identifier.trim() || !password) {
      setFieldErrors({
        ...(identifier.trim() ? {} : { identifier: authType === 'email' ? 'Enter your business email' : 'Enter your GSTIN' }),
        ...(password ? {} : { password: 'Enter your password' }),
      })
      return
    }

    setIsLoading(true)
    try {
      await login('buyer', identifier.trim(), password)
      setSuccess(true)
      setTimeout(() => navigate('/buyer', { replace: true }), 900)
    } catch (err) {
      setFieldErrors(collectFieldErrors(err))
      setError(describeError(err))
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 bg-gradient-to-b from-slate-50 via-white to-green-50/20 flex flex-col justify-center relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 right-1/2 translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-blue-100/30 rounded-full blur-2xl pointer-events-none" />

      <div className="max-w-md w-full mx-auto relative z-10">
        {/* Back to Portal Hub & Switch to Farmer */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-950 transition-colors bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-200 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Portals
          </Link>

          <Link
            to="/login/farmer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-900 transition-colors bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-green-200 shadow-sm group"
          >
            <Sprout className="w-3.5 h-3.5 text-green-600" />
            Farmer Login
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Buyer Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white/95 backdrop-blur-xl border border-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)]"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#131722] to-gray-800 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
              <Building2 className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold mb-2">
              <Briefcase className="w-3 h-3 text-slate-600" />
              Buyer & Enterprise Portal • व्यापार द्वार
            </div>
            <h1 className="font-display font-bold text-2xl text-gray-900">
              Buyer & Trader Login
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Source bulk farm produce, verify digital lab reports & manage escrow orders
            </p>
          </div>

          {/* Login Mode Toggle */}
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => handleAuthTypeChange('email')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                authType === 'email'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Corporate Email
            </button>
            <button
              type="button"
              onClick={() => handleAuthTypeChange('gstin')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                authType === 'gstin'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              GSTIN / Business PAN
            </button>
          </div>

          {/* Success Screen */}
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-10 text-center flex flex-col items-center justify-center gap-3"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h3 className="font-display font-bold text-xl text-gray-900">
                  Authentication Successful
                </h3>
                <p className="text-xs text-gray-500">
                  Accessing Fasal sethu wholesale marketplace and active trade contracts...
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                  {/* One identifier field. The email/GSTIN toggle above only
                      changes the label, hint and input type; the backend always
                      receives a single `identifier`. */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      {authType === 'email' ? 'Business or Corporate Email' : 'Company GSTIN'}
                    </label>
                    <div className="relative flex items-center">
                      {authType === 'email' ? (
                        <Mail className="w-4 h-4 text-gray-400 absolute left-3.5" />
                      ) : (
                        <FileText className="w-4 h-4 text-gray-400 absolute left-3.5" />
                      )}
                      <input
                        type={authType === 'email' ? 'email' : 'text'}
                        value={identifier}
                        onChange={(e) =>
                          setIdentifier(authType === 'gstin' ? e.target.value.toUpperCase() : e.target.value)
                        }
                        placeholder={authType === 'email' ? 'procurement@company.com' : '27AAAAA0000A1Z5'}
                        maxLength={authType === 'gstin' ? 15 : undefined}
                        autoComplete="username"
                        required
                        aria-invalid={Boolean(fieldErrors.identifier)}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm text-gray-900 transition-all"
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
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm text-gray-900 transition-all"
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

                  {/* Corporate Security Badges */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-600">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    Remember credentials
                  </label>
                  <span className="flex items-center gap-1 text-[11px] text-gray-600 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    256-Bit Escrow Vault
                  </span>
                </div>

                {/* Submit CTA */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-full bg-[#131722] hover:bg-black text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <>
                      <span>Sign In to Buyer Portal</span>
                      <ArrowRight className="w-4 h-4 text-emerald-400" />
                    </>
                  )}
                </button>
              </form>
            )}
          </AnimatePresence>

          {/* Footer note */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              New bulk buyer, processor or exporter?{' '}
              <Link to="/buyer-register" className="font-semibold text-emerald-700 hover:underline">
                Register as a New Buyer →
              </Link>
            </p>
            <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-gray-400">
              <Award className="w-3 h-3 text-emerald-600" />
              APEDA & FSSAI Compliant Procurement Engine
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
