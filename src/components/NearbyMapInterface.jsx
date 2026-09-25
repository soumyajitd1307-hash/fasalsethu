import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Navigation, Compass, ShieldCheck, Truck,
  DollarSign, Star, ChevronRight, Phone, CheckCircle2,
  SlidersHorizontal, RefreshCw, AlertCircle,
} from 'lucide-react'

export default function NearbyMapInterface({
  buyers = [],
  activeBuyerId = null,
  farmerLocation = 'Dindori, Nashik (20.20° N, 73.83° E)',
  onSelectBuyer,
  onConnectBuyer,
  selectedRadius = 50,
  onRadiusChange,
  isLoading = false,
  errorMessage = null,
  onRetry,
}) {
  const [internalRadius, setInternalRadius] = useState(selectedRadius)
  const [viewMode, setViewMode] = useState('MAP') // 'MAP' or 'LIST'

  const currentRadius = onRadiusChange ? selectedRadius : internalRadius

  function handleRadiusSelect(r) {
    if (onRadiusChange) {
      onRadiusChange(r)
    } else {
      setInternalRadius(r)
    }
  }

  // Filter buyers within selected radius
  const filteredBuyers = buyers.filter(b => {
    const dist = b.distance !== undefined ? b.distance : b.distanceKm
    return dist <= currentRadius
  })

  const currentActiveId = activeBuyerId || (filteredBuyers[0] && filteredBuyers[0].id)
  const activeBuyer = buyers.find(b => b.id === currentActiveId) || filteredBuyers[0] || buyers[0]

  return (
    <div className="bg-white border border-green-100 rounded-3xl shadow-sm overflow-hidden">
      {/* Header Controls */}
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center text-green-600">
              <Compass className="w-4 h-4 animate-spin-slow" />
            </div>
            <h3 className="font-display font-bold text-gray-900 text-lg">Hyperlocal Buyer Radar & Map</h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">
              M5 Live Geo-Link
            </span>
          </div>
          <p className="text-gray-500 text-xs flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-green-600" />
            Your Farm Hub: <span className="font-medium text-gray-700">{farmerLocation}</span>
          </p>
        </div>

        {/* Filter Radius & View Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Radius Selector */}
          <div className="inline-flex rounded-xl bg-gray-50 p-1 border border-gray-200 text-xs font-semibold">
            {[10, 25, 50, 100].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => handleRadiusSelect(r)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  currentRadius === r
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-black hover:bg-gray-100'
                }`}
              >
                {r} km
              </button>
            ))}
          </div>

          {/* Toggle Map / List */}
          <div className="inline-flex rounded-xl bg-gray-50 p-1 border border-gray-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('MAP')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'MAP'
                  ? 'bg-white text-green-800 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              🗺️ Map View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'LIST'
                  ? 'bg-white text-green-800 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              📋 List View
            </button>
          </div>
        </div>
      </div>

      {/* Main Body: Map or List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
        {/* Left: Interactive Canvas Map */}
        <div className="lg:col-span-7 xl:col-span-8 relative bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 p-6 flex items-center justify-center overflow-hidden min-h-[380px]">
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2">
              <div className="w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-green-300 font-mono">Scanning nearby buyers within {currentRadius} km...</p>
            </div>
          )}

          {/* Error State */}
          {errorMessage && (
            <div className="absolute inset-0 z-40 bg-black/80 flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
              <p className="text-white text-sm font-semibold">{errorMessage}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 px-4 py-1.5 rounded-full bg-green-600 text-white text-xs font-semibold hover:bg-green-500"
                >
                  Retry Scan
                </button>
              )}
            </div>
          )}

          {/* Background Grid Pattern */}
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: 'radial-gradient(rgba(74, 222, 128, 0.4) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Concentric Radius Rings */}
          <div className="relative w-[340px] h-[340px] sm:w-[420px] sm:h-[420px] flex items-center justify-center">
            {/* 100km ring */}
            <div className="absolute inset-0 rounded-full border border-green-500/20 flex items-start justify-center pt-2">
              <span className="text-[10px] text-green-400/60 font-mono tracking-widest">100 KM RADIUS</span>
            </div>
            {/* 50km ring */}
            <div className="absolute inset-12 rounded-full border border-green-500/30 flex items-start justify-center pt-2">
              <span className="text-[10px] text-green-400/80 font-mono tracking-widest">50 KM</span>
            </div>
            {/* 25km ring */}
            <div className="absolute inset-24 rounded-full border border-green-500/40 flex items-start justify-center pt-2">
              <span className="text-[9px] text-green-400 font-mono tracking-widest">25 KM</span>
            </div>
            {/* 10km ring */}
            <div className="absolute inset-36 rounded-full border border-green-400/60 flex items-start justify-center pt-1.5">
              <span className="text-[8px] text-green-300 font-mono tracking-widest">10 KM</span>
            </div>

            {/* Pulsing Radar Sweep */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-green-500/10 via-transparent to-transparent animate-spin-slow pointer-events-none" />

            {/* Central Farm Pin (You) */}
            <div className="absolute z-20 flex flex-col items-center">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-lg shadow-green-500/50">
                  <span className="text-white text-xs font-bold">🏡</span>
                </div>
                <span className="absolute -inset-1 rounded-full border-2 border-emerald-400 animate-ping opacity-60" />
              </div>
              <div className="mt-1 px-2.5 py-0.5 rounded-full bg-white/90 text-gray-900 text-[10px] font-bold shadow-md">
                My Farm
              </div>
            </div>

            {/* Buyer Pins within Range */}
            {filteredBuyers.map((b, idx) => {
              const dist = b.distance !== undefined ? b.distance : b.distanceKm
              const angle = (idx * 72 + 35) * (Math.PI / 180)
              const maxPx = 180
              const distRatio = Math.min(dist / currentRadius, 0.92)
              const rPx = distRatio * maxPx
              const posX = Math.cos(angle) * rPx
              const posY = Math.sin(angle) * rPx

              const isSelected = b.id === currentActiveId
              const providesFreePickup = b.freightStatus !== undefined ? b.freightStatus : b.transportProvided

              return (
                <motion.button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    if (onSelectBuyer) onSelectBuyer(b)
                  }}
                  whileHover={{ scale: 1.15 }}
                  className="absolute z-30 flex flex-col items-center cursor-pointer transition-all duration-200 group"
                  style={{
                    transform: `translate(${posX}px, ${posY}px)`,
                  }}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition-all ${
                      isSelected
                        ? 'bg-amber-400 text-gray-900 ring-4 ring-amber-300/50 scale-125 z-40'
                        : providesFreePickup
                        ? 'bg-green-500 text-white ring-2 ring-white/60'
                        : 'bg-sky-500 text-white ring-2 ring-white/60'
                    }`}
                  >
                    🏢
                  </div>
                  <div
                    className={`mt-1 px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap shadow-md transition-all ${
                      isSelected
                        ? 'bg-amber-400 text-gray-900 scale-105'
                        : 'bg-black/75 text-white/90 group-hover:bg-white group-hover:text-black'
                    }`}
                  >
                    {b.name.split(' ')[0]} ({dist}km)
                  </div>
                </motion.button>
              )
            })}
          </div>

          {/* Map Legend */}
          <div className="absolute bottom-3 left-4 z-20 flex flex-wrap gap-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[10px] text-gray-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> My Farm
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Free Farmgate Pickup
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Farmer Delivery
            </span>
          </div>

          {/* Active Radius Badge */}
          <div className="absolute top-3 right-4 z-20 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10 text-[11px] font-mono text-green-400">
            📍 Showing {filteredBuyers.length} buyers within {currentRadius} km
          </div>
        </div>

        {/* Right: Selected Buyer Detail Card & Route Info */}
        <div className="lg:col-span-5 xl:col-span-4 p-6 bg-white flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-gray-100">
          {activeBuyer ? (
            <div className="space-y-4">
              {/* Buyer Header */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                    {activeBuyer.type}
                  </span>
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{activeBuyer.trustScore}% Trust</span>
                  </div>
                </div>
                <h4 className="font-display font-bold text-gray-900 text-lg leading-tight">
                  {activeBuyer.name}
                </h4>
                <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  {activeBuyer.location} ·{' '}
                  <strong className="text-green-700">
                    {activeBuyer.distance !== undefined ? activeBuyer.distance : activeBuyer.distanceKm} km away
                  </strong>
                </p>
              </div>

              {/* Verification & Trust */}
              <div className="p-3 rounded-2xl bg-green-50/70 border border-green-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-green-900">{activeBuyer.verificationTier}</span>
                </div>
                <span className="text-gray-500">{activeBuyer.transactionsCompleted} deals settled</span>
              </div>

              {/* Buying Prices & Crops */}
              <div>
                <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-wider mb-2">
                  Target Crops & Quoted Rates
                </p>
                <div className="space-y-2">
                  {(activeBuyer.crops || activeBuyer.interestedCrops || []).map(c => {
                    const priceMap = activeBuyer.offeredPrices || activeBuyer.offeredPricePerQtl || {}
                    const price = priceMap[c]
                    return (
                      <div
                        key={c}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs"
                      >
                        <span className="font-semibold text-gray-800">{c}</span>
                        {price ? (
                          <span className="font-display font-bold text-green-700 text-sm">
                            ₹{price} <span className="text-gray-400 text-[10px] font-normal">/qtl</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[10px]">Quote on Request</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Logistics & Route Estimation */}
              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-amber-900">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-600" /> Logistics Status
                  </span>
                  <span>
                    {(activeBuyer.freightStatus !== undefined ? activeBuyer.freightStatus : activeBuyer.transportProvided)
                      ? 'FREE FARM PICKUP'
                      : 'Farmer Delivery'}
                  </span>
                </div>
                <p className="text-gray-600 text-[11px] leading-relaxed">
                  {(activeBuyer.freightStatus !== undefined ? activeBuyer.freightStatus : activeBuyer.transportProvided)
                    ? 'Buyer dispatches truck directly to your farm gate. Zero transport cost deducted.'
                    : `Est. Freight: ₹${Math.round(
                        (activeBuyer.distance || activeBuyer.distanceKm) * (activeBuyer.freightRatePerKmQtl || 1.2)
                      )}/qtl (based on road distance).`}
                </p>
                <p className="text-gray-500 text-[11px]">
                  <strong>Payment Terms:</strong> {activeBuyer.paymentTerms}
                </p>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => {
                  if (onConnectBuyer) onConnectBuyer(activeBuyer)
                }}
                className="w-full btn-primary py-3 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <span>🌾 Propose Deal / Send Request</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <MapPin className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm">No buyers found within {currentRadius} km.</p>
              <button
                type="button"
                onClick={() => handleRadiusSelect(100)}
                className="mt-3 text-xs text-green-700 font-semibold underline"
              >
                Expand radius to 100 km
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
