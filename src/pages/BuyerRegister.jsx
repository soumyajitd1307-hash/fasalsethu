import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Building2, ArrowLeft, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

/**
 * Buyer registration.
 *
 * Posts exactly the shape the backend validates: `role`, `identifier`,
 * `password` and a `profile`. Optional fields are omitted when blank rather than
 * sent as empty strings.
 *
 * `buyerType` is a free-text field on the backend (a plain optional string with
 * no enum), so it is offered as an optional text input with a hint instead of
 * an invented fixed list of buyer categories.
 *
 * Registration does NOT sign the user in.
 */
export default function BuyerRegister() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [form, setForm] = useState({
    name: '',
    companyName: '',
    phone: '',
    email: '',
    gstin: '',
    buyerType: '',
    village: '',
    district: '',
    state: '',
    latitude: '',
    longitude: '',
  })
  const [identifierType, setIdentifierType] = useState('gstin') // which profile field the identifier maps to
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
    const ident = identifier.trim()

    const localErrors = {}
    if (name.length < 2) localErrors.name = 'Enter your full name (min 2 characters)'
    if (!form.phone.trim()) localErrors.phone = 'Enter a contact mobile number'
    if (!ident) localErrors.identifier = 'Enter the identifier you will use to sign in'
    if (password.length < 8) localErrors.password = 'Password must be at least 8 characters'
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors)
      return
    }

    const profile = { name, phone: form.phone.trim() }
    if (form.companyName.trim()) profile.companyName = form.companyName.trim()
    if (form.buyerType.trim()) profile.buyerType = form.buyerType.trim()
    if (form.village.trim()) profile.village = form.village.trim()
    if (form.district.trim()) profile.district = form.district.trim()
    if (form.state.trim()) profile.state = form.state.trim()

    // The identifier must be one of the profile's own identifiers, so it is
    // written into the matching profile field.
    if (identifierType === 'gstin') {
      profile.gstin = ident
    } else if (identifierType === 'email') {
      profile.email = ident
    } else if (identifierType === 'phone') {
      profile.phone = ident
    }
    // A separately supplied email/GSTIN is still kept when it is not the identifier.
    if (identifierType !== 'email' && form.email.trim()) profile.email = form.email.trim()
    if (identifierType !== 'gstin' && form.gstin.trim()) profile.gstin = form.gstin.trim()

    const lat = parseCoordinate(form.latitude)
    const lng = parseCoordinate(form.longitude)
    if (lat !== undefined) profile.latitude = lat
    if (lng !== undefined) profile.longitude = lng

    setIsLoading(true)
    try {
      await register('buyer', { identifier: ident, password, profile })
      setDone(true)
      setTimeout(() => navigate('/login/buyer', { replace: true }), 1600)
    } catch (err) {
      setFieldErrors(collectFieldErrors(err))
      setError(describeError(err))
      setIsLoading(false)
    }
  }

  const inputClass =
    'w-full pl-3 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm text-gray-900 transition-all'
  const labelClass = 'block text-xs font-semibold text-gray-700 mb-1.5'

  if (done) {
    return (
      <div className="min-h-screen pt-28 pb-16 px-4 flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-white to-green-50/20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/95 backdrop-blur-xl border border-emerald-200/80 rounded-3xl p-8 text-center shadow-[0_12px_40px_rgba(5,150,105,0.08)]"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h1 className="font-display font-bold text-xl text-gray-900">Registration complete</h1>
          <p className="text-xs text-gray-500 mt-2">
            Your buyer account has been created. Taking you to the sign-in page...
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 bg-gradient-to-b from-slate-50 via-white to-green-50/20 flex flex-col justify-center relative overflow-hidden">
      <div className="absolute top-1/4 right-1/2 translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />

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
            to="/login/buyer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-200 shadow-sm"
          >
            Already registered? Sign in
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/95 backdrop-blur-xl border border-emerald-200/80 rounded-3xl p-6 sm:p-8 shadow-[0_12px_40px_rgba(5,150,105,0.08)]"
        >
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-600/20">
              <Building2 className="w-7 h-7" />
            </div>
            <h1 className="font-display font-bold text-2xl text-gray-900">Create your buyer account</h1>
            <p className="text-xs text-gray-500 mt-1">
              Your GSTIN, business email or mobile number can be used to sign in later.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className={labelClass}>Sign in with</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'gstin', label: 'GSTIN' },
                  { key: 'email', label: 'Email' },
                  { key: 'phone', label: 'Mobile' },
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
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:text-emerald-800'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="by-identifier">
                {identifierType === 'gstin' ? 'Company GSTIN' : identifierType === 'email' ? 'Business email' : 'Mobile number'}
              </label>
              <input
                id="by-identifier"
                type={identifierType === 'email' ? 'email' : 'text'}
                value={identifier}
                onChange={(e) => setIdentifier(identifierType === 'gstin' ? e.target.value.toUpperCase() : e.target.value)}
                placeholder={identifierType === 'gstin' ? '27AAAAA0000A1Z5' : identifierType === 'email' ? 'procurement@company.com' : '+91 98765 43210'}
                maxLength={identifierType === 'gstin' ? 15 : undefined}
                aria-invalid={Boolean(fieldErrors.identifier)}
                className={inputClass}
              />
              {fieldErrors.identifier && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.identifier}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="by-name">Full name *</label>
                <input
                  id="by-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Your name"
                  aria-invalid={Boolean(fieldErrors.name)}
                  className={inputClass}
                />
                {fieldErrors.name && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.name}</p>}
              </div>

              <div>
                <label className={labelClass} htmlFor="by-company">Company (optional)</label>
                <input
                  id="by-company"
                  type="text"
                  value={form.companyName}
                  onChange={(e) => setField('companyName', e.target.value)}
                  placeholder="Company name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="by-phone">Contact mobile *</label>
                <input
                  id="by-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  disabled={identifierType === 'phone'}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className={`${inputClass} disabled:bg-gray-50`}
                />
                {identifierType === 'phone' ? (
                  <p className="mt-1 text-[11px] text-gray-500">Using this number as the sign-in identifier.</p>
                ) : (
                  fieldErrors.phone && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.phone}</p>
                )}
              </div>

              <div>
                <label className={labelClass} htmlFor="by-email">Business email (optional)</label>
                <input
                  id="by-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="procurement@company.com"
                  disabled={identifierType === 'email'}
                  className={`${inputClass} disabled:bg-gray-50`}
                />
                {fieldErrors.email && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.email}</p>}
              </div>

              <div>
                <label className={labelClass} htmlFor="by-gstin">GSTIN (optional)</label>
                <input
                  id="by-gstin"
                  type="text"
                  value={form.gstin}
                  onChange={(e) => setField('gstin', e.target.value.toUpperCase())}
                  placeholder="27AAAAA0000A1Z5"
                  maxLength={15}
                  disabled={identifierType === 'gstin'}
                  className={`${inputClass} disabled:bg-gray-50`}
                />
                {fieldErrors.gstin && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.gstin}</p>}
              </div>

              <div>
                <label className={labelClass} htmlFor="by-type">Buyer type (optional)</label>
                <input
                  id="by-type"
                  type="text"
                  value={form.buyerType}
                  onChange={(e) => setField('buyerType', e.target.value)}
                  placeholder="e.g. Retailer"
                  className={inputClass}
                />
                {fieldErrors.buyerType && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.buyerType}</p>}
              </div>

              <div>
                <label className={labelClass} htmlFor="by-village">Village / Locality (optional)</label>
                <input
                  id="by-village"
                  type="text"
                  value={form.village}
                  onChange={(e) => setField('village', e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="by-district">District (optional)</label>
                <input
                  id="by-district"
                  type="text"
                  value={form.district}
                  onChange={(e) => setField('district', e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="by-state">State (optional)</label>
                <input
                  id="by-state"
                  type="text"
                  value={form.state}
                  onChange={(e) => setField('state', e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="by-lat">Latitude (optional)</label>
                <input
                  id="by-lat"
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => setField('latitude', e.target.value)}
                  placeholder="-90 to 90"
                  className={inputClass}
                />
                {fieldErrors.latitude && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.latitude}</p>}
              </div>

              <div>
                <label className={labelClass} htmlFor="by-lng">Longitude (optional)</label>
                <input
                  id="by-lng"
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => setField('longitude', e.target.value)}
                  placeholder="-180 to 180"
                  className={inputClass}
                />
                {fieldErrors.longitude && <p className="mt-1 text-[11px] text-red-600">{fieldErrors.longitude}</p>}
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="by-password">Password *</label>
              <div className="relative flex items-center">
                <input
                  id="by-password"
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
              className="w-full py-3 rounded-full bg-[#131722] hover:bg-black text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  <span>Create buyer account</span>
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              Registration does not sign you in.{' '}
              <Link to="/login/buyer" className="font-semibold text-emerald-700 hover:underline">
                Go to buyer sign-in →
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
