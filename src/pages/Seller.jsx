import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import {
  Sprout, TrendingUp, MapPin, ShieldCheck, BarChart3, Wheat,
  ArrowRight, CheckCircle2, ChevronRight, Star,
  DollarSign, Clock, Zap, Users, Package, Leaf,
} from 'lucide-react'
import GrassStrip from '../components/GrassStrip'
import FloatingParticles from '../components/FloatingParticles'
import FarmerDashboard from '../components/FarmerDashboard'

/* ── Interactive crop listing form ── */
function CropListingForm() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ crop: '', qty: '', unit: 'quintal', location: '' })
  const crops = ['Wheat','Rice','Onion','Tomato','Potato','Maize','Soybean','Cotton','Sugarcane','Mustard']

  return (
    <div className="bg-white border border-green-100 rounded-3xl p-6 shadow-lg max-w-md w-full">

      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-6">
        {[1,2,3].map(s => (
          <React.Fragment key={s}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                            transition-all duration-300 ${
              step >= s
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-green-50 border border-green-200 text-green-400'
            }`}>{s}</div>
            {s < 3 && (
              <div className={`flex-1 h-0.5 transition-all duration-500
                ${step > s ? 'bg-green-500' : 'bg-green-100'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <motion.div key="s1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
          <h3 className="font-display font-bold text-gray-900 text-lg mb-4">Select Your Crop</h3>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {crops.map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, crop: c }))}
                className={`py-2 px-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  form.crop === c
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-green-50 border border-green-100 text-green-700 hover:bg-green-100'
                }`}>
                {c}
              </button>
            ))}
          </div>
          <button onClick={() => form.crop && setStep(2)} disabled={!form.crop}
            className="w-full btn-primary py-3 disabled:opacity-40 disabled:cursor-not-allowed">
            Next →
          </button>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
          <h3 className="font-display font-bold text-gray-900 text-lg mb-4">Quantity & Location</h3>
          <div className="space-y-3 mb-4">
            <div>
              <label className="text-gray-500 text-xs mb-1 block font-medium">Quantity</label>
              <div className="flex gap-2">
                <input type="number" placeholder="e.g. 1000" value={form.qty}
                  onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                  className="flex-1 px-4 py-3 rounded-xl bg-green-50 border border-green-200
                             text-gray-900 text-sm focus:outline-none focus:border-green-500" />
                <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="px-3 py-3 rounded-xl bg-green-50 border border-green-200
                             text-gray-700 text-sm focus:outline-none">
                  <option>quintal</option><option>tonne</option><option>kg</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1 block font-medium">Farm Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                <input type="text" placeholder="Enter village / district" value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-green-50 border border-green-200
                             text-gray-900 text-sm focus:outline-none focus:border-green-500" />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 btn-outline py-3 text-sm">← Back</button>
            <button onClick={() => form.qty && form.location && setStep(3)}
              disabled={!form.qty || !form.location}
              className="flex-1 btn-primary py-3 text-sm disabled:opacity-40">Next →</button>
          </div>
        </motion.div>
      )}

      {step === 3 && (
        <motion.div key="s3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
          <h3 className="font-display font-bold text-gray-900 text-lg mb-4">Review & Submit</h3>
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mb-4 space-y-2 text-sm">
            {[['Crop', form.crop],['Quantity', `${form.qty} ${form.unit}`],['Location', form.location]].map(([k,v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-500">{k}</span>
                <span className="text-gray-900 font-semibold">{v}</span>
              </div>
            ))}
          </div>
          <div className="bg-green-600/8 border border-green-200 rounded-2xl p-4 mb-4 text-xs text-green-700">
            <p className="font-semibold mb-1">🎉 We found market prices for {form.crop}!</p>
            <p>Best mandi: Pune APMC — ₹1,280/qtl (net ₹1,190 after transport)</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 btn-outline py-3 text-sm">← Back</button>
            <button className="flex-1 btn-primary py-3 text-sm">🚀 Get Buyer Matches</button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

/* ── Benefit card ── */
function BenefitCard({ icon: Icon, title, desc, stat, delay, accent }) {
  const { ref, inView } = useInView({ triggerOnce: true })
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 28 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className="bg-white border border-green-100 rounded-3xl p-6 card-hover card-shine
                 shadow-sm hover:shadow-lg hover:border-green-200 group">
      <div className={`w-12 h-12 rounded-2xl ${accent} flex items-center justify-center mb-4
                       group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      {stat && <div className="text-2xl font-display font-black text-gradient mb-1">{stat}</div>}
      <h3 className="font-display font-bold text-gray-900 text-base mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </motion.div>
  )
}

/* ── FAQ accordion ── */
function FAQ({ q, a, delay }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.4, delay }}
      className="bg-white border border-green-100 rounded-2xl overflow-hidden shadow-sm">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left
                   text-gray-800 font-medium text-sm hover:bg-green-50 transition-colors">
        {q}
        <ChevronRight className={`w-4 h-4 text-green-500 transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="px-5 pb-5 text-gray-500 text-sm leading-relaxed border-t border-green-100">
          <p className="pt-3">{a}</p>
        </motion.div>
      )}
    </motion.div>
  )
}

/* ── Data ── */
const benefits = [
  { icon: DollarSign, title: 'Higher Net Returns',    stat: '+32%', delay: 0,    accent: 'bg-green-600',   desc: 'Farmers using AgriBridge earn an average 32% more per quintal by eliminating middlemen.' },
  { icon: Clock,      title: 'Sell in 48 Hours',      stat: '48h',  delay: 0.08, accent: 'bg-sky-500',     desc: 'From listing your crop to completing a verified transaction in as little as 48 hours.' },
  { icon: ShieldCheck,title: 'Zero Fraud Risk',       stat: '100%', delay: 0.16, accent: 'bg-emerald-600', desc: 'All buyers are KYC-verified. Every transaction is digitally recorded with verification status.' },
  { icon: MapPin,     title: 'Hyperlocal Matching',   stat: '<50km',delay: 0.24, accent: 'bg-teal-600',    desc: 'Our geo-matching algorithm finds serious buyers within your preferred distance radius.' },
  { icon: BarChart3,  title: 'Live Price Feed',        stat: '3,200+',delay:0.32, accent: 'bg-lime-600',    desc: 'Prices from 3,200+ mandis updated in real-time. Know if today is the right day to sell.' },
  { icon: Users,      title: 'Community Network',     stat: '142K+',delay: 0.40, accent: 'bg-green-700',   desc: 'Join India\'s largest farmer-buyer network. Learn, share tips, and grow together.' },
]

const tools = [
  { icon: TrendingUp, label: 'Market Price Dashboard',   accent: 'bg-green-600' },
  { icon: MapPin,     label: 'Buyer Discovery Map',      accent: 'bg-sky-500' },
  { icon: BarChart3,  label: 'Net Return Calculator',    accent: 'bg-lime-600' },
  { icon: ShieldCheck,label: 'Transaction Tracker',      accent: 'bg-emerald-600' },
  { icon: Package,    label: 'Crop Listing Manager',     accent: 'bg-teal-600' },
  { icon: Zap,        label: 'AI Price Advisor',         accent: 'bg-green-700' },
]

const faqs = [
  { q: 'Is AgriBridge free for farmers?',         a: 'Yes — registration and listing is completely free. We charge a small success fee only on completed transactions.' },
  { q: 'How do I know a buyer is genuine?',        a: 'All buyers go through KYC verification. You can view their transaction history, ratings, and verification status before agreeing to a deal.' },
  { q: 'What crops can I list?',                   a: 'Any food crop, cash crop, or horticulture product. We currently support 200+ crop varieties with live market pricing.' },
  { q: 'How is the net return calculated?',        a: 'We fetch your crop price at each nearby market, deduct estimated transport cost based on distance, and show the actual amount you take home.' },
  { q: 'What if a buyer disputes the transaction?',a: 'Our dispute resolution team steps in within 24 hours. Transactions are clearly labelled VERIFIED, PARTIALLY VERIFIED, SELF-REPORTED, or DISPUTED.' },
]

const marketRows = [
  { crop:'🧅 Onion', market:'Pune APMC',      price:'₹1,280', transport:'₹90',  net:'₹1,190', change:'+2.4%', up:true,  status:'VERIFIED',         best:true  },
  { crop:'🌾 Wheat', market:'Delhi Azadpur',  price:'₹2,180', transport:'₹120', net:'₹2,060', change:'+1.8%', up:true,  status:'VERIFIED',         best:false },
  { crop:'🍅 Tomato',market:'Nashik Mandi',   price:'₹890',   transport:'₹60',  net:'₹830',   change:'+5.2%', up:true,  status:'VERIFIED',         best:false },
  { crop:'🥔 Potato',market:'Agra APMC',      price:'₹720',   transport:'₹80',  net:'₹640',   change:'-1.2%', up:false, status:'PARTIALLY',        best:false },
  { crop:'🌽 Maize', market:'Gulbarga Yard',  price:'₹1,680', transport:'₹100', net:'₹1,580', change:'+3.1%', up:true,  status:'VERIFIED',         best:false },
  { crop:'🫘 Soybean',market:'Indore APMC',   price:'₹4,200', transport:'₹140', net:'₹4,060', change:'+0.9%', up:true,  status:'VERIFIED',         best:false },
]

export default function Seller() {
  return (
    <main className="bg-white overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative min-h-screen pt-20 flex items-center overflow-hidden hero-bg">
        <FloatingParticles count={28} />
        <div className="absolute inset-0 sun-rays opacity-40 pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center py-20">
          {/* Left */}
          <div>
            <motion.div initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                         bg-white/80 border border-green-200 shadow-sm
                         text-xs text-green-700 font-semibold mb-6 uppercase tracking-wider">
              <Sprout className="w-4 h-4" /> Farmer Portal — Sell Smarter
            </motion.div>

            <motion.h1 initial={{ opacity:0, y:28 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.8, delay:0.15 }}
              className="font-display font-black text-5xl md:text-6xl leading-[0.95] mb-6">
              <span className="text-gray-900">Grow More.</span><br />
              <span className="text-gradient">Earn More.</span><br />
              <span className="text-gray-900">Waste Less.</span>
            </motion.h1>

            <motion.p initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.7, delay:0.3 }}
              className="text-gray-600 text-lg mb-8 leading-relaxed max-w-lg">
              List your crop, compare market prices across 3,200+ mandis, and connect with
              verified buyers near you — all without a single middleman taking your profit.
            </motion.p>

            <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.6, delay:0.45 }} className="space-y-2.5 mb-8">
              {[
                'Real-time price comparison across mandis',
                'Transport cost deducted — see your actual net return',
                'Verified buyers matched within your preferred radius',
                'Complete transaction history & buyer trust scores',
              ].map(item => (
                <div key={item} className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  {item}
                </div>
              ))}
            </motion.div>

            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
              transition={{ duration:0.6, delay:0.6 }} className="flex flex-wrap gap-4">
              <a href="#dashboard" className="btn-primary flex items-center gap-2 group shadow-md hover:shadow-lg">
                👨‍🌾 Open Farmer Command Center
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="#list-crop" className="btn-outline flex items-center gap-2">
                🌾 Quick List Form
              </a>
            </motion.div>
          </div>

          {/* Right: form */}
          <motion.div initial={{ opacity:0, scale:0.92, x:30 }} animate={{ opacity:1, scale:1, x:0 }}
            transition={{ duration:0.8, delay:0.25 }} className="flex justify-center" id="list-crop">
            <CropListingForm />
          </motion.div>
        </div>

        {/* Grass */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <div className="relative h-24 opacity-35"><GrassStrip density={55} heightMin={28} heightMax={90} /></div>
          <div className="relative h-18 -mt-10 opacity-65"><GrassStrip density={80} heightMin={22} heightMax={70} /></div>
          <div className="relative h-14 -mt-7"><GrassStrip density={110} heightMin={16} heightMax={55} /></div>
        </div>
      </section>

      {/* ── M5 FARMER COMMAND CENTER / DASHBOARD ── */}
      <section id="dashboard" className="py-20 bg-green-50/50 relative overflow-hidden">
        <FloatingParticles count={14} />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-green-100 text-green-800">
              SIH M5 Core Module
            </span>
            <h2 className="section-title text-gradient mt-2">Farmer Command Center</h2>
            <p className="section-subtitle">
              Manage your active crop inventory, discover nearby buyers on the radar map, compare net returns after freight, and track verified deals in real time.
            </p>
          </div>

          <FarmerDashboard />
        </div>
      </section>

      {/* ── LIVE MARKET PRICES ── */}
      <section id="markets" className="py-24 bg-green-50 relative overflow-hidden">
        <FloatingParticles count={14} />
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-green-600 text-center text-xs font-semibold uppercase tracking-widest mb-3">Live Prices</p>
          <h2 className="section-title text-gradient">Today's Market Rates</h2>
          <p className="section-subtitle">Live prices from mandis near you, updated every 15 minutes.</p>

          <div className="bg-white border border-green-100 rounded-3xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-green-100 bg-green-50">
                    {['Crop','Market','Price/Qtl','Transport Est.','Net Return','Change','Status'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {marketRows.map((row, i) => (
                    <motion.tr key={i}
                      initial={{ opacity:0, x:-16 }} whileInView={{ opacity:1, x:0 }}
                      viewport={{ once:true }} transition={{ duration:0.4, delay: i*0.06 }}
                      className={`border-b border-gray-50 hover:bg-green-50/60 transition-colors ${row.best ? 'bg-green-50/40' : ''}`}>
                      <td className="py-4 px-4 text-gray-800 font-medium text-sm">{row.crop}</td>
                      <td className="py-4 px-4 text-gray-500 text-sm">{row.market}</td>
                      <td className="py-4 px-4 text-gray-900 font-bold text-sm">{row.price}</td>
                      <td className="py-4 px-4 text-gray-400 text-sm">{row.transport}</td>
                      <td className="py-4 px-4">
                        <span className={`font-bold text-sm ${row.best ? 'text-green-600' : 'text-gray-700'}`}>{row.net}</span>
                        {row.best && <span className="ml-2 text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold">BEST</span>}
                      </td>
                      <td className={`py-4 px-4 font-bold text-sm ${row.up ? 'text-green-600' : 'text-red-500'}`}>{row.change}</td>
                      <td className="py-4 px-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          row.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>{row.status}</span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="py-24 bg-white relative overflow-hidden">
        <FloatingParticles count={14} />
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-green-600 text-center text-xs font-semibold uppercase tracking-widest mb-3">Why Farmers Choose Us</p>
          <h2 className="section-title text-gradient">Built for India's Farmers</h2>
          <p className="section-subtitle">Everything designed from the ground up for the realities of Indian agriculture.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map(b => <BenefitCard key={b.title} {...b} />)}
          </div>
        </div>
      </section>

      {/* ── TOOLS ── */}
      <section className="py-24 bg-green-50 relative overflow-hidden">
        <FloatingParticles count={14} />
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-green-600 text-center text-xs font-semibold uppercase tracking-widest mb-3">Farmer Toolkit</p>
          <h2 className="section-title text-gradient">Powerful Tools at Your Fingertips</h2>
          <p className="section-subtitle">Six powerful modules designed to maximise your farming income.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {tools.map(({ icon: Icon, label, accent }, i) => (
              <motion.div key={label}
                initial={{ opacity:0, scale:0.92 }} whileInView={{ opacity:1, scale:1 }}
                viewport={{ once:true }} transition={{ duration:0.4, delay:i*0.07 }}
                className="bg-white border border-green-100 rounded-2xl p-5 card-hover group cursor-pointer shadow-sm hover:shadow-md hover:border-green-200">
                <div className={`w-10 h-10 rounded-xl ${accent} flex items-center justify-center mb-3
                                group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-gray-800 font-medium text-sm">{label}</p>
                <ChevronRight className="w-4 h-4 text-green-400 mt-1 group-hover:text-green-600 group-hover:translate-x-1 transition-all" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 bg-white relative">
        <FloatingParticles count={10} />
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-green-600 text-center text-xs font-semibold uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="section-title text-gradient">Farmer Questions Answered</h2>
          <p className="section-subtitle">Everything you need to know before getting started.</p>
          <div className="space-y-3">
            {faqs.map((f, i) => <FAQ key={i} {...f} delay={i * 0.06} />)}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-green-50 relative overflow-hidden">
        <FloatingParticles count={16} />
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity:0, y:24 }} whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true }} transition={{ duration:0.6 }}
            className="bg-white border border-green-100 rounded-3xl p-12 shadow-lg">
            <div className="text-6xl mb-4 animate-bounce-slow">🌾</div>
            <h2 className="font-display font-black text-3xl md:text-4xl mb-4 text-gray-900">
              <span className="text-gradient">Start Selling Smarter</span>
            </h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              Free registration. No commission until you sell. Get your first buyer match in under 24 hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="#list-crop"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-full
                           font-semibold bg-green-700 text-white hover:bg-green-600
                           hover:-translate-y-0.5 shadow-md transition-all group">
                🌾 Register as Farmer
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <Link to="/buyer"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-full
                           font-semibold border-2 border-green-600 text-green-700
                           hover:bg-green-600 hover:text-white hover:-translate-y-0.5 transition-all">
                🛒 Looking to Buy?
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="relative h-14 mt-12 overflow-hidden">
          <GrassStrip density={90} heightMin={16} heightMax={58} />
        </div>
      </section>
    </main>
  )
}
