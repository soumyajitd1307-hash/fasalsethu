import React, { useRef, useEffect, useState, Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import {
  Sprout, TrendingUp, MapPin, ShieldCheck, Zap, Users,
  ArrowRight, ChevronDown, Wheat, Star, CheckCircle2,
  BarChart3, Leaf, DollarSign, Package,
} from 'lucide-react'
import GrassStrip from '../components/GrassStrip'
import FloatingParticles from '../components/FloatingParticles'
import WindHeroCanvas from '../components/WindHeroCanvas'

const Scene3D = lazy(() => import('../components/Scene3D'))

/* ── Animated counter ── */
function Counter({ to, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0)
  const { ref, inView } = useInView({ triggerOnce: true })
  useEffect(() => {
    if (!inView) return
    let start = 0
    const steps = 60
    const increment = to / steps
    const iv = setInterval(() => {
      start += increment
      if (start >= to) { setCount(to); clearInterval(iv) }
      else setCount(Math.floor(start))
    }, duration / steps)
    return () => clearInterval(iv)
  }, [inView, to, duration])
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

/* ── Stat card ── */
function StatCard({ label, to, suffix, Icon, delay }) {
  const { ref, inView } = useInView({ triggerOnce: true })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className="bg-white border border-green-100 rounded-3xl p-6 text-center
                 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group"
    >
      <div className="w-12 h-12 rounded-2xl bg-green-50 border border-green-100
                      flex items-center justify-center mx-auto mb-3
                      group-hover:bg-green-100 transition-colors">
        <Icon className="w-6 h-6 text-green-600" />
      </div>
      <div className="font-display font-black text-4xl text-gradient mb-1">
        <Counter to={to} suffix={suffix} />
      </div>
      <p className="text-gray-500 text-sm">{label}</p>
    </motion.div>
  )
}

/* ── Scrolling crop ticker ── */
const cropPrices = [
  { crop: 'Wheat',    price: '₹2,180', change: '+2.4%', up: true,  icon: '🌾' },
  { crop: 'Rice',     price: '₹3,450', change: '+1.8%', up: true,  icon: '🌾' },
  { crop: 'Onion',    price: '₹1,250', change: '-0.5%', up: false, icon: '🧅' },
  { crop: 'Tomato',   price: '₹890',   change: '+5.2%', up: true,  icon: '🍅' },
  { crop: 'Potato',   price: '₹720',   change: '-1.2%', up: false, icon: '🥔' },
  { crop: 'Maize',    price: '₹1,680', change: '+3.1%', up: true,  icon: '🌽' },
  { crop: 'Soybean',  price: '₹4,200', change: '+0.9%', up: true,  icon: '🫘' },
  { crop: 'Cotton',   price: '₹6,800', change: '-0.3%', up: false, icon: '🌿' },
]

function CropTicker() {
  const items = [...cropPrices, ...cropPrices]
  return (
    <div className="overflow-hidden py-2.5 ticker-bar">
      <motion.div
        className="flex gap-8 w-max"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
      >
        {items.map((c, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0 text-sm">
            <span>{c.icon}</span>
            <span className="text-green-800 font-medium">{c.crop}</span>
            <span className="text-gray-800 font-semibold">{c.price}/qtl</span>
            <span className={`font-bold text-xs ${c.up ? 'text-green-600' : 'text-red-500'}`}>
              {c.change}
            </span>
            <span className="text-green-200">|</span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

/* ── Feature card ── */
function FeatureCard({ icon: Icon, title, desc, delay, accent }) {
  const { ref, inView } = useInView({ triggerOnce: true })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay }}
      className="bg-white border border-green-100 rounded-3xl p-7
                 card-hover card-shine group cursor-default
                 shadow-sm hover:shadow-lg hover:border-green-200"
    >
      <div className={`w-14 h-14 rounded-2xl ${accent} flex items-center justify-center mb-5
                       group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      <h3 className="font-display font-bold text-lg text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </motion.div>
  )
}

/* ── Step card ── */
function StepCard({ number, title, desc, icon: Icon, delay }) {
  const { ref, inView } = useInView({ triggerOnce: true })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -24 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className="flex gap-5 items-start"
    >
      <div className="shrink-0 w-12 h-12 rounded-2xl bg-green-600 flex items-center justify-center
                      text-white font-display font-bold text-lg shadow-md">
        {number}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-green-500" />
          <h4 className="font-display font-bold text-gray-900">{title}</h4>
        </div>
        <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  )
}

/* ── Testimonial card ── */
function TestimonialCard({ name, role, text, rating, delay }) {
  const { ref, inView } = useInView({ triggerOnce: true })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, delay }}
      className="bg-white border border-green-100 rounded-3xl p-7 card-hover shadow-sm
                 hover:shadow-lg hover:border-green-200 flex flex-col gap-4"
    >
      <div className="flex gap-1">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
        ))}
      </div>
      <p className="text-gray-600 text-sm leading-relaxed italic">"{text}"</p>
      <div className="flex items-center gap-3 mt-auto">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-700
                        flex items-center justify-center text-white font-bold text-sm">
          {name[0]}
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">{name}</p>
          <p className="text-gray-400 text-xs">{role}</p>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Data ── */
const features = [
  { icon: TrendingUp,  title: 'Live Market Intelligence',    accent: 'bg-green-600', delay: 0,    desc: 'Real-time crop prices from 3,200+ mandis with comparison, transport cost analysis, and net return calculations.' },
  { icon: MapPin,      title: 'Geo-Smart Buyer Matching',    accent: 'bg-sky-500',   delay: 0.08, desc: 'AI-powered matching connects farmers with nearby verified buyers based on crop type, quantity, location, and price.' },
  { icon: ShieldCheck, title: 'Verified Transactions',       accent: 'bg-emerald-600', delay: 0.16, desc: 'Every deal is tagged VERIFIED, PARTIALLY VERIFIED, or SELF-REPORTED — full trust and transparency for both parties.' },
  { icon: Zap,         title: 'Instant Price Discovery',     accent: 'bg-lime-600',  delay: 0.24, desc: 'Compare multiple market prices, factor in logistics cost, and pick the most profitable market in seconds.' },
  { icon: Users,       title: 'Buyer History & Trust Score', accent: 'bg-teal-600',  delay: 0.32, desc: 'Access complete buyer transaction history, reliability scores, and payment records before committing to a deal.' },
  { icon: BarChart3,   title: 'AI Market Assistant',         accent: 'bg-green-700', delay: 0.40, desc: 'Ask our AI assistant to explain price trends, recommend the best market, or estimate your net return on any crop.' },
]

const stats = [
  { label: 'Farmers Empowered', to: 142000, suffix: '+', icon: Leaf },
  { label: 'Buyers Connected',  to: 8500,   suffix: '+', icon: Users },
  { label: 'Markets Tracked',   to: 3200,   suffix: '+', icon: MapPin },
  { label: 'Crore Transacted',  to: 480,    suffix: '+ Cr', icon: DollarSign },
]

const steps = [
  { number: '01', title: 'Register & Profile', icon: Sprout,    desc: 'Create your farmer or buyer profile with location, crops, and contact details in under 2 minutes.', delay: 0 },
  { number: '02', title: 'List Your Crop',     icon: Wheat,     desc: 'Enter crop type, quantity, and farm location. Instantly see live market prices from nearby mandis.', delay: 0.08 },
  { number: '03', title: 'Compare Markets',    icon: TrendingUp, desc: 'See prices from multiple mandis with transport deducted — find the most profitable market near you.', delay: 0.16 },
  { number: '04', title: 'Match with Buyers',  icon: MapPin,    desc: 'Browse verified buyers on the interactive map who are actively buying your crop at competitive prices.', delay: 0.24 },
  { number: '05', title: 'Transact & Verify',  icon: ShieldCheck, desc: 'Complete the deal on-platform with full transaction verification and tamper-proof digital history.', delay: 0.32 },
]

const testimonials = [
  { name: 'Ramesh Patil', role: 'Onion Farmer, Nashik', rating: 5, delay: 0,    text: 'AgriBridge showed me a buyer 40 km away paying ₹200 more per quintal. My profit doubled this season without any middleman!' },
  { name: 'Sunita Devi',  role: 'Wheat Farmer, Punjab', rating: 5, delay: 0.1,  text: 'The market comparison feature is incredible. I could see the net return after transport from 5 mandis — all in one screen.' },
  { name: 'Anjali Traders', role: 'Buyer, Pune',        rating: 5, delay: 0.2,  text: 'As a buyer, I can now post my requirements and instantly get matched with farmers. Procurement is 3× faster than before.' },
]

export default function Home() {
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY       = useTransform(scrollYProgress, [0, 1], [0, 130])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0])

  const [demoModalOpen, setDemoModalOpen] = useState(false)

  return (
    <main className="bg-white overflow-x-hidden">

      {/* ══════════════════════════════════════════
          HERO — Haven Alpine Meadow with Living 3D WebGL Wind Vegetation
      ══════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative w-full h-screen min-h-[700px] flex flex-col items-center justify-center overflow-hidden"
      >
        {/* Fullscreen Living WebGL Background Canvas with 3D Wind Shader */}
        <WindHeroCanvas
          imageSrc="/hero-landscape.jpg"
          fallbackSrc="/hero-reference.png"
        />

        {/* Soft atmospheric gradient for crisp UI contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20 pointer-events-none z-[1]" />

        {/* ── Center UI Content: Dead center of full-screen background photo ── */}
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 w-full max-w-4xl mx-auto px-6 text-center flex flex-col items-center justify-center select-none"
        >
          {/* Pill Badge: We just raised 20M🚀 */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full
                       bg-white/85 backdrop-blur-md border border-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.06)]
                       text-xs font-semibold text-gray-800 mb-6 hover:bg-white hover:shadow-md transition-all cursor-default"
          >
            <span>We just raised 20M</span>
            <span className="text-sm">🚀</span>
          </motion.div>

          {/* Heading: Design with ease. */}
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-display font-black leading-[0.95] tracking-tight mb-5
                       text-5xl sm:text-6xl md:text-7xl lg:text-[5.4rem] text-[#111827]"
          >
            Design with ease.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="text-gray-800 text-base sm:text-lg md:text-xl font-normal max-w-xl mx-auto mb-8 leading-relaxed"
          >
            Design smarter with AI that understands you.
            <br />
            So you can take a breath.
          </motion.p>

          {/* Action Buttons: Get Started → / Watch Demo centered */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-4 justify-center"
          >
            <a
              href="#platform"
              className="px-8 py-3.5 rounded-full bg-white text-[#111827] font-semibold text-sm sm:text-base
                         shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_6px_25px_rgba(0,0,0,0.18)]
                         border border-black/5 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200
                         flex items-center gap-2 group cursor-pointer"
            >
              <span>Get Started</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </a>

            <button
              type="button"
              onClick={() => setDemoModalOpen(true)}
              className="px-6 py-3.5 rounded-full text-[#111827] font-semibold text-sm sm:text-base
                         hover:bg-white/50 backdrop-blur-xs transition-all duration-200 cursor-pointer"
            >
              Watch Demo
            </button>
          </motion.div>
        </motion.div>

        {/* ── Bottom SCROLL Indicator ── */}
        <motion.a
          href="#platform"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="absolute bottom-8 sm:bottom-10 left-1/2 -translate-x-1/2 z-20
                     px-5 py-2 rounded-full bg-black/40 hover:bg-black/60
                     backdrop-blur-md text-white/95 text-[11px] font-semibold
                     tracking-widest uppercase border border-white/20 shadow-lg
                     transition-all duration-200 flex items-center gap-1.5 cursor-pointer hover:scale-105"
        >
          <span>SCROLL</span>
          <span className="text-xs">↓</span>
        </motion.a>
      </section>

      {/* ── PLATFORM & LIVE TICKER ── */}
      <div id="platform" className="border-t border-green-100 bg-white">
        <CropTicker />
      </div>

      {/* ══════════════════════════════════════════
          STATS — white cards on light-green strip
      ══════════════════════════════════════════ */}
      <section className="py-20 bg-green-50 relative overflow-hidden">
        <FloatingParticles count={12} />
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map(({ label, to, suffix, icon: Icon }, i) => (
            <StatCard key={label} label={label} to={to} suffix={suffix} Icon={Icon} delay={i * 0.1} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FEATURES — white bg
      ══════════════════════════════════════════ */}
      <section id="features" className="py-24 bg-white relative overflow-hidden">
        <FloatingParticles count={16} />
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <p className="text-green-600 text-center text-xs font-semibold uppercase tracking-widest mb-3">
              Platform Features
            </p>
            <h2 className="section-title text-gradient">Everything a Farmer Needs</h2>
            <p className="section-subtitle">
              From seed to sale — AgriBridge provides end-to-end tools to help every Indian
              farmer maximise profit and eliminate the middleman.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => <FeatureCard key={f.title} {...f} />)}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS — light green bg
      ══════════════════════════════════════════ */}
      <section id="how" className="py-24 bg-green-50 relative overflow-hidden">
        <FloatingParticles count={14} />
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">

          {/* Steps */}
          <div>
            <p className="text-green-600 text-xs font-semibold uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="font-display font-black text-4xl md:text-5xl mb-3 text-gray-900">
              Farmer to Buyer <br />
              <span className="text-gradient">in 5 Simple Steps</span>
            </h2>
            <p className="text-gray-500 mb-10 text-sm leading-relaxed max-w-sm">
              Our streamlined process takes you from farm gate to final payment in one seamless digital journey.
            </p>
            <div className="space-y-8">
              {steps.map(s => <StepCard key={s.number} {...s} />)}
            </div>
          </div>

          {/* Floating UI cards */}
          <div className="relative h-[520px]">
            <FloatingParticles count={10} />

            {/* Market comparison card */}
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-0 right-0 w-72 bg-white border border-green-100
                         rounded-3xl p-5 shadow-lg"
            >
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-green-600" />
                <span className="font-display font-bold text-gray-900 text-sm">Market Comparison</span>
              </div>
              {[
                { market: 'Pune APMC',    price: '₹1,280/qtl', net: '₹1,190', dist: '42 km', best: true },
                { market: 'Nashik Mandi', price: '₹1,310/qtl', net: '₹1,140', dist: '80 km', best: false },
                { market: 'Solapur Yard', price: '₹1,200/qtl', net: '₹1,120', dist: '95 km', best: false },
              ].map(m => (
                <div key={m.market}
                  className={`flex items-center justify-between py-2 border-b border-gray-100 text-xs
                              ${m.best ? 'text-green-700' : 'text-gray-500'}`}>
                  <div>
                    <p className="font-semibold">{m.market}</p>
                    <p className="text-gray-400">{m.dist}</p>
                  </div>
                  <div className="text-right">
                    <p>{m.price}</p>
                    <p className={m.best ? 'text-green-600 font-bold' : ''}>{m.net} net</p>
                  </div>
                  {m.best && <CheckCircle2 className="w-4 h-4 text-green-500 ml-2" />}
                </div>
              ))}
              <p className="mt-3 text-[11px] text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Best net return: Pune APMC
              </p>
            </motion.div>

            {/* Buyer matches card */}
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute bottom-24 left-0 w-64 bg-white border border-green-100
                         rounded-3xl p-5 shadow-lg"
            >
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-green-600" />
                <span className="font-display font-bold text-gray-900 text-xs">Matched Buyers</span>
              </div>
              {[
                { name: 'Agro Traders Pvt Ltd', offer: '₹1,260/qtl', dist: '28 km' },
                { name: 'Fresh Exports Co.',    offer: '₹1,240/qtl', dist: '55 km' },
              ].map(b => (
                <div key={b.name} className="py-2 border-b border-gray-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800">{b.name}</span>
                    <span className="text-green-500 text-[10px] font-bold">✓ VERIFIED</span>
                  </div>
                  <div className="text-gray-400 flex justify-between mt-0.5">
                    <span>{b.offer}</span><span>{b.dist}</span>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Central verified badge */}
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                         w-24 h-24 rounded-full bg-green-600 shadow-xl
                         flex flex-col items-center justify-center text-center"
            >
              <ShieldCheck className="w-8 h-8 text-white mb-0.5" />
              <span className="text-[10px] text-green-100 font-bold leading-tight">100%<br/>VERIFIED</span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TESTIMONIALS — white bg
      ══════════════════════════════════════════ */}
      <section className="py-24 bg-white relative overflow-hidden">
        <FloatingParticles count={14} />
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-green-600 text-center text-xs font-semibold uppercase tracking-widest mb-3">Real Stories</p>
          <h2 className="section-title text-gradient">Farmers Are Winning</h2>
          <p className="section-subtitle">
            Thousands of farmers and buyers across India are transforming their livelihoods with AgriBridge.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map(t => <TestimonialCard key={t.name} {...t} />)}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CTA BANNER — light green bg + grass
      ══════════════════════════════════════════ */}
      <section id="about" className="py-24 bg-green-50 relative overflow-hidden">
        <FloatingParticles count={18} />
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white border border-green-100 rounded-3xl p-14 shadow-lg"
          >
            <div className="w-20 h-20 rounded-full bg-green-600 flex items-center justify-center
                            mx-auto mb-6 shadow-xl animate-float">
              <Sprout className="w-10 h-10 text-white" />
            </div>
            <h2 className="font-display font-black text-4xl md:text-5xl mb-4 text-gray-900">
              Start Your Journey<br />
              <span className="text-gradient">Today — It's Free</span>
            </h2>
            <p className="text-gray-500 mb-8 max-w-lg mx-auto text-sm leading-relaxed">
              Join 142,000+ farmers and 8,500+ buyers already using AgriBridge to trade
              smarter, faster, and more profitably.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/seller"
                className="flex items-center justify-center gap-2 px-10 py-4 rounded-full
                           font-semibold text-base bg-green-700 text-white shadow-md
                           hover:bg-green-600 hover:-translate-y-0.5 transition-all group">
                🌾 Register as Farmer
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/buyer"
                className="flex items-center justify-center gap-2 px-10 py-4 rounded-full
                           font-semibold text-base border-2 border-green-600 text-green-700
                           hover:bg-green-600 hover:text-white hover:-translate-y-0.5
                           transition-all group">
                🛒 Register as Buyer
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Grass before footer */}
        <div className="relative h-16 mt-16 overflow-hidden">
          <GrassStrip density={90} heightMin={16} heightMax={60} />
        </div>
      </section>

      {/* ── Watch Demo Modal ── */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[#ea580c] flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[#ea580c]" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-gray-900 text-lg">Product Walkthrough</h3>
                  <p className="text-gray-500 text-xs">AI-driven Agricultural Trading & Linkage Platform</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDemoModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Interactive Preview */}
            <div className="p-8 bg-gray-50 flex flex-col items-center text-center">
              <div className="w-full aspect-video rounded-2xl bg-gradient-to-br from-green-900 to-emerald-950 p-8 flex flex-col items-center justify-center text-white relative overflow-hidden shadow-inner">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-4 border border-white/30 animate-pulse">
                  <span className="text-2xl">▶</span>
                </div>
                <h4 className="font-display font-bold text-xl mb-2">Instant Mandi Price Discovery & Direct Buyer Matching</h4>
                <p className="text-green-200 text-sm max-w-md">
                  Watch how farmers compare real-time prices across 3,200+ mandis, calculate exact logistics deductions, and close verified deals in minutes.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-6">
                <Link
                  to="/seller"
                  onClick={() => setDemoModalOpen(false)}
                  className="p-4 rounded-2xl bg-white border border-green-200 text-left hover:border-green-400 hover:shadow-md transition-all group"
                >
                  <p className="font-bold text-gray-900 text-sm group-hover:text-green-700">🌾 Explore Farmer Experience →</p>
                  <p className="text-gray-500 text-xs mt-1">Upload crop batches, view geo-matched buyers & mandi price matrix</p>
                </Link>
                <Link
                  to="/buyer"
                  onClick={() => setDemoModalOpen(false)}
                  className="p-4 rounded-2xl bg-white border border-green-200 text-left hover:border-green-400 hover:shadow-md transition-all group"
                >
                  <p className="font-bold text-gray-900 text-sm group-hover:text-green-700">🛒 Explore Buyer Experience →</p>
                  <p className="text-gray-500 text-xs mt-1">Post procurement requirements & match directly with local farms</p>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
