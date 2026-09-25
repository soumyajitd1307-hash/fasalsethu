import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sprout, Building2, ShieldCheck, ArrowRight,
  TrendingUp, Users, Truck, CheckCircle2,
} from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import LanguageSelector from '../../components/LanguageSelector'

export default function PortalSelection() {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-950 text-white relative overflow-hidden flex flex-col justify-between">
      {/* Background Decorative Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-lime-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-lime-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Sprout className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <span className="font-display font-black text-xl tracking-tight text-white flex items-center gap-1.5">
              {t('common.appName')}
              <span className="text-lime-400">.</span>
            </span>
            <p className="text-[10px] font-mono text-emerald-400/80 tracking-widest uppercase">
              {t('common.tagline')}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <LanguageSelector variant="dark" />
          <Link
            to="/"
            className="text-xs font-semibold text-emerald-300 hover:text-white transition-colors hidden sm:inline-block"
          >
            {t('common.backToHome')}
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-8 flex-1 flex flex-col items-center justify-center">
        {/* Title Section */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-2xl mx-auto mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
            <ShieldCheck className="w-3.5 h-3.5 text-lime-400" />
            <span>Digital Agricultural Mandi & Contract Gateway</span>
          </div>

          <h1 className="font-display font-black text-3xl sm:text-5xl text-white tracking-tight mb-4">
            {t('portals.welcomeTitle')}
          </h1>
          <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
            {t('portals.welcomeSubtitle')}
          </p>
          <p className="text-xs sm:text-sm font-semibold text-lime-400 mt-2 font-mono">
            {t('portals.selectPortal')}
          </p>
        </motion.div>

        {/* Portal Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          {/* 1. Farmer Portal Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="group relative bg-gradient-to-b from-slate-900/90 to-emerald-950/90 rounded-3xl p-8 border border-emerald-500/20 hover:border-emerald-400/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-emerald-500/10 flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />

            <div>
              {/* Badge & Icon */}
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">
                  <Sprout className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-500/30">
                  {t('portals.farmer.badge')}
                </span>
              </div>

              {/* Title & Desc */}
              <h2 className="font-display font-bold text-2xl text-white mb-2 group-hover:text-lime-400 transition-colors">
                {t('portals.farmer.title')}
              </h2>
              <p className="text-gray-300 text-sm leading-relaxed mb-6">
                {t('portals.farmer.description')}
              </p>

              {/* Bullet Features */}
              <ul className="space-y-2.5 mb-8">
                <li className="flex items-center gap-2.5 text-xs text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Live Hyperlocal Buyer Radar & APMC Benchmark Rates</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Direct Trade with Verified Institutional Buyers</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Free Farmgate Pickup & Zero Middleman Cut</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => navigate('/farmer/login')}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-lime-500 hover:from-emerald-400 hover:to-lime-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 group-hover:gap-3 transition-all"
              >
                <span>{t('portals.farmer.action')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center">
                <Link
                  to="/farmer/register"
                  className="text-xs font-semibold text-emerald-300/80 hover:text-white transition-colors"
                >
                  {t('auth.noAccount')} <span className="text-lime-400 underline">{t('auth.registerFarmer')}</span>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* 2. Buyer Portal Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="group relative bg-gradient-to-b from-slate-900/90 to-sky-950/90 rounded-3xl p-8 border border-sky-500/20 hover:border-sky-400/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-sky-500/10 flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />

            <div>
              {/* Badge & Icon */}
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 group-hover:bg-sky-500 group-hover:text-slate-950 transition-all">
                  <Building2 className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-sky-900/80 text-sky-300 border border-sky-500/30">
                  {t('portals.buyer.badge')}
                </span>
              </div>

              {/* Title & Desc */}
              <h2 className="font-display font-bold text-2xl text-white mb-2 group-hover:text-sky-300 transition-colors">
                {t('portals.buyer.title')}
              </h2>
              <p className="text-gray-300 text-sm leading-relaxed mb-6">
                {t('portals.buyer.description')}
              </p>

              {/* Bullet Features */}
              <ul className="space-y-2.5 mb-8">
                <li className="flex items-center gap-2.5 text-xs text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Post Multi-Crop Bulk Procurement Requirements</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Connect with Verified Farmers & FPO Harvest Batches</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Digital Contract Settlements & Quality Assurance</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => navigate('/buyer/login')}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-400 hover:from-sky-400 hover:to-emerald-300 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 group-hover:gap-3 transition-all"
              >
                <span>{t('portals.buyer.action')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center">
                <Link
                  to="/buyer/register"
                  className="text-xs font-semibold text-sky-300/80 hover:text-white transition-colors"
                >
                  {t('auth.noAccount')} <span className="text-sky-300 underline">{t('auth.registerBuyer')}</span>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Live Trust Metrics Bar */}
        <div className="mt-12 w-full max-w-4xl grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm text-center">
          <div>
            <p className="font-display font-black text-lg text-lime-400">25,000+</p>
            <p className="text-[11px] text-gray-400">Verified Farmers</p>
          </div>
          <div>
            <p className="font-display font-black text-lg text-emerald-400">1,200+</p>
            <p className="text-[11px] text-gray-400">Institutional Buyers</p>
          </div>
          <div>
            <p className="font-display font-black text-lg text-sky-400">₹42+ Cr</p>
            <p className="text-[11px] text-gray-400">Produce Traded</p>
          </div>
          <div>
            <p className="font-display font-black text-lg text-amber-400">0%</p>
            <p className="text-[11px] text-gray-400">Middleman Fee</p>
          </div>
        </div>
      </main>

      {/* Footer Minimal */}
      <footer className="relative z-10 w-full text-center py-6 text-xs text-gray-500 border-t border-white/5">
        <p>© 2026 FasalSethu Agricultural Marketplace. Connecting Bharat's Soil to the Market.</p>
      </footer>
    </div>
  )
}
