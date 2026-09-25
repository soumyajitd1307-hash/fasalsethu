import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import {
  ShoppingCart, MapPin, ShieldCheck, BarChart3, Package,
  ArrowRight, CheckCircle2, ChevronRight, Star, Users,
  Search, Clock, DollarSign, TrendingDown, Zap, Phone, AlertCircle, Leaf,
} from 'lucide-react'
import GrassStrip from '../components/GrassStrip'
import FloatingParticles from '../components/FloatingParticles'
import PriceComparisonMatrix from '../components/PriceComparisonMatrix'

/* ── Buyer search panel ── */
function BuyerSearchPanel() {
  const [search, setSearch] = useState({ crop: '', qty: '', location: '', maxDist: '100' })
  const [searched, setSearched] = useState(false)

  const mockResults = [
    { name: 'Ramesh Patil',  crop: 'Onion', qty: '500–2000 qtl', price: '₹1,260/qtl', dist: '28 km', rating: 4.8, verified: true,  history: 42, badge: 'TOP SELLER' },
    { name: 'Sunita Farms',  crop: 'Onion', qty: '100–800 qtl',  price: '₹1,240/qtl', dist: '45 km', rating: 4.6, verified: true,  history: 28, badge: 'TRUSTED' },
    { name: 'Green Valley',  crop: 'Onion', qty: '200–1500 qtl', price: '₹1,220/qtl', dist: '62 km', rating: 4.4, verified: false, history: 15, badge: 'NEW' },
  ]

  return (
    <div className="bg-white border border-green-100 rounded-3xl p-6 shadow-lg w-full max-w-lg">
      <div className="flex items-center gap-2 mb-5">
        <Search className="w-5 h-5 text-green-600" />
        <h3 className="font-display font-bold text-gray-900">Find Farmers Near You</h3>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <label className="text-gray-500 text-xs mb-1 block font-medium">Crop Required</label>
          <select value={search.crop} onChange={e => setSearch(s => ({ ...s, crop: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl bg-green-50 border border-green-200
                       text-gray-800 text-sm focus:outline-none focus:border-green-500">
            <option value="">Select crop...</option>
            {['Onion','Wheat','Rice','Tomato','Potato','Maize','Soybean'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-gray-500 text-xs mb-1 block font-medium">Min Quantity (qtl)</label>
            <input type="number" placeholder="e.g. 500" value={search.qty}
              onChange={e => setSearch(s => ({ ...s, qty: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-green-50 border border-green-200
                         text-gray-900 text-sm focus:outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="text-gray-500 text-xs mb-1 block font-medium">Max Distance (km)</label>
            <select value={search.maxDist} onChange={e => setSearch(s => ({ ...s, maxDist: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-green-50 border border-green-200
                         text-gray-800 text-sm focus:outline-none">
              {['25','50','100','200','Any'].map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-gray-500 text-xs mb-1 block font-medium">Your Location</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
            <input type="text" placeholder="City / district / pincode" value={search.location}
              onChange={e => setSearch(s => ({ ...s, location: e.target.value }))}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-green-50 border border-green-200
                         text-gray-900 text-sm focus:outline-none focus:border-green-500" />
          </div>
        </div>
      </div>

      <button onClick={() => setSearched(true)}
        className="w-full btn-primary py-3 flex items-center justify-center gap-2">
        <Search className="w-4 h-4" /> Find Farmers
      </button>

      {searched && (
        <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} className="mt-4 space-y-3">
          <p className="text-green-600 text-xs font-semibold">✅ {mockResults.length} farmers found matching your criteria</p>
          {mockResults.map((r, i) => (
            <div key={i}
              className="bg-green-50 border border-green-100 rounded-2xl p-4 hover:bg-green-100/60
                         transition-colors cursor-pointer group">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 text-sm">{r.name}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      r.badge === 'TOP SELLER' ? 'bg-amber-100 text-amber-700' :
                      r.badge === 'TRUSTED'    ? 'bg-green-100 text-green-700'  :
                                                  'bg-sky-100 text-sky-700'
                    }`}>{r.badge}</span>
                  </div>
                  <p className="text-gray-400 text-xs mt-0.5">{r.qty} · {r.dist} away</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-700 text-sm">{r.price}</p>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className="text-gray-500 text-xs">{r.rating} ({r.history} txns)</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                {r.verified
                  ? <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />VERIFIED SELLER</span>
                  : <span className="text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />SELF-REPORTED</span>}
                <button className="text-green-600 group-hover:text-green-800 flex items-center gap-1 font-semibold">
                  View Profile <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          ))}
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
      initial={{ opacity:0, y:28 }} animate={inView ? { opacity:1, y:0 } : {}}
      transition={{ duration:0.5, delay }}
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

/* ── Step card ── */
function BuyerStepCard({ step, title, icon: Icon, desc, index }) {
  const { ref, inView } = useInView({ triggerOnce: true })
  return (
    <motion.div ref={ref}
      initial={{ opacity:0, x: index % 2 === 0 ? -24 : 24 }}
      animate={inView ? { opacity:1, x:0 } : {}}
      transition={{ duration:0.5, delay: index * 0.08 }}
      className="flex gap-5 items-start bg-white border border-green-100 rounded-3xl p-6
                 card-hover shadow-sm hover:shadow-md hover:border-green-200">
      <div className="w-12 h-12 rounded-2xl bg-green-600 flex items-center justify-center
                      shrink-0 shadow-md text-white font-display font-bold text-lg">
        {step}
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
function BuyerTestimonialCard({ name, role, text, rating, delay }) {
  const { ref, inView } = useInView({ triggerOnce: true })
  return (
    <motion.div ref={ref}
      initial={{ opacity:0, scale:0.92 }} animate={inView ? { opacity:1, scale:1 } : {}}
      transition={{ duration:0.5, delay }}
      className="bg-white border border-green-100 rounded-3xl p-7 card-hover shadow-sm
                 hover:shadow-lg hover:border-green-200 flex flex-col gap-4">
      <div className="flex gap-1">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
        ))}
      </div>
      <p className="text-gray-600 text-sm leading-relaxed italic">"{text}"</p>
      <div className="flex items-center gap-3 mt-auto">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-green-600
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

/* ── Pricing card ── */
function PricingCard({ plan, delay }) {
  const { ref, inView } = useInView({ triggerOnce: true })
  return (
    <motion.div ref={ref}
      initial={{ opacity:0, y:28 }} animate={inView ? { opacity:1, y:0 } : {}}
      transition={{ duration:0.5, delay }}
      className={`rounded-3xl p-7 flex flex-col card-hover ${
        plan.highlight
          ? 'bg-green-700 text-white shadow-xl ring-2 ring-green-500 relative overflow-hidden'
          : 'bg-white border border-green-100 shadow-sm hover:shadow-lg hover:border-green-200'
      }`}>
      {plan.highlight && (
        <div className="absolute top-4 right-4 bg-white/20 text-white text-[10px]
                        font-bold px-3 py-1 rounded-full uppercase tracking-wider">
          Most Popular
        </div>
      )}
      <div className="mb-6">
        <h3 className={`font-display font-bold text-xl mb-1 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
        <div className="flex items-end gap-1 mb-2">
          <span className={`font-display font-black text-4xl ${plan.highlight ? 'text-white' : 'text-gradient'}`}>{plan.price}</span>
          <span className={`text-sm pb-1 ${plan.highlight ? 'text-green-200' : 'text-gray-400'}`}>{plan.period}</span>
        </div>
        <p className={`text-xs ${plan.highlight ? 'text-green-200' : 'text-gray-500'}`}>{plan.desc}</p>
      </div>
      <ul className="space-y-2.5 mb-8 flex-1">
        {plan.features.map(f => (
          <li key={f} className={`flex items-start gap-2 text-sm ${plan.highlight ? 'text-green-100' : 'text-gray-600'}`}>
            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-green-300' : 'text-green-500'}`} />
            {f}
          </li>
        ))}
      </ul>
      <button className={plan.highlight
        ? 'w-full py-3 rounded-full bg-white text-green-700 font-semibold hover:bg-green-50 transition-colors'
        : 'btn-outline py-3 w-full text-center'
      }>{plan.cta}</button>
    </motion.div>
  )
}

/* ── Data ── */
const buyerBenefits = [
  { icon: TrendingDown, title: 'Direct Farm Pricing',    stat: '-25%',  delay:0,    accent:'bg-green-600',   desc:'Skip the middleman. Buy directly from farmers at prices 20–30% lower than wholesale.' },
  { icon: ShieldCheck,  title: 'Verified Farmers',       stat: '100%',  delay:0.08, accent:'bg-emerald-600', desc:'Every seller is KYC-verified. View full transaction history before buying.' },
  { icon: Package,      title: 'Guaranteed Quantity',    stat: '99.2%', delay:0.16, accent:'bg-teal-600',    desc:'Farmer listings include real-time stock. 99.2% quantity fulfilment on confirmed orders.' },
  { icon: Clock,        title: 'Source in 24 Hours',     stat: '24h',   delay:0.24, accent:'bg-sky-500',     desc:'Post requirement → matched farmer profiles within 2 hours → deal in under 24 hours.' },
  { icon: MapPin,       title: 'Hyperlocal Sourcing',    stat: '<80km', delay:0.32, accent:'bg-lime-600',    desc:'Reduce logistics cost by sourcing from farmers within your preferred delivery radius.' },
  { icon: BarChart3,    title: 'Real-time Inventory',    stat: '3,200+',delay:0.40, accent:'bg-green-700',   desc:'Live inventory from 3,200+ markets — know exactly what\'s available before you commit.' },
]

const buyerProcess = [
  { step:'01', title:'Post Your Requirement', icon:Package,    desc:'Specify crop, quantity, quality grade, and your location. System instantly matches available farmers.' },
  { step:'02', title:'Browse Farmer Profiles',icon:Users,      desc:'View matched profiles with transaction history, ratings, crop details, and verification status.' },
  { step:'03', title:'Compare & Select',      icon:BarChart3,  desc:'Compare prices, quantity, distance, and ratings side-by-side to select the best supplier.' },
  { step:'04', title:'Negotiate & Confirm',   icon:Phone,      desc:'Connect directly with the farmer to finalise pricing, delivery timeline, and quality grade.' },
  { step:'05', title:'Track & Verify',        icon:ShieldCheck,desc:'Monitor transaction status in real-time. Receive a verified record upon completion.' },
]

const testimonials = [
  { name:'Anjali Exports',    role:'Onion Exporter, Pune',       rating:5, delay:0,    text:'We source 500 tonnes of onion monthly. AgriBridge cut our procurement time from 2 weeks to 3 days. Farmer verification gives us complete confidence.' },
  { name:'FreshMart Retail',  role:'Supermarket Chain, Delhi',   rating:5, delay:0.1,  text:'Direct farm-to-shelf sourcing saved us 22% on procurement costs. We get fresher produce and pass savings to customers. Win-win.' },
  { name:'Bharat Agro Trading',role:'Commodity Trader, Mumbai',  rating:5, delay:0.2,  text:'The real-time market intelligence alone is worth it. I can spot arbitrage opportunities across mandis before anyone else.' },
]

const pricingPlans = [
  { name:'Free',       price:'₹0',      period:'forever', highlight:false, desc:'For individual buyers getting started',          cta:'Get Started',    features:['5 farmer searches/month','Basic crop price data','Email support','1 active requirement post'] },
  { name:'Pro',        price:'₹1,999',  period:'/month',  highlight:true,  desc:'For growing businesses with regular procurement', cta:'Start Pro Trial', features:['Unlimited searches','Real-time price feed','Priority matching','Buyer verification badge','10 active requirements','AI sourcing advisor','Phone support'] },
  { name:'Enterprise', price:'Custom',  period:'',        highlight:false, desc:'For large buyers, exporters, and FPOs',          cta:'Contact Sales',  features:['Everything in Pro','Dedicated account manager','Custom API integrations','Volume-based pricing','Contract management','Analytics dashboard','24/7 priority support'] },
]

const inventoryItems = [
  { crop:'🧅 Onion',  farmer:'Ramesh Patil',    location:'Nashik, MH',    qty:'1,200 qtl', price:'₹1,260/qtl', dist:'32 km', verified:true,  fresh:true  },
  { crop:'🌾 Wheat',  farmer:'Gurpreet Singh',  location:'Ludhiana, PB',  qty:'800 qtl',   price:'₹2,160/qtl', dist:'45 km', verified:true,  fresh:false },
  { crop:'🍅 Tomato', farmer:'Ananda Rao',      location:'Kurnool, AP',   qty:'300 qtl',   price:'₹870/qtl',   dist:'28 km', verified:true,  fresh:true  },
  { crop:'🥔 Potato', farmer:'Suresh Kumar',    location:'Agra, UP',      qty:'2,000 qtl', price:'₹700/qtl',   dist:'60 km', verified:false, fresh:false },
  { crop:'🌽 Maize',  farmer:'Basavaraj Goud',  location:'Bidar, KA',     qty:'650 qtl',   price:'₹1,650/qtl', dist:'55 km', verified:true,  fresh:false },
  { crop:'🫘 Soybean',farmer:'Meena Devi',      location:'Sehore, MP',    qty:'400 qtl',   price:'₹4,180/qtl', dist:'80 km', verified:true,  fresh:true  },
]

export default function Buyer() {
  return (
    <main className="bg-white overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative min-h-screen pt-20 flex items-center overflow-hidden hero-bg">
        <FloatingParticles count={28} />
        <div className="absolute inset-0 sun-rays opacity-30 pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center py-20">
          {/* Left */}
          <div>
            <motion.div initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                         bg-white/80 border border-green-200 shadow-sm
                         text-xs text-green-700 font-semibold mb-6 uppercase tracking-wider">
              <ShoppingCart className="w-4 h-4" /> Buyer Portal — Source Smarter
            </motion.div>

            <motion.h1 initial={{ opacity:0, y:28 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.8, delay:0.15 }}
              className="font-display font-black text-5xl md:text-6xl leading-[0.95] mb-6">
              <span className="text-gray-900">Source Fresh.</span><br />
              <span className="text-gradient">Buy Direct.</span><br />
              <span className="text-gray-900">Pay Less.</span>
            </motion.h1>

            <motion.p initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.7, delay:0.3 }}
              className="text-gray-600 text-lg mb-8 leading-relaxed max-w-lg">
              Connect directly with verified farmers across India. Browse real-time crop
              availability, negotiate fair prices, and complete procurement in under 24 hours
              — no middlemen, no surprises.
            </motion.p>

            <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.6, delay:0.45 }} className="space-y-2.5 mb-8">
              {[
                'Search 142,000+ verified farmers by crop & location',
                'View complete seller history, ratings & verification status',
                'Real-time inventory with quantity & quality grade data',
                'Secure transaction tracking from agreement to delivery',
              ].map(item => (
                <div key={item} className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  {item}
                </div>
              ))}
            </motion.div>

            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
              transition={{ duration:0.6, delay:0.6 }} className="flex flex-wrap gap-4">
              <a href="#search" className="flex items-center gap-2 px-8 py-4 rounded-full
                                           font-semibold bg-green-700 text-white shadow-md
                                           hover:bg-green-600 hover:-translate-y-0.5 transition-all group">
                🛒 Find Farmers Now
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="#pricing" className="btn-outline flex items-center gap-2">
                💼 View Pricing
              </a>
            </motion.div>
          </div>

          {/* Right: search panel */}
          <motion.div initial={{ opacity:0, scale:0.92, x:30 }} animate={{ opacity:1, scale:1, x:0 }}
            transition={{ duration:0.8, delay:0.25 }} className="flex justify-center" id="search">
            <BuyerSearchPanel />
          </motion.div>
        </div>

        {/* Grass layers */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <div className="relative h-24 opacity-35"><GrassStrip density={55}  heightMin={28} heightMax={90} /></div>
          <div className="relative h-18 -mt-10 opacity-65"><GrassStrip density={80}  heightMin={22} heightMax={70} /></div>
          <div className="relative h-14 -mt-7"><GrassStrip density={110} heightMin={16} heightMax={55} /></div>
        </div>
      </section>

      {/* ── M5 PROCUREMENT PRICE COMPARISON MATRIX ── */}
      <section id="compare-prices" className="py-20 bg-white relative overflow-hidden">
        <FloatingParticles count={10} />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-green-100 text-green-800">
              SIH M5 Procurement Engine
            </span>
            <h2 className="section-title text-gradient mt-2">Mandi vs Direct Farm Sourcing</h2>
            <p className="section-subtitle">
              Calculate landed procurement cost factoring in APMC mandi taxes, handling fees, and direct farmgate freight.
            </p>
          </div>

          <PriceComparisonMatrix />
        </div>
      </section>

      {/* ── LIVE INVENTORY ── */}
      <section className="py-24 bg-green-50 relative overflow-hidden">
        <FloatingParticles count={12} />
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-green-600 text-center text-xs font-semibold uppercase tracking-widest mb-3">Live Inventory</p>
          <h2 className="section-title text-gradient">Available Right Now</h2>
          <p className="section-subtitle">Fresh crop listings from farmers across India — updated in real-time.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {inventoryItems.map((item, i) => (
              <motion.div key={i}
                initial={{ opacity:0, scale:0.92 }} whileInView={{ opacity:1, scale:1 }}
                viewport={{ once:true }} transition={{ duration:0.4, delay:i*0.07 }}
                className="bg-white border border-green-100 rounded-2xl p-5 card-hover card-shine
                           group cursor-pointer shadow-sm hover:shadow-md hover:border-green-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-display font-bold text-gray-900">{item.crop}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{item.farmer} · {item.location}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {item.fresh && <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">🆕 FRESH</span>}
                    {item.verified
                      ? <span className="text-[9px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full">✓ VERIFIED</span>
                      : <span className="text-[9px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">SELF-REPORTED</span>
                    }
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  <div><p className="text-gray-400">Quantity</p><p className="font-semibold text-gray-800">{item.qty}</p></div>
                  <div><p className="text-gray-400">Price</p><p className="font-bold text-green-700">{item.price}</p></div>
                  <div><p className="text-gray-400">Distance</p><p className="font-semibold text-gray-800">{item.dist}</p></div>
                </div>
                <button className="w-full text-xs font-semibold py-2 rounded-xl bg-green-50 border border-green-200
                                   text-green-700 hover:bg-green-100 transition-colors group-hover:border-green-300">
                  Contact Farmer →
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="py-24 bg-white relative overflow-hidden">
        <FloatingParticles count={14} />
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-green-600 text-center text-xs font-semibold uppercase tracking-widest mb-3">Why Buyers Choose Us</p>
          <h2 className="section-title text-gradient">The Smarter Way to Source</h2>
          <p className="section-subtitle">Built for bulk buyers, exporters, FPOs, retailers, and commodity traders.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {buyerBenefits.map(b => <BenefitCard key={b.title} {...b} />)}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 bg-green-50 relative overflow-hidden">
        <FloatingParticles count={12} />
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-green-600 text-center text-xs font-semibold uppercase tracking-widest mb-3">Buyer Journey</p>
          <h2 className="section-title text-gradient">From Search to Delivery</h2>
          <p className="section-subtitle">Five simple steps to complete farm-direct procurement.</p>
          <div className="space-y-5">
            {buyerProcess.map((s, i) => <BuyerStepCard key={s.step} {...s} index={i} />)}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 bg-white relative overflow-hidden">
        <FloatingParticles count={14} />
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-green-600 text-center text-xs font-semibold uppercase tracking-widest mb-3">Buyer Stories</p>
          <h2 className="section-title text-gradient">Trusted by Industry Leaders</h2>
          <p className="section-subtitle">From small traders to national exporters — buyers across India rely on AgriBridge.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map(t => <BuyerTestimonialCard key={t.name} {...t} />)}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 bg-green-50 relative overflow-hidden">
        <FloatingParticles count={14} />
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-green-600 text-center text-xs font-semibold uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="section-title text-gradient">Simple, Transparent Plans</h2>
          <p className="section-subtitle">No hidden charges. No long-term contracts. Cancel anytime.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricingPlans.map((plan, i) => <PricingCard key={plan.name} plan={plan} delay={i * 0.1} />)}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-white relative overflow-hidden">
        <FloatingParticles count={16} />
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity:0, y:24 }} whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true }} transition={{ duration:0.6 }}
            className="bg-green-50 border border-green-200 rounded-3xl p-12 shadow-sm">
            <div className="text-6xl mb-4 animate-bounce-slow">🛒</div>
            <h2 className="font-display font-black text-3xl md:text-4xl mb-4 text-gray-900">
              <span className="text-gradient">Start Sourcing Today</span>
            </h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              Register free. Post your first requirement. Get matched with verified farmers in under 2 hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="#search"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-full
                           font-semibold bg-green-700 text-white shadow-md
                           hover:bg-green-600 hover:-translate-y-0.5 transition-all group">
                🛒 Register as Buyer
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <Link to="/seller"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-full
                           font-semibold border-2 border-green-600 text-green-700
                           hover:bg-green-600 hover:text-white hover:-translate-y-0.5 transition-all">
                🌾 Are You a Farmer?
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
