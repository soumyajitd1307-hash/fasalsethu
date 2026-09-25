import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, ShieldCheck, Mail, Lock, Eye, EyeOff,
  ArrowRight, ArrowLeft, CheckCircle2, Briefcase, FileText,
  Sprout, Award, ChevronRight
} from 'lucide-react'

export default function BuyerLogin() {
  const navigate = useNavigate()
  const [authType, setAuthType] = useState('email') // 'email' | 'gstin'
  const [email, setEmail] = useState('')
  const [gstin, setGstin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setSuccess(true)
      setTimeout(() => {
        navigate('/buyer')
      }, 900)
    }, 700)
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
              onClick={() => setAuthType('email')}
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
              onClick={() => setAuthType('gstin')}
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
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm text-gray-900 transition-all"
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
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm font-mono text-gray-900 transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-700">
                      Password
                    </label>
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
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm text-gray-900 transition-all"
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
              <Link to="/buyer" className="font-semibold text-emerald-700 hover:underline">
                Explore Buyer Solutions →
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
