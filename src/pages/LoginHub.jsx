import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sprout, Building2, ShieldCheck, ArrowRight, Wheat,
  TrendingUp, CheckCircle2, Lock, Zap, FileText, ChevronRight
} from 'lucide-react'

export default function LoginHub() {
  const farmerBenefits = [
    'Direct Mandi & MSP live pricing',
    'Sell harvests at 0% commission',
    'Instant UPI / Bank settlements',
    'Weather & crop health advisory',
  ]

  const buyerBenefits = [
    'Bulk procurement from verified farms',
    'Digital quality & lab test reports',
    'Escrow-secured financial protection',
    'Real-time logistics & dispatch tracking',
  ]

  return (
    <div className="min-h-screen pt-28 pb-20 px-4 bg-gradient-to-b from-green-50/50 via-white to-emerald-50/20 relative overflow-hidden flex flex-col justify-center">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[400px] bg-green-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[350px] bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto w-full relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-green-200 shadow-sm text-green-800 text-xs font-semibold mb-4"
          >
            <ShieldCheck className="w-4 h-4 text-green-600" />
            Fasal sethu Secure Access Gateway
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-display font-black text-3xl sm:text-5xl text-gray-900 tracking-tight leading-tight"
          >
            Select Your <span className="text-gradient">Login Portal</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-gray-500 text-sm sm:text-base mt-3 leading-relaxed"
          >
            Welcome to Fasal sethu. Please choose your portal to access your customized dashboard and features.
          </motion.p>
        </div>

        {/* Two Parts: Farmer vs Buyer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-stretch">
          {/* Part 1: Farmer Portal */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ y: -4 }}
            className="flex flex-col justify-between p-8 rounded-3xl bg-white/90 backdrop-blur-xl border-2 border-green-300/80 shadow-[0_12px_40px_rgba(22,163,74,0.08)] relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-36 h-36 bg-green-100/50 rounded-bl-full pointer-events-none" />

            <div>
              {/* Badge & Icon */}
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-green-600 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-green-600/25">
                  <Sprout className="w-7 h-7" />
                </div>
                <span className="px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-800 text-xs font-bold tracking-wide">
                  किसान पोर्टल
                </span>
              </div>

              {/* Title & Tagline */}
              <div className="mb-4">
                <span className="text-xs font-semibold text-green-700 tracking-wider uppercase">
                  For Farmers & Producers
                </span>
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-gray-900 mt-1">
                  Farmer Login
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-2 leading-relaxed">
                  List your produce, track real-time market prices, and receive instant payments directly from verified wholesale buyers.
                </p>
              </div>

              {/* Benefits list */}
              <ul className="space-y-2.5 my-6 pt-4 border-t border-green-100 text-xs sm:text-sm text-gray-700">
                {farmerBenefits.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action CTA */}
            <div className="pt-4 border-t border-gray-100">
              <Link
                to="/login/farmer"
                className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-green-700 to-green-500 hover:from-green-600 hover:to-green-400 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group/btn"
              >
                <span>Enter Farmer Login</span>
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </Link>
              <div className="mt-3 text-center">
                <Link to="/seller" className="text-xs font-semibold text-green-700 hover:underline">
                  New farmer? Register for free →
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Part 2: Buyer Portal */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            whileHover={{ y: -4 }}
            className="flex flex-col justify-between p-8 rounded-3xl bg-white/90 backdrop-blur-xl border-2 border-slate-300/80 shadow-[0_12px_40px_rgba(0,0,0,0.06)] relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-36 h-36 bg-slate-100/60 rounded-bl-full pointer-events-none" />

            <div>
              {/* Badge & Icon */}
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#131722] to-gray-800 text-white flex items-center justify-center shadow-lg">
                  <Building2 className="w-7 h-7 text-emerald-400" />
                </div>
                <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold tracking-wide">
                  व्यापारी पोर्टल
                </span>
              </div>

              {/* Title & Tagline */}
              <div className="mb-4">
                <span className="text-xs font-semibold text-slate-600 tracking-wider uppercase">
                  For Buyers & Enterprises
                </span>
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-gray-900 mt-1">
                  Buyer & Trader Login
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-2 leading-relaxed">
                  Direct procurement from audited farms, automated quality assaying, escrow payment protection, and complete supply chain transparency.
                </p>
              </div>

              {/* Benefits list */}
              <ul className="space-y-2.5 my-6 pt-4 border-t border-slate-100 text-xs sm:text-sm text-gray-700">
                {buyerBenefits.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action CTA */}
            <div className="pt-4 border-t border-gray-100">
              <Link
                to="/login/buyer"
                className="w-full py-3.5 px-6 rounded-full bg-[#131722] hover:bg-black text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group/btn"
              >
                <span>Enter Buyer Login</span>
                <ArrowRight className="w-4 h-4 text-emerald-400 group-hover/btn:translate-x-1 transition-transform" />
              </Link>
              <div className="mt-3 text-center">
                <Link to="/buyer" className="text-xs font-semibold text-gray-600 hover:text-black hover:underline">
                  Need bulk sourcing? View pricing & solutions →
                </Link>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Security & Support Guarantee */}
        <div className="mt-12 text-center flex flex-wrap items-center justify-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-green-600" />
            <span>256-Bit SSL Encrypted</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-gray-300" />
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span>Govt. Verified Identity & GST Integration</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-gray-300" />
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-green-600" />
            <span>Zero Processing Fees on Direct Farmer Payouts</span>
          </div>
        </div>
      </div>
    </div>
  )
}
