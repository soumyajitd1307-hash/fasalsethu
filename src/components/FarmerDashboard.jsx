import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sprout, Package, TrendingUp, MapPin, ShieldCheck, Users,
  Plus, Search, ArrowRight, DollarSign, Clock, RefreshCw,
  Filter, CheckCircle2, AlertCircle, Sparkles, ChevronRight,
} from 'lucide-react'
import { marketplaceService } from '../services/marketplaceService'
import { useAuth } from '../context/AuthContext'
import NearbyMapInterface from './NearbyMapInterface'
import PriceComparisonMatrix from './PriceComparisonMatrix'
import ConnectionRequestModal from './ConnectionRequestModal'
import ConnectionStatusTracker from './ConnectionStatusTracker'

export default function FarmerDashboard() {
  // The farmer identity comes from the verified session, never from a hardcoded
  // placeholder and never from a URL or query value.
  const { user } = useAuth()
  const farmerId = user && user.id

  const [data, setData] = useState(null)
  const [buyers, setBuyers] = useState([])
  const [activeTab, setActiveTab] = useState('INVENTORY') // 'INVENTORY', 'DISCOVERY', 'COMPARISON', 'DEALS'
  const [loading, setLoading] = useState(true)

  // Filter state for Buyer Discovery
  const [cropFilter, setCropFilter] = useState('ALL')
  const [maxDistFilter, setMaxDistFilter] = useState('ALL')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [sortBy, setSortBy] = useState('DISTANCE')
  const [selectedBuyerId, setSelectedBuyerId] = useState(null)
  const [buyerLoading, setBuyerLoading] = useState(false)
  const [buyerError, setBuyerError] = useState(null)

  // Modals state
  const [connectModalOpen, setConnectModalOpen] = useState(false)
  const [selectedBuyerForConnect, setSelectedBuyerForConnect] = useState(null)
  const [addCropModalOpen, setAddCropModalOpen] = useState(false)
  const [newCropForm, setNewCropForm] = useState({
    crop: 'Wheat (Sharbati)',
    variety: 'Sharbati Gold',
    category: 'Grains',
    quantity: 150,
    unit: 'Quintal',
    basePrice: 2200,
    expectedPrice: 2350,
    location: 'Dindori, Nashik',
  })

  // Load dashboard data with structured query
  function loadDashboard() {
    setLoading(true)
    setBuyerLoading(true)
    setBuyerError(null)

    const buyerQuery = {
      crop: cropFilter,
      radius: maxDistFilter,
      kycVerified: verifiedOnly,
      sortBy,
      latitude: 20.20,
      longitude: 73.83,
    }

    Promise.all([
      marketplaceService.getFarmerDashboard(farmerId),
      marketplaceService.getNearbyBuyers(buyerQuery),
    ])
      .then(([dashRes, buyersRes]) => {
        setData(dashRes)
        setBuyers(buyersRes)
        if (buyersRes && buyersRes.length > 0) {
          setSelectedBuyerId(prev => {
            const stillExists = buyersRes.some(b => b.id === prev)
            return stillExists ? prev : buyersRes[0].id
          })
        } else {
          setSelectedBuyerId(null)
        }
        setLoading(false)
        setBuyerLoading(false)
      })
      .catch(err => {
        console.error('Error loading dashboard:', err)
        setBuyerError(err.message || 'Unable to load buyer data. Try again.')
        setLoading(false)
        setBuyerLoading(false)
      })
  }

  useEffect(() => {
    loadDashboard()
  }, [cropFilter, maxDistFilter, verifiedOnly, sortBy, farmerId])

  // Handle Add Crop Listing
  async function handleAddCrop(e) {
    e.preventDefault()
    try {
      await marketplaceService.addCropListing(newCropForm)
      setAddCropModalOpen(false)
      loadDashboard()
    } catch (err) {
      console.error('Error adding crop:', err)
    }
  }

  function handleOpenConnectModal(buyer) {
    setSelectedBuyerForConnect(buyer)
    setConnectModalOpen(true)
  }

  if (loading && !data) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm font-medium">Loading Farmer Command Center...</p>
        </div>
      </div>
    )
  }

  const { farmer, stats, listings, requests } = data || {}

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 select-none">
      {/* ── Top Farmer Profile & Quick Stat Cards ── */}
      <div className="bg-white border border-green-100 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 text-white flex items-center justify-center text-2xl shadow-md font-display font-bold">
              👨‍🌾
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-gray-900 text-2xl">
                  {farmer?.name || 'Ramesh Patil'}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-700" /> {farmer?.kycStatus}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  {farmer?.village}, {farmer?.district}
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-1">
                Farm Holding: <strong>{farmer?.farmSizeAcres} Acres</strong> · Trust Rating:{' '}
                <strong className="text-green-700">{farmer?.trustScore}% ({farmer?.reviewsCount} verified reviews)</strong>
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setAddCropModalOpen(true)}
              className="btn-primary py-2.5 px-5 text-sm font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" /> List New Crop Batch
            </button>
            <button
              type="button"
              onClick={loadDashboard}
              className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-black transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 Core Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
          <div className="p-4 rounded-2xl bg-green-50/60 border border-green-100">
            <span className="text-gray-500 text-xs font-medium flex items-center gap-1.5 mb-1">
              <Package className="w-3.5 h-3.5 text-green-600" /> Active Stock Listed
            </span>
            <p className="font-display font-black text-2xl text-gray-900">
              {stats?.totalStockQuintals.toLocaleString()}{' '}
              <span className="text-xs font-normal text-gray-500">Quintals</span>
            </p>
            <p className="text-green-700 text-[11px] font-semibold mt-1">
              {stats?.activeListingsCount} batches in market
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
            <span className="text-gray-500 text-xs font-medium flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Expected Revenue
            </span>
            <p className="font-display font-black text-2xl text-emerald-800">
              ₹{(stats?.potentialRevenue / 100000).toFixed(2)}{' '}
              <span className="text-xs font-normal text-gray-500">Lakh</span>
            </p>
            <p className="text-emerald-700 text-[11px] font-semibold mt-1">
              at target prices
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100">
            <span className="text-gray-500 text-xs font-medium flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Inquiries
            </span>
            <p className="font-display font-black text-2xl text-amber-800">
              {stats?.pendingRequestsCount}{' '}
              <span className="text-xs font-normal text-gray-500">Buyer Requests</span>
            </p>
            <p className="text-amber-700 text-[11px] font-semibold mt-1">
              Requires your review
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-100">
            <span className="text-gray-500 text-xs font-medium flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-600" /> Deals in Progress
            </span>
            <p className="font-display font-black text-2xl text-sky-900">
              {stats?.activeDealsCount}{' '}
              <span className="text-xs font-normal text-gray-500">Active Deals</span>
            </p>
            <p className="text-sky-700 text-[11px] font-semibold mt-1">
              {stats?.completedTransactions} completed historically
            </p>
          </div>
        </div>
      </div>

      {/* ── Main M5 Module Navigation Tabs ── */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'INVENTORY', label: '🌾 My Crop Inventory', badge: listings?.length },
          { id: 'DISCOVERY', label: '🔍 Nearby Buyer Radar & Map', badge: buyers?.length },
          { id: 'COMPARISON', label: '📊 Net Return Price Comparison', badge: 'M5 Matrix' },
          { id: 'DEALS', label: '🤝 Active Deals & Requests', badge: requests?.length },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 px-5 text-sm font-bold rounded-t-2xl border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-green-600 text-green-800 bg-white shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content Views ── */}
      <div>
        {/* Tab 1: Crop Inventory */}
        {activeTab === 'INVENTORY' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-gray-900 text-xl">Active Crop Batches</h3>
                <p className="text-gray-500 text-xs">Batches currently visible to verified buyers across Maharashtra.</p>
              </div>
              <button
                type="button"
                onClick={() => setAddCropModalOpen(true)}
                className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add Batch
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings?.map(l => (
                <div
                  key={l.id}
                  className="p-5 rounded-3xl bg-white border border-green-100 shadow-sm hover:shadow-md hover:border-green-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                        {l.category}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          l.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {l.status === 'ACTIVE' ? 'LIVE FOR BUYERS' : 'NEGOTIATION OPEN'}
                      </span>
                    </div>

                    <h4 className="font-display font-bold text-gray-900 text-lg">{l.crop}</h4>
                    <p className="text-gray-400 text-xs mb-3">{l.variety} · {l.qualityGrade}</p>

                    <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-2xl text-xs mb-3">
                      <div>
                        <span className="text-gray-400 text-[10px] block">Quantity</span>
                        <strong className="text-gray-900 font-bold">{l.quantity} {l.unit}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 text-[10px] block">Target Rate</span>
                        <strong className="text-green-700 font-bold">₹{l.expectedPrice}/qtl</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 text-[10px] block">Moisture</span>
                        <strong className="text-gray-700 font-bold">{l.moisturePercent}%</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 text-[10px] block">Location</span>
                        <strong className="text-gray-700 font-bold truncate block">{l.location.split(',')[0]}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-medium">
                      Est. Val: <strong>₹{(l.quantity * l.expectedPrice).toLocaleString()}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('COMPARISON')}
                      className="text-xs text-green-700 font-bold hover:underline flex items-center gap-1"
                    >
                      Compare Prices →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Buyer Discovery & Radar Map */}
        {activeTab === 'DISCOVERY' && (
          <div className="space-y-6">
            {/* Filter Toolbar */}
            <div className="p-4 rounded-2xl bg-white border border-green-100 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Crop Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-gray-600">Crop:</span>
                  <select
                    value={cropFilter}
                    onChange={e => setCropFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 font-medium focus:outline-none"
                  >
                    <option value="ALL">All Crops</option>
                    <option value="Onion">Onion</option>
                    <option value="Wheat">Wheat</option>
                    <option value="Tomato">Tomato</option>
                    <option value="Soybean">Soybean</option>
                    <option value="Maize">Maize</option>
                  </select>
                </div>

                {/* Distance Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-gray-600">Max Distance:</span>
                  <select
                    value={maxDistFilter}
                    onChange={e => setMaxDistFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 font-medium focus:outline-none"
                  >
                    <option value="ALL">Any Distance</option>
                    <option value="25">Within 25 km</option>
                    <option value="50">Within 50 km</option>
                    <option value="100">Within 100 km</option>
                  </select>
                </div>

                {/* Verified Only */}
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={e => setVerifiedOnly(e.target.checked)}
                    className="accent-green-600 rounded"
                  />
                  <span>Verified KYC Only</span>
                </label>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-600">Sort By:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 font-medium focus:outline-none"
                >
                  <option value="DISTANCE">Nearest Distance</option>
                  <option value="TRUST">Highest Trust Score</option>
                  <option value="PRICE">Highest Price Offered</option>
                </select>
              </div>
            </div>

            {/* Hyperlocal Radar Map Interface */}
            <NearbyMapInterface
              buyers={buyers}
              activeBuyerId={selectedBuyerId}
              farmerLocation={`${farmer?.village || 'Dindori'}, ${farmer?.district || 'Nashik'}`}
              onSelectBuyer={b => setSelectedBuyerId(b.id)}
              onConnectBuyer={handleOpenConnectModal}
              selectedRadius={maxDistFilter === 'ALL' ? 100 : Number(maxDistFilter)}
              onRadiusChange={r => setMaxDistFilter(String(r))}
              isLoading={buyerLoading}
              errorMessage={buyerError}
              onRetry={loadDashboard}
            />

            {/* Buyer Directory Cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-display font-bold text-gray-900 text-lg">
                  Verified Buyer Directory ({buyers.length} matching)
                </h4>
                {selectedBuyerId && (
                  <span className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Radar Focused: <strong className="font-mono">{buyers.find(b => b.id === selectedBuyerId)?.name || selectedBuyerId}</strong>
                  </span>
                )}
              </div>

              {buyers.length === 0 && !buyerLoading ? (
                <div className="p-10 text-center bg-gray-50 rounded-3xl border border-gray-100">
                  <p className="text-gray-600 font-semibold text-sm">
                    No buyers found within {maxDistFilter === 'ALL' ? 'selected criteria' : `${maxDistFilter} km`}.
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Try widening your search radius or changing crop filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCropFilter('ALL')
                      setMaxDistFilter('ALL')
                      setVerifiedOnly(false)
                    }}
                    className="mt-4 px-4 py-2 rounded-xl bg-green-700 text-white text-xs font-bold hover:bg-green-800 transition-all shadow-sm"
                  >
                    Reset Discovery Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {buyers.map(b => {
                    const isSelected = b.id === selectedBuyerId
                    return (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBuyerId(b.id)}
                        className={`p-5 rounded-3xl bg-white border transition-all flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'border-emerald-500 ring-2 ring-emerald-300/60 shadow-md bg-emerald-50/20'
                            : 'border-gray-100 hover:shadow-md hover:border-green-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-800">
                              {b.type}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {isSelected && (
                                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-400 text-gray-900 shadow-xs">
                                  RADAR PIN
                                </span>
                              )}
                              <span className="text-xs font-bold text-amber-500">
                                ★ {b.trustScore}% Trust
                              </span>
                            </div>
                          </div>
                          <h4 className="font-display font-bold text-gray-900 text-base leading-tight">
                            {b.name}
                          </h4>
                          <p className="text-gray-400 text-xs mt-0.5">
                            {b.location} · <strong className="text-green-700">{b.distanceKm || b.distance} km</strong>
                          </p>

                          <div className="mt-3 p-3 rounded-2xl bg-gray-50 text-xs space-y-1">
                            <p className="text-gray-500">
                              Capacity: <strong className="text-gray-800">{b.buyingCapacity || b.capacity}</strong>
                            </p>
                            <p className="text-gray-500">
                              Logistics: <strong className="text-green-700">{b.transportProvided || b.freightStatus ? 'Free Farmgate Pickup' : 'Farmer Transport'}</strong>
                            </p>
                            <p className="text-gray-500 truncate">
                              Crops: <strong>{(b.interestedCrops || b.crops || []).join(', ')}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              setSelectedBuyerId(b.id)
                            }}
                            className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                              isSelected
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}
                            title="Highlight marker on radar"
                          >
                            🎯 Radar
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              handleOpenConnectModal(b)
                            }}
                            className="flex-1 btn-primary py-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <span>Propose Deal</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Price Comparison Matrix */}
        {activeTab === 'COMPARISON' && (
          <PriceComparisonMatrix
            onSelectBuyerOption={buyerOpt => {
              const matched = buyers.find(b => b.id === buyerOpt.id)
              if (matched) {
                handleOpenConnectModal(matched)
              }
            }}
          />
        )}

        {/* Tab 4: Active Deals & Status Tracker */}
        {activeTab === 'DEALS' && (
          <ConnectionStatusTracker
            requests={requests}
            onRefresh={loadDashboard}
          />
        )}
      </div>

      {/* ── Add Crop Batch Modal ── */}
      {addCropModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100">
            <h3 className="font-display font-bold text-gray-900 text-xl mb-1">
              Add New Crop Batch to Inventory
            </h3>
            <p className="text-gray-500 text-xs mb-6">
              Listing your crop enables instant geo-matching with nearby verified buyers.
            </p>

            <form onSubmit={handleAddCrop} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Crop Name</label>
                <input
                  type="text"
                  value={newCropForm.crop}
                  onChange={e => setNewCropForm(f => ({ ...f, crop: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Quantity (Quintals)</label>
                  <input
                    type="number"
                    value={newCropForm.quantity}
                    onChange={e => setNewCropForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Expected Price (₹/qtl)</label>
                  <input
                    type="number"
                    value={newCropForm.expectedPrice}
                    onChange={e => setNewCropForm(f => ({ ...f, expectedPrice: Number(e.target.value) }))}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Farm Location</label>
                <input
                  type="text"
                  value={newCropForm.location}
                  onChange={e => setNewCropForm(f => ({ ...f, location: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-green-500"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddCropModalOpen(false)}
                  className="btn-outline flex-1 py-3 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 py-3 text-xs font-bold"
                >
                  Publish Batch →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Connection Request Modal ── */}
      <ConnectionRequestModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        buyer={selectedBuyerForConnect}
        farmerId={farmer?.id || farmerId}
        defaultCrop={selectedBuyerForConnect?.interestedCrops?.[0] || 'Onion (Nashik Red)'}
        onSuccess={() => {
          loadDashboard()
          setActiveTab('DEALS')
        }}
      />
    </div>
  )
}
