import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sprout, Wheat, ArrowLeft, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

/**
 * Farmer registration.
 *
 * Posts exactly the shape the backend validates: `role`, `identifier`,
 * `password` and a `profile`. Optional fields are omitted entirely when blank
 * rather than sent as empty strings, because the backend's optional fields
 * accept an empty string but a numeric latitude/longitude of "" would not
 * survive validation.
 *
 * Registration does NOT sign the user in: the backend issues no tokens here, so
 * the user is sent to the login page to authenticate.
 */
export default function FarmerRegister() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    kisanId: '',
    village: '',
    district: '',
    state: '',
    latitude: '',
    longitude: '',
  })
  const [identifierType, setIdentifierType] = useState('kisanId') // which profile field the identifier maps to
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [done, setDone] = useState(false)

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function parseCoordinate(raw) {
    if (raw === '' || raw === null || raw === undefined) return undefined
    const value = Number(raw)
    return Number.isFinite(value) ? value : undefined
  }

  function describeError(err) {
    const status = err && err.status
    if (status === 400) return 'Please check the highlighted fields and try again.'
    if (status === 409) return (err && err.message) || 'That identifier is already registered.'
    if (status === 429) {
      const retryAfter = err.retryAfterSeconds
      return retryAfter
        ? `Too many attempts. Please try again in ${retryAfter} seconds.`
        : 'Too many attempts. Please try again shortly.'
    }
    if (status === 503) return 'The service is temporarily unavailable. Please try again later.'
    return 'Unable to complete registration right now. Please try again.'
  }

  function collectFieldErrors(err) {
    const details = err && err.data && err.data.details
    if (!details) return {}
    const out = {}
    for (const [field, messages] of Object.entries(details)) {
      if (!Array.isArray(messages) || messages.length === 0) continue
      // The backend nests profile errors under `profile`.
      const key = field.startsWith('profile.') ? field.slice('profile.'.length) : field
      out[key] = messages[0]
    }
    return out
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    const name = form.name.trim()
    const phone = form.phone.trim()
    const ident = identifier.trim()

    const localErrors = {}
    if (name.length < 2) localErrors.name = 'Enter your full name (min 2 characters)'
    if (!phone) localErrors.phone = 'Enter your mobile number'
    if (!ident) localErrors.identifier = 'Enter the identifier you will use to sign in'
    if (password.length < 8) localErrors.password = 'Password must be at least 8 characters'
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors)
      return
    }

    // Build the profile with only the fields the user actually filled in, so no
    // empty strings are sent for optional values.
    const profile = { name, phone }
    if (form.email.trim()) profile.email = form.email.trim()
    if (identifierType === 'kisanId') {
      profile.kisanId = ident
    } else if (identifierType === 'phone') {
      // Phone is the sign-in identifier; the profile's phone must match it.
      profile.phone = ident
    } else if (identifierType === 'email') {
      profile.email = ident
    }
    if (form.village.trim()) profile.village = form.village.trim()
    if (form.district.trim()) profile.district = form.district.trim()
    if (form.state.trim()) profile.state = form.state.trim()
    const lat = parseCoordinate(form.latitude)
    const lng = parseCoordinate(form.longitude)
    if (lat !== undefined) profile.latitude = lat
    if (lng !== undefined) profile.longitude = lng

    setIsLoading(true)
    try {
      await register('farmer', { identifier: ident, password, profile })
      setDone(true)
      // Registration creates the account but issues no token: send the user to
      // sign in for real.
      setTimeout(() => navigate('/login/farmer', { replace: true }), 1600)
    } catch (err) {
      setFieldErrors(collectFieldErrors(err))
      setError(describeError(err))
      setIsLoading(false)
    }
  }

  const inputClass =
    'w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none text-sm text-gray-900 transition-all'
  const labelClass = 'block text-xs font-semibold text-gray-700 mb-1.5'

  if (done) {
    return (
      <div className="min-h-screen pt-28 pb-16 px-4 flex flex-col items-center justify-center bg-gradient-to-b from-green-50/50 via-white to-emerald-50/30">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/95 backdrop-blur-xl border border-green-200/80 rounded-3xl p-8 text-center shadow-[0_12px_40px_rgba(22,163,74,0.08)]"
        >
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h1 className="font-display font-bold text-xl text-gray-900">Registration complete</h1>
          <p className="text-xs text-gray-500 mt-2">
            Your farmer account has been created. Taking you to the sign-in page...
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 bg-gradient-to-b from-green-50/50 via-white to-emerald-50/30 flex flex-col justify-center relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-green-200/35 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl w-full mx-auto relative z-10">
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-800 hover:text-green-950 transition-colors bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-green-100 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Portals
          </Link>
          <Link
            to="/login/farmer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-200 shadow-sm"
          >
            Already registered? Sign in
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/95 backdrop-blur-xl border border-green-200/80 rounded-3xl p-6 sm:p-8 shadow-[0_12px_40px_rgba(22,163,74,0.08)]"
        >
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-green-600 to-emerald-500 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-green-600/20">
              <Sprout className="w-7 h-7" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-800 text-xs font-semibold mb-2">
              <Wheat className="w-3 h-3 text-green-600" />
              New Farmer • किसान पंजीकरण
            </div>
            <h1 className="font-display font-bold text-2xl text-gray-900">Create your farmer account</h1>
            <p className="text-xs text-gray-500 mt-1">
              Your Kisan ID, mobile number or email can be used to sign in later.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Sign-in identifier */}
            <div>
              <label className={labelClass}>Sign in with</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'kisanId', label: 'Kisan ID' },
                  { key: 'phone', label: 'Mobile' },
                  { key: 'email', label: 'Email' },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setIdentifierType(option.key)
                      setIdentifier('')
                      setFieldErrors({})
                    }}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                      identifierType === option.key
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:text-green-800'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="fr-identifier">
                {identifierType === 'kisanId' ? 'Kisan ID' : identifierType === 'phone' ? 'Mobile number' : 'Email address'}
              </label>
              <div className="relative flex items-center">
                <Sprout className="w-4 h-4 text-gray-400 absolute left-3.5" />
                <input
                  id="fr-identifier"
                  type={identifierType === 'email' ? 'email' : 'text'}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={identifierType === 'kisanId' ? 'e.g. KISAN-9842' : identifierType === 'phone' ? 'e.g. +91 98765 43210' : 'you@example.com'}
                  aria-invalid={Boolean(fieldErrors.identifier)}
                  className={inputClass}
                />
              </div>
              {fieldErrors.identifier && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.identifier}</p>}
            </div>

            {/* Profile */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="fr-name">Full name *</label>
                <input
                  id="fr-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Your name"
                  aria-invalid={Boolean(fieldErrors.name)}
                  className={`${inputClass} pl-3`}
                />
                {fieldErrors.name && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.name}</p>}
              </div>

              <div>
                <label className={labelClass} htmlFor="fr-phone">Mobile number *</label>
                <input
                  id="fr-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  disabled={identifierType === 'phone'}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className={`${inputClass} pl-3 disabled:bg-gray-50`}
                />
                {identifierType === 'phone' ? (
                  <p className="mt-1 text-[11px] text-gray-500">Using your mobile number as the sign-in identifier.</p>
                ) : (
                  fieldErrors.phone && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.phone}</p>
                )}
              </div>

              <div>
                <label className={labelClass} htmlFor="fr-email">Email (optional)</label>
                <input
                  id="fr-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="you@example.com"
                  disabled={identifierType === 'email'}
                  aria-invalid={Boolean(fieldErrors.email)}
                  className={`${inputClass} pl-3 disabled:bg-gray-50`}
                />
                {fieldErrors.email && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.email}</p>}
              </div>

              <div>
                <label className={labelClass} htmlFor="fr-kisan">Kisan ID (optional)</label>
                <input
                  id="fr-kisan"
                  type="text"
                  value={form.kisanId}
                  onChange={(e) => setField('kisanId', e.target.value)}
                  placeholder="e.g. KISAN-9842"
                  disabled={identifierType === 'kisanId'}
                  className={`${inputClass} pl-3 disabled:bg-gray-50`}
                />
                {fieldErrors.kisanId && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.kisanId}</p>}
              </div>

              <div>
                <label className={labelClass} htmlFor="fr-village">Village (optional)</label>
                <input
                  id="fr-village"
                  type="text"
                  value={form.village}
                  onChange={(e) => setField('village', e.target.value)}
                  className={`${inputClass} pl-3`}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="fr-district">District (optional)</label>
                <input
                  id="fr-district"
                  type="text"
                  value={form.district}
                  onChange={(e) => setField('district', e.target.value)}
                  className={`${inputClass} pl-3`}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="fr-state">State (optional)</label>
                <input
                  id="fr-state"
                  type="text"
                  value={form.state}
                  onChange={(e) => setField('state', e.target.value)}
                  className={`${inputClass} pl-3`}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="fr-lat">Latitude (optional)</label>
                <input
                  id="fr-lat"
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => setField('latitude', e.target.value)}
                  placeholder="-90 to 90"
                  className={`${inputClass} pl-3`}
                />
                {fieldErrors.latitude && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.latitude}</p>}
              </div>

              <div>
                <label className={labelClass} htmlFor="fr-lng">Longitude (optional)</label>
                <input
                  id="fr-lng"
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => setField('longitude', e.target.value)}
                  placeholder="-180 to 180"
                  className={`${inputClass} pl-3`}
                />
                {fieldErrors.longitude && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.longitude}</p>}
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="fr-password">Password *</label>
              <div className="relative flex items-center">
                <input
                  id="fr-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  className={`${inputClass} pr-10`}
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
              {fieldErrors.password && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.password}</p>}
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-700">
                <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-full bg-gradient-to-r from-green-700 to-green-500 hover:from-green-600 hover:to-green-400 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  <span>Create farmer account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              Registration does not sign you in.{' '}
              <Link to="/login/farmer" className="font-semibold text-green-700 hover:underline">
                Go to farmer sign-in →
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
