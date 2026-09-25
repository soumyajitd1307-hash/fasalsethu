import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sprout, ShieldCheck, Phone, Lock, Eye, EyeOff,
  ArrowRight, ArrowLeft, CheckCircle2, Globe, HelpCircle,
  Wheat, Sparkles, Building2
} from 'lucide-react'

export default function FarmerLogin() {
  const navigate = useNavigate()
  const [loginMethod, setLoginMethod] = useState('otp') // 'otp' | 'password'
  const [phone, setPhone] = useState('')
  const [kisanId, setKisanId] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpSent, setOtpSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [selectedLang, setSelectedLang] = useState('English')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const languages = ['English', 'हिन्दी', 'मराठी', 'ਪੰਜਾਬੀ', 'తెలుగు']

  const handleSendOtp = (e) => {
    e?.preventDefault()
    if (phone.length < 10) return
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setOtpSent(true)
    }, 600)
  }

  const handleOtpChange = (val, index) => {
    if (!/^\d*$/.test(val)) return
    const newOtp = [...otp]
    newOtp[index] = val.slice(-1)
    setOtp(newOtp)
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      if (nextInput) nextInput.focus()
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setSuccess(true)
      setTimeout(() => {
        navigate('/seller')
      }, 900)
    }, 700)
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

          {/* Login Method Toggle */}
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => { setLoginMethod('otp'); setOtpSent(false); }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                loginMethod === 'otp'
                  ? 'bg-white text-green-800 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mobile OTP (Fast)
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod('password')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                loginMethod === 'password'
                  ? 'bg-white text-green-800 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Kisan ID / Password
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
                {loginMethod === 'otp' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Registered Mobile Number
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3.5 text-xs font-bold text-gray-500">
                          +91
                        </span>
                        <input
                          type="tel"
                          maxLength={10}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="98765 43210"
                          disabled={otpSent}
                          required
                          className="w-full pl-12 pr-24 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none text-sm text-gray-900 transition-all disabled:bg-gray-50"
                        />
                        {!otpSent && (
                          <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={phone.length < 10 || isLoading}
                            className="absolute right-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
                          >
                            Send OTP
                          </button>
                        )}
                        {otpSent && (
                          <button
                            type="button"
                            onClick={() => setOtpSent(false)}
                            className="absolute right-2 px-2 py-1 text-green-700 text-xs font-semibold hover:underline"
                          >
                            Change
                          </button>
                        )}
                      </div>
                    </div>

                    {otpSent && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2 pt-1"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-700">
                            Enter 6-Digit OTP
                          </label>
                          <span className="text-[11px] text-green-700">
                            OTP sent to +91 {phone}
                          </span>
                        </div>
                        <div className="flex gap-2 justify-between">
                          {otp.map((digit, idx) => (
                            <input
                              key={idx}
                              id={`otp-${idx}`}
                              type="text"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => handleOtpChange(e.target.value, idx)}
                              className="w-11 h-12 text-center text-lg font-bold rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all"
                            />
                          ))}
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={handleSendOtp}
                            className="text-[11px] font-medium text-gray-500 hover:text-green-700"
                          >
                            Resend OTP in 30s
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Kisan ID or Phone
                      </label>
                      <div className="relative flex items-center">
                        <Sprout className="w-4 h-4 text-gray-400 absolute left-3.5" />
                        <input
                          type="text"
                          value={kisanId}
                          onChange={(e) => setKisanId(e.target.value)}
                          placeholder="e.g. KISAN-9842 or 9876543210"
                          required
                          className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none text-sm text-gray-900 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-700">
                          Password / PIN
                        </label>
                        <a href="#forgot" className="text-[11px] font-medium text-green-700 hover:underline">
                          Forgot PIN?
                        </a>
                      </div>
                      <div className="relative flex items-center">
                        <Lock className="w-4 h-4 text-gray-400 absolute left-3.5" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your security PIN or password"
                          required
                          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none text-sm text-gray-900 transition-all"
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
                  </>
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
                  disabled={isLoading || (loginMethod === 'otp' && !otpSent)}
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
              <Link to="/seller" className="font-semibold text-green-700 hover:underline">
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
