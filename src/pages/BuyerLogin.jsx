import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, ShieldCheck, Mail, Lock, Eye, EyeOff,
  ArrowRight, ArrowLeft, CheckCircle2, Briefcase, FileText,
  Sprout, Award, ChevronRight, Phone, User, MapPin, Package, Wheat, Plus, X, AlertCircle
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
// `registerBuyer` is retained ONLY as a client-side cache write so the
// farmer-side buyer matching (GoogleMapBuyerRadar / getAllBuyers) keeps seeing
// buyers registered through this page. It is not an authentication path:
// credentials are always verified by the backend via AuthContext.
import { registerBuyer } from '../services/buyerDatabase'

// ── Small reusable field ─────────────────────────────────────────────
function Field({ label, icon: Icon, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      <div className="relative flex items-center">
        {Icon && <Icon className="w-4 h-4 text-gray-400 absolute left-3.5 z-10 pointer-events-none" />}
        {children}
      </div>
      {error && <p className="text-red-500 text-[11px] mt-1">{error}</p>}
    </div>
  )
}

const INPUT_CLS =
  'w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm text-gray-900 transition-all'

// ── Crop tag input ───────────────────────────────────────────────────
function CropTagInput({ crops, onChange }) {
  const [input, setInput] = useState('')

  const addCrop = () => {
    const trimmed = input.trim()
    if (trimmed && !crops.includes(trimmed)) {
      onChange([...crops, trimmed])
    }
    setInput('')
  }

  const removeCrop = (c) => onChange(crops.filter((x) => x !== c))

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        Crop(s) Required
      </label>
      {crops.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {crops.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800
                         text-xs font-semibold rounded-full"
            >
              {c}
              <button type="button" onClick={() => removeCrop(c)} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Wheat className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCrop())}
            placeholder="e.g. Rice, Wheat, Onion…"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200
                       focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100
                       outline-none text-sm text-gray-900 transition-all"
          />
        </div>
        <button
          type="button"
          onClick={addCrop}
          className="px-3 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700
                     transition-colors flex items-center gap-1 text-xs font-semibold shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      <p className="text-[10px] text-gray-400 mt-1">Press Enter or click Add after each crop.</p>
    </div>
  )
}

// ── Registration form ────────────────────────────────────────────────
function RegisterForm({ onSuccess }) {
  const { register } = useAuth()
  const [form, setForm] = useState({
    name: '',
    companyName: '',
    phone: '',
    email: '',
    password: '',
    cropsRequired: [],
    requiredQuantity: '',
    unit: 'quintal',
    location: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email format'
    if (!form.phone.trim()) e.phone = 'Phone number is required'
    if (!form.password || form.password.length < 8) e.password = 'Password must be at least 8 characters'
    if (form.cropsRequired.length === 0) e.cropsRequired = 'Add at least one crop'
    if (!form.requiredQuantity || Number(form.requiredQuantity) <= 0)
      e.requiredQuantity = 'Enter a valid quantity'
    if (!form.location.trim()) e.location = 'Location is required'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setIsLoading(true)
    setErrors({})
    try {
      // Real registration: the backend creates the AuthAccount and the Buyer
      // row. `identifier` is the corporate email, which the backend normalises
      // and enforces as globally unique.
      const created = await register('buyer', {
        identifier: form.email.trim(),
        password: form.password,
        profile: {
          name: form.name.trim(),
          companyName: form.companyName.trim() || undefined,
          phone: form.phone.trim(),
          email: form.email.trim(),
        },
      })

      // Mirror the profile into the local buyer registry so the farmer-side
      // buyer matching keeps working. This is a cache write only; if it fails
      // the account above is still real and usable.
      try {
        await registerBuyer(form)
      } catch (cacheErr) {
        console.warn('Buyer registered but local buyer cache write failed:', cacheErr)
      }

      onSuccess(created.profile || { name: form.name.trim(), companyName: form.companyName.trim() })
    } catch (err) {
      console.error('Registration failed:', err)
      const details = err?.data?.details
      if (details && typeof details === 'object') {
        const mapped = {}
        for (const [k, msgs] of Object.entries(details)) {
          if (Array.isArray(msgs) && msgs.length) mapped[k] = msgs[0]
        }
        if (Object.keys(mapped).length) {
          setErrors(mapped)
          setIsLoading(false)
          return
        }
      }
      if (err?.status === 409) {
        setErrors({ form: 'An account with that email or GSTIN already exists.' })
      } else if (err?.status === 429) {
        setErrors({ form: 'Too many attempts. Please try again shortly.' })
      } else {
        setErrors({ form: err?.message || 'Registration failed. Please try again.' })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {errors.form && (
        <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-xl">{errors.form}</p>
      )}

      {/* Row: Name + Company */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Buyer Name *" icon={User} error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Rajesh Kumar"
            className={INPUT_CLS}
          />
        </Field>
        <Field label="Company / Business Name" icon={Building2} error={errors.companyName}>
          <input
            type="text"
            value={form.companyName}
            onChange={(e) => set('companyName', e.target.value)}
            placeholder="ABC Agro Traders"
            className={INPUT_CLS}
          />
        </Field>
      </div>

      {/* Row: Phone + Email */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone Number *" icon={Phone} error={errors.phone}>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="98XXXXXXXX"
            className={INPUT_CLS}
          />
        </Field>
        <Field label="Business Email *" icon={Mail} error={errors.email}>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="buyer@company.com"
            className={INPUT_CLS}
          />
        </Field>
      </div>

      {/* Password */}
      <Field label="Password *" icon={Lock} error={errors.password}>
        <input
          type={showPassword ? 'text' : 'password'}
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          placeholder="Minimum 6 characters"
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200
                     focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100
                     outline-none text-sm text-gray-900 transition-all"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 text-gray-400 hover:text-gray-600"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </Field>

      {/* Crops */}
      <div>
        <CropTagInput
          crops={form.cropsRequired}
          onChange={(crops) => {
            setForm((f) => ({ ...f, cropsRequired: crops }))
            setErrors((e) => ({ ...e, cropsRequired: undefined }))
          }}
        />
        {errors.cropsRequired && (
          <p className="text-red-500 text-[11px] mt-1">{errors.cropsRequired}</p>
        )}
      </div>

      {/* Quantity + Unit */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Required Quantity *
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Package className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              value={form.requiredQuantity}
              onChange={(e) => set('requiredQuantity', e.target.value)}
              placeholder="e.g. 1000"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200
                         focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100
                         outline-none text-sm text-gray-900 transition-all"
            />
          </div>
          <select
            value={form.unit}
            onChange={(e) => set('unit', e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm
                       focus:outline-none focus:border-emerald-500"
          >
            <option value="kg">Kilogram (kg)</option>
            <option value="quintal">Quintal (qtl)</option>
            <option value="tonne">Tonne (MT)</option>
          </select>
        </div>
        {errors.requiredQuantity && (
          <p className="text-red-500 text-[11px] mt-1">{errors.requiredQuantity}</p>
        )}
      </div>

      {/* Location */}
      <Field label="Business / Buyer Location *" icon={MapPin} error={errors.location}>
        <input
          type="text"
          value={form.location}
          onChange={(e) => set('location', e.target.value)}
          placeholder="e.g. Durgapur, West Bengal, India"
          className={INPUT_CLS}
        />
      </Field>
      <p className="text-[10px] text-gray-400 -mt-2">
        This address will be visible to farmers searching for buyers near your location.
      </p>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 rounded-full bg-gradient-to-r from-emerald-600 to-green-600
                   hover:from-emerald-700 hover:to-green-700 text-white font-semibold text-sm
                   shadow-md hover:shadow-lg transition-all duration-200
                   flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isLoading ? (
          <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        ) : (
          <>
            <span>Create Buyer Account</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  )
}

// ── Login form ───────────────────────────────────────────────────────
function LoginForm({ onSuccess }) {
  const { login } = useAuth()
  const [authType, setAuthType] = useState('email')
  const [email, setEmail] = useState('')
  const [gstin, setGstin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // The email/GSTIN toggle is only an input affordance: both are sent as the
    // single `identifier` field, which the backend resolves for the buyer role.
    const identifier = (authType === 'email' ? email : gstin).trim()
    if (!identifier || !password) {
      setError(
        !identifier
          ? authType === 'email'
            ? 'Enter your business email'
            : 'Enter your GSTIN'
          : 'Enter your password'
      )
      return
    }

    setIsLoading(true)
    try {
      // Real authentication: AuthContext calls POST /api/auth/login with
      // role 'buyer', adopts the returned session, and revalidates it via
      // /api/auth/me. There is no local fallback and no demo path.
      const profile = await login('buyer', identifier, password)
      onSuccess(profile)
    } catch (err) {
      console.error('Login failed:', err)
      if (err?.status === 429) {
        const retry = err.retryAfterSeconds
        setError(
          retry
            ? `Too many attempts. Please try again in ${retry} seconds.`
            : 'Too many attempts. Please try again shortly.'
        )
      } else if (err?.status === 401) {
        setError(err?.message || 'Invalid credentials.')
      } else if (err?.status === 503) {
        setError('The service is temporarily unavailable. Please try again later.')
      } else {
        setError(err?.message || 'Unable to sign in right now. Please try again.')
      }
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Login Mode Toggle */}
      <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl mb-5">
        <button
          type="button"
          onClick={() => setAuthType('email')}
          className={`py-2 text-xs font-semibold rounded-lg transition-all ${
            authType === 'email' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Corporate Email
        </button>
        <button
          type="button"
          onClick={() => setAuthType('gstin')}
          className={`py-2 text-xs font-semibold rounded-lg transition-all ${
            authType === 'gstin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          GSTIN / Business PAN
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

        {authType === 'email' ? (
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Business or Corporate Email
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="procurement@company.com"
                required
                className={INPUT_CLS}
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Company GSTIN or Business Trade ID
            </label>
            <div className="relative flex items-center">
              <FileText className="w-4 h-4 text-gray-400 absolute left-3.5" />
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="27AAAAA0000A1Z5"
                maxLength={15}
                required
                className={`${INPUT_CLS} font-mono`}
              />
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-700">Password</label>
            <a href="#forgot" className="text-[11px] font-medium text-emerald-700 hover:underline">
              Forgot Password?
            </a>
          </div>
          <div className="relative flex items-center">
            <Lock className="w-4 h-4 text-gray-400 absolute left-3.5" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200
                         focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100
                         outline-none text-sm text-gray-900 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

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

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-full bg-[#131722] hover:bg-black text-white font-semibold
                     text-sm shadow-md hover:shadow-lg transition-all duration-200
                     flex items-center justify-center gap-2 disabled:opacity-50"
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
    </>
  )
}

// ── Main page ────────────────────────────────────────────────────────
export default function BuyerLogin() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [success, setSuccess] = useState(false)
  const [successBuyer, setSuccessBuyer] = useState(null)

  const handleSuccess = (profile) => {
    // Reached only after the backend has authenticated the buyer (or created
    // the account). The short delay below exists purely so the success screen
    // is visible; it plays no part in authentication.
    setSuccessBuyer(profile)
    setSuccess(true)
    setTimeout(() => navigate('/buyer', { replace: true }), 1200)
  }

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 bg-gradient-to-b from-slate-50 via-white to-green-50/20
                    flex flex-col justify-center relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-1/4 right-1/2 translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px]
                      bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-blue-100/30 rounded-full blur-2xl pointer-events-none" />

      <div className={`w-full mx-auto relative z-10 ${mode === 'register' ? 'max-w-xl' : 'max-w-md'}`}>
        {/* Navigation row */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700
                       hover:text-gray-950 transition-colors bg-white/80 backdrop-blur-sm
                       px-3 py-1.5 rounded-full border border-gray-200 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Portals
          </Link>
          <Link
            to="/login/farmer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700
                       hover:text-green-900 transition-colors bg-white/80 backdrop-blur-sm
                       px-3 py-1.5 rounded-full border border-green-200 shadow-sm group"
          >
            <Sprout className="w-3.5 h-3.5 text-green-600" />
            Farmer Login
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white/95 backdrop-blur-xl border border-gray-200/80 rounded-3xl
                     p-6 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)]"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#131722] to-gray-800 text-white
                            flex items-center justify-center mx-auto mb-3 shadow-md">
              <Building2 className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100
                            border border-slate-200 text-slate-800 text-xs font-semibold mb-2">
              <Briefcase className="w-3 h-3 text-slate-600" />
              Buyer &amp; Enterprise Portal • व्यापार द्वार
            </div>
            <h1 className="font-display font-bold text-2xl text-gray-900">
              {mode === 'login' ? 'Buyer & Trader Login' : 'Create Buyer Account'}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              {mode === 'login'
                ? 'Source bulk farm produce, verify digital lab reports & manage escrow orders'
                : 'Register your business to appear in farmer buyer-search results'}
            </p>
          </div>

          {/* Mode tabs */}
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Register
            </button>
          </div>

          {/* Success screen */}
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
                  {mode === 'register' ? 'Account Created!' : 'Authentication Successful'}
                </h3>
                <p className="text-xs text-gray-500">
                  {successBuyer?.companyName || successBuyer?.name
                    ? `Welcome, ${successBuyer.companyName || successBuyer.name}!`
                    : 'Redirecting to Buyer Portal…'}
                </p>
                {mode === 'register' && (
                  <p className="text-[11px] text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full font-semibold">
                    Your location is now visible to farmers in buyer searches ✓
                  </p>
                )}
              </motion.div>
            ) : mode === 'login' ? (
              <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <LoginForm onSuccess={handleSuccess} />
              </motion.div>
            ) : (
              <motion.div key="register" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <RegisterForm onSuccess={handleSuccess} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          {!success && (
            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-500">
                {mode === 'login' ? (
                  <>
                    New bulk buyer?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('register')}
                      className="font-semibold text-emerald-700 hover:underline"
                    >
                      Create Account →
                    </button>
                  </>
                ) : (
                  <>
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="font-semibold text-emerald-700 hover:underline"
                    >
                      Sign In →
                    </button>
                  </>
                )}
              </p>
              <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-gray-400">
                <Award className="w-3 h-3 text-emerald-600" />
                APEDA &amp; FSSAI Compliant Procurement Engine
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
