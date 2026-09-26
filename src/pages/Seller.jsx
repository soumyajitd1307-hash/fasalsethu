import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import {
  Sprout, TrendingUp, MapPin, ShieldCheck, BarChart3, Wheat,
  ArrowRight, CheckCircle2, ChevronRight, Star,
  DollarSign, Clock, Zap, Users, Package, Leaf,
  Search, X, Navigation, RefreshCw, Check,
  Building2, Phone, Mail, AlertCircle
} from 'lucide-react'
import GrassStrip from '../components/GrassStrip'
import FloatingParticles from '../components/FloatingParticles'
import FarmerDashboard from '../components/FarmerDashboard'
import BuyerMatchMap from '../components/BuyerMatchMap'
import { resolveLocationCoords, POPULAR_CROPS_LIST } from '../utils/geoLookup'
import { searchBuyersByLocation } from '../services/buyerDatabase'

/* ── Interactive crop listing form with Manual Crop Search & Live Map Redirect ── */
function CropListingForm({ onGetBuyerMatches, isSearching = false }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    crop: '',
    cropDetails: null,
    qty: '',
    unit: 'quintal',
    location: '',
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [gpsLocating, setGpsLocating] = useState(false)
  const [resolvedPreview, setResolvedPreview] = useState(null)

  // Filter crops based on search query
  const filteredCrops = POPULAR_CROPS_LIST.filter(c => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.short.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    )
  })

  // Live location geocode preview when location changes
  useEffect(() => {
    if (form.location.trim().length >= 3) {
      resolveLocationCoords(form.location).then(res => {
        setResolvedPreview(res)
      })
    } else {
      setResolvedPreview(null)
    }
  }, [form.location])

  const handleSelectCrop = (cropItem) => {
    setForm(f => ({
      ...f,
      crop: cropItem.name,
      cropDetails: cropItem,
      unit: cropItem.defaultUnit || f.unit
    }))
    setSearchQuery(cropItem.name)
    setIsDropdownOpen(false)
  }

  const handleSelectCustomCrop = (customName) => {
    setForm(f => ({
      ...f,
      crop: customName,
      cropDetails: null
    }))
    setIsDropdownOpen(false)
  }

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }
    setGpsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocating(false)
        const lat = +pos.coords.latitude.toFixed(3)
        const lng = +pos.coords.longitude.toFixed(3)
        const locStr = `Current GPS (${lat}° N, ${lng}° E)`
        setForm(f => ({
          ...f,
          location: locStr
        }))
        setResolvedPreview({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          name: locStr
        })
      },
      () => {
        setGpsLocating(false)
        setForm(f => ({ ...f, location: 'Dindori, Nashik' }))
      },
      { timeout: 8000 }
    )
  }

  const handleSubmit = (e) => {
    if (e) e.preventDefault()
    if (!form.crop || !form.qty || !form.location) return
    if (onGetBuyerMatches) {
      onGetBuyerMatches(form)
    }
  }

  return (
    <div className="bg-white border border-green-100 rounded-3xl p-6 sm:p-7 shadow-xl max-w-md w-full relative">
      {/* Progress Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { num: 1, label: 'Crop' },
          { num: 2, label: 'Quantity' },
          { num: 3, label: 'Location' },
        ].map(s => (
          <React.Fragment key={s.num}>
            <button
              type="button"
              onClick={() => {
                if (s.num === 1) setStep(1)
                if (s.num === 2 && form.crop) setStep(2)
                if (s.num === 3 && form.crop && form.qty) setStep(3)
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
                step === s.num
                  ? 'bg-green-600 text-white shadow-md ring-2 ring-green-400/40'
                  : step > s.num
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              <span>{s.num}.</span>
              <span>{s.label}</span>
            </button>
            {s.num < 3 && (
              <div
                className={`flex-1 h-0.5 transition-all duration-500 ${
                  step > s.num ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── STEP 1: MANUAL CROP SEARCH ── */}
      {step === 1 && (
        <motion.div key="s1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display font-bold text-gray-900 text-lg">
              1. Search Your Crop
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
              Manual Search
            </span>
          </div>
          <p className="text-gray-500 text-xs mb-4">
            Type or search any crop name you want to sell.
          </p>

          {/* Search Input Container */}
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
            <input
              type="text"
              placeholder="Search crop (e.g. Wheat, Onion, Soybean, Cotton...)"
              value={searchQuery || form.crop}
              onChange={e => {
                setSearchQuery(e.target.value)
                setForm(f => ({ ...f, crop: e.target.value }))
                setIsDropdownOpen(true)
              }}
              onFocus={() => setIsDropdownOpen(true)}
              className="w-full pl-10 pr-9 py-3 rounded-2xl bg-green-50/70 border border-green-200 text-gray-900 text-sm font-medium focus:outline-none focus:border-green-600 focus:bg-white focus:ring-2 focus:ring-green-500/20 transition-all shadow-inner"
            />
            {(searchQuery || form.crop) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setForm(f => ({ ...f, crop: '', cropDetails: null }))
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Dropdown Suggestions */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-green-200 rounded-2xl shadow-xl z-50 max-h-56 overflow-y-auto no-scrollbar py-1">
                {filteredCrops.length > 0 ? (
                  filteredCrops.slice(0, 8).map(item => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => handleSelectCrop(item)}
                      className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-green-50 flex items-center justify-between transition-colors border-b border-gray-50 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{item.icon}</span>
                        <div>
                          <p className="font-bold text-gray-800">{item.name}</p>
                          <span className="text-[10px] text-gray-400">{item.category}</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded-md">
                        ₹{item.basePrice}/qtl
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center">
                    <p className="text-gray-500 text-xs mb-2">No matching crop in list</p>
                    <button
                      type="button"
                      onClick={() => handleSelectCustomCrop(searchQuery)}
                      className="text-xs font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-xl hover:bg-green-100 transition-colors"
                    >
                      ➕ Use custom: "{searchQuery}"
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Crop Badge */}
          {form.crop && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                  ✓
                </span>
                <div>
                  <span className="text-[10px] text-emerald-800 uppercase font-bold tracking-wider block">
                    Selected Crop
                  </span>
                  <span className="font-display font-bold text-emerald-950 text-sm">
                    {form.crop}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setForm(f => ({ ...f, crop: '', cropDetails: null }))
                  setIsDropdownOpen(true)
                }}
                className="text-xs text-emerald-700 hover:underline font-semibold"
              >
                Change
              </button>
            </div>
          )}

          {/* Quick Popular Crop Pills */}
          <div className="mb-5">
            <span className="text-[11px] text-gray-400 font-medium block mb-2">
              Popular searches:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { name: 'Wheat (Sharbati)', label: '🌾 Wheat' },
                { name: 'Onion (Nashik Red)', label: '🧅 Onion' },
                { name: 'Tomato (Hybrid)', label: '🍅 Tomato' },
                { name: 'Soybean (Yellow)', label: '🌱 Soybean' },
                { name: 'Cotton (BT / Medium Staple)', label: '☁️ Cotton' },
                { name: 'Maize (Yellow Corn)', label: '🌽 Maize' },
              ].map(c => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    const match = POPULAR_CROPS_LIST.find(p => p.name === c.name)
                    if (match) handleSelectCrop(match)
                    else {
                      setForm(f => ({ ...f, crop: c.name }))
                      setSearchQuery(c.name)
                    }
                  }}
                  className={`text-xs px-2.5 py-1 rounded-xl transition-all ${
                    form.crop === c.name
                      ? 'bg-green-700 text-white shadow-sm font-semibold'
                      : 'bg-gray-100 hover:bg-green-100 text-gray-700'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => form.crop && setStep(2)}
            disabled={!form.crop}
            className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
          >
            <span>Next: Enter Quantity</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* ── STEP 2: QUANTITY ── */}
      {step === 2 && (
        <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display font-bold text-gray-900 text-lg">
              2. Quantity to Sell
            </h3>
            <span className="text-xs font-bold text-green-700 truncate max-w-[150px]">
              {form.crop}
            </span>
          </div>
          <p className="text-gray-500 text-xs mb-4">
            Specify how much quantity you have ready for dispatch.
          </p>

          <div className="space-y-4 mb-5">
            <div>
              <label className="text-gray-600 text-xs mb-1.5 block font-semibold">
                Available Harvest Quantity
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={form.qty}
                  onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                  className="flex-1 px-4 py-3 rounded-2xl bg-green-50/70 border border-green-200 text-gray-900 text-base font-bold focus:outline-none focus:border-green-600 focus:bg-white"
                  autoFocus
                />
                <select
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="px-3.5 py-3 rounded-2xl bg-green-50/70 border border-green-200 text-gray-800 text-sm font-semibold focus:outline-none"
                >
                  <option value="quintal">Quintal (qtl)</option>
                  <option value="tonne">Tonne (MT)</option>
                  <option value="kg">Kilogram (kg)</option>
                </select>
              </div>
            </div>

            {/* Quick Quantity Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400 font-medium">Quick add:</span>
              {[50, 100, 250, 500, 1000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, qty: String(val) }))}
                  className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-green-100 text-gray-700 font-medium transition-colors"
                >
                  {val}
                </button>
              ))}
            </div>

            {/* Live estimated valuation preview */}
            {form.qty && Number(form.qty) > 0 && (
              <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/70 text-xs">
                <div className="flex items-center justify-between text-emerald-900">
                  <span>Estimated Market Value:</span>
                  <strong className="text-sm font-bold text-emerald-700">
                    ~₹{(
                      Number(form.qty) * (form.cropDetails?.basePrice || 2200)
                    ).toLocaleString('en-IN')}
                  </strong>
                </div>
                <p className="text-[10px] text-emerald-600 mt-0.5">
                  Calculated using benchmark mandi rate (₹{form.cropDetails?.basePrice || 2200}/{form.unit})
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 btn-outline py-3 text-sm font-semibold"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => form.qty && setStep(3)}
              disabled={!form.qty || Number(form.qty) <= 0}
              className="flex-1 btn-primary py-3 text-sm font-bold disabled:opacity-40"
            >
              Next: Location →
            </button>
          </div>
        </motion.div>
      )}

      {/* ── STEP 3: MANUAL LOCATION & GET BUYER MATCHES ── */}
      {step === 3 && (
        <motion.div key="s3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display font-bold text-gray-900 text-lg">
              3. Farm Location Manually
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Live Google Map Link
            </span>
          </div>
          <p className="text-gray-500 text-xs mb-4">
            Enter your village, district, or mandi to center the live map.
          </p>

          {/* Form Summary Badge */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 mb-3 text-xs flex justify-between items-center">
            <div>
              <span className="text-gray-400 block text-[10px]">CROP & QUANTITY</span>
              <strong className="text-gray-800 font-bold">{form.crop}</strong>
            </div>
            <div className="text-right">
              <span className="text-gray-400 block text-[10px]">TOTAL LOT</span>
              <strong className="text-green-700 font-bold">{form.qty} {form.unit}</strong>
            </div>
          </div>

          {/* Location Input */}
          <div className="space-y-3 mb-4">
            <div>
              <label className="text-gray-600 text-xs mb-1.5 block font-semibold flex items-center justify-between">
                <span>Enter Farm Location</span>
                <button
                  type="button"
                  onClick={handleDetectGPS}
                  disabled={gpsLocating}
                  className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1"
                >
                  <Navigation className={`w-3 h-3 ${gpsLocating ? 'animate-spin' : ''}`} />
                  {gpsLocating ? 'Detecting...' : '📍 Use My GPS'}
                </button>
              </label>

              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                <input
                  type="text"
                  placeholder="e.g. Pune, Nashik, Dindori, Indore, Malegaon, Delhi..."
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-green-50/70 border border-green-200 text-gray-900 text-sm font-medium focus:outline-none focus:border-green-600 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                  autoFocus
                />
              </div>
            </div>

            {/* Resolved Geocoding Status Preview */}
            {resolvedPreview && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px] flex items-center justify-between text-emerald-900">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="truncate font-medium">
                    Map Target: <strong>{resolvedPreview.name}</strong>
                  </span>
                </div>
                <span className="font-mono text-[10px] text-emerald-700 shrink-0 ml-2">
                  {resolvedPreview.lat.toFixed(2)}°, {resolvedPreview.lng.toFixed(2)}°
                </span>
              </div>
            )}

            {/* Quick Location Pills */}
            <div>
              <span className="text-[10px] text-gray-400 font-semibold block mb-1.5 uppercase">
                Popular Hubs:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {['Dindori', 'Nashik', 'Pune', 'Indore', 'Delhi', 'Nagpur'].map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, location: loc }))}
                    className={`text-xs px-2.5 py-1 rounded-xl transition-all ${
                      form.location.toLowerCase().includes(loc.toLowerCase())
                        ? 'bg-green-700 text-white font-bold shadow-xs'
                        : 'bg-gray-100 hover:bg-green-100 text-gray-700'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 btn-outline py-3 text-sm font-semibold"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!form.location || isSearching}
              className="flex-1 btn-primary py-3 text-sm font-bold shadow-lg hover:shadow-xl disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Centering Map...</span>
                </>
              ) : (
                <>
                  <span>🚀 Get Buyer Matches</span>
                </>
              )}
            </button>
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

/* ── Buyer Location Matching Section ────────────────────────────────────────
   Allows farmers to search for registered buyers by location.
   Reads from the localStorage buyer database, applies Haversine radius search,
   and renders results as cards + an interactive Google Map with markers.
─────────────────────────────────────────────────────────────────────────── */
function BuyerLocationMatchSection() {
  const [location, setLocation] = useState('')
  const [radiusKm, setRadiusKm] = useState(100)
  const [isSearching, setIsSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [results, setResults] = useState([])
  const [mapCenter, setMapCenter] = useState(null)
  const [error, setError] = useState('')

  const handleSearch = async (e) => {
    if (e) e.preventDefault()
    if (!location.trim()) {
      setError('Please enter a location to search.')
      return
    }
    setError('')
    setIsSearching(true)
    setSearched(false)
    try {
      const { buyers, center } = await searchBuyersByLocation(location.trim(), Number(radiusKm))
      setResults(buyers)
      setMapCenter(center)
      setSearched(true)

      // Scroll to results
      setTimeout(() => {
        document.getElementById('buyer-match-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)
    } catch (err) {
      console.error('Buyer search error:', err)
      setError('Search failed. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  const radiusOptions = [
    { label: '5 km', value: 5 },
    { label: '10 km', value: 10 },
    { label: '25 km', value: 25 },
    { label: '50 km', value: 50 },
    { label: '100 km', value: 100 },
    { label: '200 km', value: 200 },
    { label: 'Any', value: 5000 },
  ]

  return (
    <section id="buyer-search" className="py-24 bg-white relative overflow-hidden">
      <FloatingParticles count={14} />
      <div className="max-w-6xl mx-auto px-6 relative z-10">

        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full
                           bg-amber-100 text-amber-800">
            Buyer Location Matching
          </span>
          <h2 className="section-title text-gradient mt-3">Find Registered Buyers Near You</h2>
          <p className="section-subtitle">
            Search our database of verified buyers by location. Buyers who have registered their
            business address appear on the map — click a marker to view their details.
          </p>
        </div>

        {/* Search form card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="bg-white border border-green-100 rounded-3xl p-6 sm:p-8 shadow-xl max-w-2xl mx-auto mb-10"
        >
          <div className="flex items-center gap-2 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-green-600 flex items-center justify-center shadow-md">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-display font-bold text-gray-900 text-base">Search Buyer Location</h3>
              <p className="text-gray-400 text-xs">Enter your location to find buyers registered nearby</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            {/* Location input */}
            <div>
              <label className="text-gray-600 text-xs mb-1.5 block font-semibold">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                <input
                  type="text"
                  placeholder="e.g. Pune, Nashik, Delhi, Indore…"
                  value={location}
                  onChange={(e) => { setLocation(e.target.value); setError('') }}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-green-50/70 border border-green-200
                             text-gray-900 text-sm font-medium focus:outline-none focus:border-green-600
                             focus:bg-white focus:ring-2 focus:ring-green-500/20 transition-all"
                />
              </div>
              {error && (
                <p className="text-red-500 text-xs flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" /> {error}
                </p>
              )}
            </div>

            {/* Radius */}
            <div>
              <label className="text-gray-600 text-xs mb-1.5 block font-semibold">
                Search Radius
              </label>
              <div className="flex flex-wrap gap-2">
                {radiusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRadiusKm(opt.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      radiusKm === opt.value
                        ? 'bg-green-700 text-white shadow-sm'
                        : 'bg-gray-100 hover:bg-green-100 text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Popular locations */}
            <div>
              <span className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase">
                Popular hubs:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {['Pune', 'Nashik', 'Indore', 'Delhi', 'Nagpur', 'Dindori'].map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocation(loc)}
                    className={`text-xs px-2.5 py-1 rounded-xl transition-all ${
                      location.toLowerCase() === loc.toLowerCase()
                        ? 'bg-green-700 text-white font-bold'
                        : 'bg-gray-100 hover:bg-green-100 text-gray-700'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="w-full btn-primary py-3.5 flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:cursor-not-allowed shadow-md font-bold"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Searching Buyers…</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Search Buyers</span>
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {searched && (
            <motion.div
              id="buyer-match-results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Result count badge */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  {results.length > 0 ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                      <p className="text-green-700 font-bold text-sm">
                        {results.length} registered buyer{results.length !== 1 ? 's' : ''} found within{' '}
                        {radiusKm >= 5000 ? 'any distance' : `${radiusKm} km`} of{' '}
                        <span className="text-gray-900">{mapCenter?.name || location}</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      <p className="text-amber-700 font-semibold text-sm">
                        No buyers found within {radiusKm >= 5000 ? 'any distance' : `${radiusKm} km`} of{' '}
                        <span className="text-gray-900">{location}</span>.
                        Try increasing the search radius or a different location.
                      </p>
                    </>
                  )}
                </div>
                <button
                  onClick={() => { setSearched(false); setResults([]); setMapCenter(null) }}
                  className="text-xs text-gray-400 hover:text-gray-600 font-medium flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              </div>

              {results.length > 0 && (
                <div className="grid grid-cols-1 gap-10">
                  {/* Buyer cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.map((buyer, i) => (
                      <motion.div
                        key={buyer.buyerId}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: i * 0.06 }}
                        className="bg-white border border-green-100 rounded-2xl p-5 shadow-sm
                                   hover:shadow-md hover:border-green-300 transition-all group"
                      >
                        {/* Card header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-600 to-emerald-500
                                          flex items-center justify-center text-white shadow-sm shrink-0">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full
                                           bg-amber-100 text-amber-700">
                            📍 {buyer.distanceKm} km away
                          </span>
                        </div>

                        <h4 className="font-display font-bold text-gray-900 text-sm leading-tight mb-0.5">
                          {buyer.companyName || buyer.name}
                        </h4>
                        <p className="text-gray-500 text-xs mb-3">{buyer.name}</p>

                        <div className="space-y-2 mb-3">
                          {/* Crops */}
                          <div className="flex items-start gap-1.5">
                            <Wheat className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-[10px] text-gray-400 uppercase font-bold block">Crops Needed</span>
                              <span className="text-gray-700 text-xs font-semibold">
                                {buyer.cropsRequired?.join(', ') || '—'}
                              </span>
                            </div>
                          </div>
                          {/* Quantity */}
                          <div className="flex items-start gap-1.5">
                            <Package className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-[10px] text-gray-400 uppercase font-bold block">Quantity</span>
                              <span className="text-gray-700 text-xs font-semibold">
                                {buyer.requiredQuantity} {buyer.unit}
                              </span>
                            </div>
                          </div>
                          {/* Location */}
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-[10px] text-gray-400 uppercase font-bold block">Location</span>
                              <span className="text-gray-700 text-xs font-semibold leading-tight">
                                {buyer.location?.address}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Contact */}
                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                          {buyer.phone && (
                            <a
                              href={`tel:${buyer.phone}`}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl
                                         bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold
                                         transition-colors"
                            >
                              <Phone className="w-3 h-3" /> Call
                            </a>
                          )}
                          {buyer.email && (
                            <a
                              href={`mailto:${buyer.email}`}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl
                                         bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold
                                         transition-colors"
                            >
                              <Mail className="w-3 h-3" /> Email
                            </a>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Google Map with buyer markers */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin className="w-5 h-5 text-green-600" />
                      <h3 className="font-display font-bold text-gray-900 text-base">
                        Buyer Locations on Map
                      </h3>
                      <span className="text-xs text-gray-400">
                        — Click a marker to view buyer details
                      </span>
                    </div>
                    <BuyerMatchMap
                      buyers={results}
                      center={mapCenter}
                      radiusKm={radiusKm >= 5000 ? 500 : radiusKm}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Register CTA for buyers */}
        {!searched && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-6"
          >
            <p className="text-gray-400 text-sm">
              Are you a buyer?{' '}
              <Link
                to="/login/buyer"
                className="text-green-700 font-semibold hover:underline"
              >
                Register your business location →
              </Link>{' '}
              to appear in farmer searches.
            </p>
          </motion.div>
        )}
      </div>
    </section>
  )
}

export default function Seller() {

  const [customSearch, setCustomSearch] = useState(null)
  const [isSearching, setIsSearching] = useState(false)

  const handleGetBuyerMatches = async (formData) => {
    if (!formData.crop || !formData.qty || !formData.location) return
    setIsSearching(true)
    try {
      // Build a Google Maps search URL with the manually entered location
      const encodedLocation = encodeURIComponent(formData.location)
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`

      // Open Google Maps in a new tab immediately
      window.open(mapsUrl, '_blank', 'noopener,noreferrer')

      setIsSearching(false)
    } catch (err) {
      console.error('Error opening Google Maps:', err)
      setIsSearching(false)
    }
  }

  const handleResetSearch = () => {
    setCustomSearch(null)
  }

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
            <CropListingForm onGetBuyerMatches={handleGetBuyerMatches} isSearching={isSearching} />
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

          <FarmerDashboard customSearch={customSearch} onResetCustomSearch={handleResetSearch} />
        </div>
      </section>

      {/* ── BUYER LOCATION MATCHING ── */}
      <BuyerLocationMatchSection />

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
