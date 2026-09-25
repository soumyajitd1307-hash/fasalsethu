import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Building2, User, Mail, Lock, Phone, ArrowRight,
  AlertCircle, Globe, Briefcase,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage, SUPPORTED_LANGUAGES } from '../../context/LanguageContext'
import LanguageSelector from '../../components/LanguageSelector'

export default function BuyerRegister() {
  const { register } = useAuth()
  const { t, language, setLanguage } = useLanguage()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [preferredLang, setPreferredLang] = useState(language)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!fullName.trim() || !businessName.trim() || !email.trim() || !password) {
      setError(t('errors.requiredFields'))
      return
    }

    if (password.length < 6) {
      setError(t('errors.weakPassword'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('errors.passwordMismatch'))
      return
    }

    setLoading(true)
    const result = await register({
      fullName: fullName.trim(),
      businessName: businessName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
      role: 'buyer',
      language: preferredLang,
    })

    if (result.success) {
      setLanguage(preferredLang)
      navigate('/buyer/dashboard', { replace: true })
    } else {
      setError(result.error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-sky-950 to-slate-950 text-white relative flex flex-col justify-between overflow-x-hidden">
      {/* Glows */}
      <div className="absolute top-10 right-1/3 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
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
            to="/buyer/login"
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-sky-200 transition-colors"
          >
            {t('auth.loginLink')}
          </Link>
        </div>
      </header>

      {/* Register Form Card */}
      <main className="relative z-10 w-full max-w-lg mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/90 backdrop-blur-xl border border-sky-500/30 rounded-3xl p-8 shadow-2xl shadow-sky-950/80"
        >
          {/* Card Header */}
          <div className="text-center mb-6">
            <span className="inline-block px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-sky-900/80 text-sky-300 border border-sky-500/30 mb-2">
              {t('portals.buyer.badge')}
            </span>
            <h1 className="font-display font-black text-2xl text-white">
              {t('auth.buyerRegisterTitle')}
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              {t('auth.buyerRegisterSubtitle')}
            </p>
          </div>

          {/* Feedback Error */}
          {error && (
            <div className="mb-5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name & Business Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                {t('auth.fullName')} *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g., Rajesh Agrawal (Authorized Signatory)"
                  className="w-full px-4 py-2.5 pl-10 rounded-2xl bg-slate-950/80 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all"
                />
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                {t('auth.businessName')} *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder={t('auth.businessNamePlaceholder')}
                  className="w-full px-4 py-2.5 pl-10 rounded-2xl bg-slate-950/80 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all"
                />
                <Briefcase className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Email & Phone grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  {t('auth.email')} *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('auth.emailPlaceholder')}
                    className="w-full px-4 py-2.5 pl-10 rounded-2xl bg-slate-950/80 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all"
                  />
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  {t('auth.phone')}
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder={t('auth.phonePlaceholder')}
                    className="w-full px-4 py-2.5 pl-10 rounded-2xl bg-slate-950/80 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all"
                  />
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                </div>
              </div>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  {t('auth.password')} *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t('auth.passwordPlaceholder')}
                    className="w-full px-4 py-2.5 pl-10 rounded-2xl bg-slate-950/80 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all"
                  />
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  {t('auth.confirmPassword')} *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    className="w-full px-4 py-2.5 pl-10 rounded-2xl bg-slate-950/80 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all"
                  />
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                </div>
              </div>
            </div>

            {/* Preferred Language */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                {t('auth.preferredLanguage')}
              </label>
              <div className="relative">
                <select
                  value={preferredLang}
                  onChange={e => setPreferredLang(e.target.value)}
                  className="w-full px-4 py-2.5 pl-10 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all appearance-none cursor-pointer"
                >
                  {SUPPORTED_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                      {l.native} ({l.label})
                    </option>
                  ))}
                </select>
                <Globe className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-400 hover:from-sky-400 hover:to-emerald-300 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{t('auth.registerButton')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Bottom Link */}
          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-xs text-gray-400">
              {t('auth.haveAccount')}{' '}
              <Link to="/buyer/login" className="text-sky-300 hover:underline font-bold">
                {t('auth.loginLink')}
              </Link>
            </p>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full text-center py-4 text-[11px] text-gray-500">
        <p>Protected by FasalSethu Enterprise Security & Firebase Authentication</p>
      </footer>
    </div>
  )
}
