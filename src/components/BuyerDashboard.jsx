import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Package, TrendingUp, MapPin, ShieldCheck, Plus,
  Search, ArrowRight, DollarSign, Clock, RefreshCw, Filter,
  CheckCircle2, AlertCircle, X, ChevronRight, Truck, Phone,
  Mail, Calendar, FileText, Check, Send, Sparkles, SlidersHorizontal,
} from 'lucide-react'
import { marketplaceService } from '../services/marketplaceService'
import PriceComparisonMatrix from './PriceComparisonMatrix'

export default function BuyerDashboard({ onFarmerMatchSelect }) {
  const [profile, setProfile] = useState(null)
  const [requirements, setRequirements] = useState([])
  const [incomingOffers, setIncomingOffers] = useState([])
  const [farmerInventory, setFarmerInventory] = useState([])
  const [activeTab, setActiveTab] = useState('REQUIREMENTS') // 'REQUIREMENTS', 'OFFERS', 'FARMERS', 'COMPARISON'
  const [loading, setLoading] = useState(true)

  // Filters for requirements
  const [cropFilter, setCropFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Modals state
  const [postModalOpen, setPostModalOpen] = useState(false)
  const [counterModalOffer, setCounterModalOffer] = useState(null)
  const [counterPrice, setCounterPrice] = useState('')
  const [counterMsg, setCounterMsg] = useState('')
  const [proposalModalFarmer, setProposalModalFarmer] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusFeedback, setStatusFeedback] = useState(null)

  // Form for new requirement
  const [newReqForm, setNewReqForm] = useState({
    crop: 'Onion (Nashik Red)',
    variety: 'Garwa / Export Grade',
    category: 'Vegetables',
    requiredQty: 500,
    unit: 'Quintal',
    offeredPrice: 1340,
    maxPrice: 1380,
    targetDeliveryDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
    qualityGrade: 'Grade A Export',
    location: 'Nashik MIDC Logistics Park, Maharashtra',
    freightTerms: 'FREE_FARMGATE_PICKUP',
  })

  // Load all buyer data
  function loadBuyerData() {
    setLoading(true)
    setStatusFeedback(null)
    Promise.all([
      marketplaceService.getBuyerProfile('byr-201'),
      marketplaceService.getBuyerRequirements('byr-201'),
      marketplaceService.getIncomingFarmerOffers('byr-201'),
      marketplaceService.getFarmerInventory(),
    ])
      .then(([prof, reqs, offers, inventory]) => {
        setProfile(prof)
        setRequirements(reqs)
        setIncomingOffers(offers)
        setFarmerInventory(inventory)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error loading buyer data:', err)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadBuyerData()
  }, [])

  // Handle Post New Requirement
  async function handlePostRequirement(e) {
    e.preventDefault()
    setActionLoading(true)
    try {
      await marketplaceService.addBuyerRequirement({
        ...newReqForm,
        buyerId: profile?.id || 'byr-201',
        buyerName: profile?.name || 'Kisan Agro Processing Ltd.',
      })
      setPostModalOpen(false)
      setStatusFeedback({ type: 'success', message: 'Sourcing requirement posted successfully!' })
      loadBuyerData()
    } catch (err) {
      console.error('Failed to post requirement:', err)
      setStatusFeedback({ type: 'error', message: err.message || 'Failed to post requirement.' })
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Delete Requirement
  async function handleDeleteRequirement(reqId) {
    try {
      await marketplaceService.deleteBuyerRequirement(reqId)
      setStatusFeedback({ type: 'success', message: 'Requirement closed.' })
      loadBuyerData()
    } catch (err) {
      console.error('Error closing requirement:', err)
    }
  }

  // Handle Buyer Respond to Farmer Offer
  async function handleOfferAction(offerId, action, payload = {}) {
    setActionLoading(true)
    try {
      await marketplaceService.buyerRespondOffer(offerId, action, payload)
      setStatusFeedback({
        type: 'success',
        message: action === 'ACCEPT'
          ? 'Deal accepted! Funds secured in Escrow.'
          : action === 'NEGOTIATE'
          ? 'Counter-offer sent to farmer.'
          : 'Offer declined.',
      })
      setCounterModalOffer(null)
      loadBuyerData()
    } catch (err) {
      console.error('Error updating offer:', err)
      setStatusFeedback({ type: 'error', message: err.message || 'Action failed.' })
    } finally {
      setActionLoading(false)
    }
  }

  // Filtered requirements
  const filteredRequirements = requirements.filter(r => {
    if (cropFilter !== 'ALL' && !r.crop.toLowerCase().includes(cropFilter.toLowerCase())) return false
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false
    return true
  })

  // Pending offers count
  const pendingOffersCount = incomingOffers.filter(o => o.status === 'PENDING').length
  const totalVolumeNeeded = requirements.reduce((acc, r) => acc + Number(r.requiredQty || 0), 0)

  if (loading && !profile) {
    return (
      <div className="min-h-[380px] flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm font-medium">Loading FasalSethu Buyer Sourcing Hub...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 select-none">
      {/* ── Feedback Alert ── */}
      {statusFeedback && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl flex items-center justify-between text-sm font-semibold ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusFeedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{statusFeedback.message}</span>
          </div>
          <button onClick={() => setStatusFeedback(null)} className="p-1 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* ── Top Buyer Profile & Procurement Command Center ── */}
      <div className="bg-white border border-green-100 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-700 via-emerald-800 to-green-950 text-white flex items-center justify-center text-3xl shadow-md font-display font-bold">
              🏢
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display font-black text-gray-900 text-2xl">
                  {profile?.name || 'Kisan Agro Processing Ltd.'}
                </h2>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  {profile?.verificationTier || 'KYC & GST VERIFIED'}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  GST: {profile?.gstin || '27AABCK1234F1Z9'}
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-1 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-green-600" />
                  {profile?.location}
                </span>
                <span>•</span>
                <span>Procurement Lead: <strong>{profile?.contactPerson}</strong></span>
                <span>•</span>
                <span className="text-green-700 font-semibold">Trust Rating: {profile?.trustScore}%</span>
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setPostModalOpen(true)}
              className="btn-primary py-2.5 px-5 text-sm font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" /> Post Requirement (RFQ)
            </button>
            <button
              type="button"
              onClick={loadBuyerData}
              className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-black transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 Core Buyer KPI Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
          <div className="p-4 rounded-2xl bg-green-50/60 border border-green-100">
            <span className="text-gray-500 text-xs font-medium flex items-center gap-1.5 mb-1">
              <Package className="w-3.5 h-3.5 text-green-600" /> Active Sourcing RFQs
            </span>
            <p className="font-display font-black text-2xl text-gray-900">
              {requirements.length}{' '}
              <span className="text-xs font-normal text-gray-500">Live Postings</span>
            </p>
            <p className="text-green-700 text-[11px] font-semibold mt-1">
              Total demand: {totalVolumeNeeded.toLocaleString()} Qtl
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100">
            <span className="text-gray-500 text-xs font-medium flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" /> Incoming Farmer Offers
            </span>
            <p className="font-display font-black text-2xl text-amber-800">
              {incomingOffers.length}{' '}
              <span className="text-xs font-normal text-gray-500">Offers</span>
            </p>
            <p className="text-amber-700 text-[11px] font-semibold mt-1">
              {pendingOffersCount} pending your review
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
            <span className="text-gray-500 text-xs font-medium flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Landed Cost Savings
            </span>
            <p className="font-display font-black text-2xl text-emerald-800">
              ~22.4%
            </p>
            <p className="text-emerald-700 text-[11px] font-semibold mt-1">
              Saved vs wholesale mandi cess
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-100">
            <span className="text-gray-500 text-xs font-medium flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-600" /> Escrow Fund Balance
            </span>
            <p className="font-display font-black text-2xl text-sky-900">
              ₹8.50 <span className="text-xs font-normal text-gray-500">Lakh</span>
            </p>
            <p className="text-sky-700 text-[11px] font-semibold mt-1">
              Verified T+1 settlement
            </p>
          </div>
        </div>
      </div>

      {/* ── Buyer Module Navigation Tabs ── */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'REQUIREMENTS', label: '📋 My Sourcing Requirements', badge: requirements.length },
          { id: 'OFFERS', label: '📥 Incoming Farmer Deals', badge: incomingOffers.length },
          { id: 'FARMERS', label: '🌾 Direct Farmer Matching Radar', badge: farmerInventory.length },
          { id: 'COMPARISON', label: '📊 Landed Price Matrix', badge: 'Mandi vs Farm' },
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
            {tab.badge !== undefined && (
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

      {/* ── Tab 1: Buyer Requirements ── */}
      {activeTab === 'REQUIREMENTS' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-bold text-gray-700 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-green-600" /> Filter Crop:
              </span>
              <div className="inline-flex rounded-xl bg-gray-50 p-1 border border-gray-200">
                {['ALL', 'Onion', 'Tomato', 'Wheat', 'Potato', 'Soybean'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCropFilter(c)}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      cropFilter === c ? 'bg-green-700 text-white shadow-xs' : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPostModalOpen(true)}
              className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Post New Crop Requirement
            </button>
          </div>

          {/* Requirements Grid */}
          {filteredRequirements.length === 0 ? (
            <div className="p-12 text-center bg-gray-50 rounded-3xl border border-gray-200">
              <Package className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-700 font-bold">No active sourcing requirements found.</p>
              <p className="text-gray-500 text-xs mt-1">Post your crop needs to match directly with farmers.</p>
              <button
                type="button"
                onClick={() => setPostModalOpen(true)}
                className="mt-4 btn-primary py-2.5 px-5 text-xs font-bold"
              >
                + Post Your First Requirement
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRequirements.map(req => (
                <div
                  key={req.id}
                  className="p-6 rounded-3xl bg-white border border-green-100 hover:border-green-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Category & Status */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200">
                        {req.category}
                      </span>
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {req.status}
                      </span>
                    </div>

                    {/* Crop Name & Variety */}
                    <h3 className="font-display font-bold text-gray-900 text-lg leading-tight mb-1">
                      {req.crop}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mb-4">
                      {req.variety} · <strong className="text-green-800">{req.qualityGrade}</strong>
                    </p>

                    {/* Requirement Specs Grid */}
                    <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-2xl bg-green-50/50 border border-green-100/70 text-xs mb-4">
                      <div>
                        <span className="text-gray-400 text-[11px] block">Target Quantity</span>
                        <span className="font-bold text-gray-900 text-sm">{req.requiredQty} {req.unit}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-[11px] block">Offered Rate</span>
                        <span className="font-bold text-green-700 text-sm">₹{req.offeredPrice}/qtl</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-[11px] block">Target Date</span>
                        <span className="font-semibold text-gray-800">{req.targetDeliveryDate}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-[11px] block">Logistics</span>
                        <span className="font-semibold text-gray-800 flex items-center gap-1">
                          <Truck className="w-3 h-3 text-green-600" />
                          {req.freightTerms === 'FREE_FARMGATE_PICKUP' ? 'Farmgate Pickup' : 'Farmer Delivery'}
                        </span>
                      </div>
                    </div>

                    {/* Location */}
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-4">
                      <MapPin className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      <span>{req.location}</span>
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('FARMERS')
                        if (onFarmerMatchSelect) onFarmerMatchSelect(req)
                      }}
                      className="flex-1 py-2 rounded-xl bg-green-700 text-white text-xs font-bold hover:bg-green-800 transition-all flex items-center justify-center gap-1 shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-lime-300" />
                      <span>Find Matching Farmers</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRequirement(req.id)}
                      className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Close Requirement"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Incoming Farmer Offers & Deals ── */}
      {activeTab === 'OFFERS' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-gray-900 text-lg">
              Incoming Direct Farmer Proposals ({incomingOffers.length})
            </h3>
            <span className="text-xs text-green-700 font-semibold">
              Protected by FasalSethu Smart Escrow
            </span>
          </div>

          {incomingOffers.length === 0 ? (
            <div className="p-12 text-center bg-gray-50 rounded-3xl border border-gray-200">
              <Clock className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-700 font-bold">No farmer proposals received yet.</p>
              <p className="text-gray-500 text-xs mt-1">Post active requirements to receive direct proposals from nearby farmers.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {incomingOffers.map(offer => {
                const totalVal = (offer.quantity || offer.requestedQty || 0) * (offer.farmerAskPrice || offer.offeredPrice || 0)
                const isPending = offer.status === 'PENDING'
                const isNegotiating = offer.status === 'NEGOTIATING'
                const isAccepted = offer.status === 'ACCEPTED'

                return (
                  <div
                    key={offer.id}
                    className="p-6 rounded-3xl bg-white border border-green-100 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                  >
                    {/* Offer Summary */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                          isAccepted
                            ? 'bg-emerald-100 text-emerald-800'
                            : isNegotiating
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}>
                          {offer.status}
                        </span>
                        <span className="text-xs font-bold text-gray-900">
                          {offer.crop}
                        </span>
                        <span className="text-xs text-gray-500">
                          From: <strong>{offer.farmerName || 'Farmer Ramesh Patil (Dindori)'}</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                        <div>
                          <span className="text-gray-400 block text-[11px]">Offered Quantity</span>
                          <span className="font-bold text-gray-900">{offer.quantity || offer.requestedQty} {offer.unit || 'Qtl'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[11px]">Proposed Price</span>
                          <span className="font-bold text-green-700">₹{offer.farmerAskPrice || offer.offeredPrice}/qtl</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[11px]">Gross Total</span>
                          <span className="font-bold text-gray-900">₹{totalVal.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[11px]">Fulfillment By</span>
                          <span className="font-semibold text-gray-800">{offer.targetDate || offer.expectedDate}</span>
                        </div>
                      </div>

                      {offer.message && (
                        <p className="text-xs bg-gray-50 p-2.5 rounded-xl text-gray-600 italic">
                          "{offer.message}"
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-stretch lg:items-center gap-2 shrink-0">
                      {isPending || isNegotiating ? (
                        <>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleOfferAction(offer.id, 'ACCEPT')}
                            className="px-5 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white text-xs font-bold transition-all shadow-xs"
                          >
                            ✓ Accept Deal & Lock Escrow
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCounterModalOffer(offer)
                              setCounterPrice(offer.quotedPrice || offer.offeredPrice || '')
                            }}
                            className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-all"
                          >
                            Counter-Offer
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleOfferAction(offer.id, 'REJECT')}
                            className="px-3 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold"
                          >
                            Decline
                          </button>
                        </>
                      ) : isAccepted ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            Escrow Locked · Weighment Awaited
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Direct Farmer Matching Radar ── */}
      {activeTab === 'FARMERS' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display font-bold text-gray-900 text-lg">
                Available Farmgate Batches ({farmerInventory.length} listed)
              </h3>
              <p className="text-gray-500 text-xs">
                Matched from verified farmers in your procurement region.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-gray-500">Filter Crop:</span>
              <select
                value={cropFilter}
                onChange={e => setCropFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 font-semibold"
              >
                <option value="ALL">All Crops</option>
                <option value="Onion">Onion</option>
                <option value="Tomato">Tomato</option>
                <option value="Wheat">Wheat</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {farmerInventory
              .filter(item => cropFilter === 'ALL' || item.crop.toLowerCase().includes(cropFilter.toLowerCase()))
              .map(batch => (
                <div
                  key={batch.id}
                  className="p-6 rounded-3xl bg-white border border-green-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                        {batch.category || 'Produce'}
                      </span>
                      {batch.verified && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> VERIFIED BATCH
                        </span>
                      )}
                    </div>

                    <h4 className="font-display font-bold text-gray-900 text-lg leading-tight mb-1">
                      {batch.crop}
                    </h4>
                    <p className="text-xs text-gray-500 mb-4">
                      Farmer: <strong>{batch.farmerName}</strong> · {batch.location}
                    </p>

                    <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-gray-50 text-xs mb-4">
                      <div>
                        <span className="text-gray-400 block text-[10px]">Stock</span>
                        <span className="font-bold text-gray-900">{batch.quantity} {batch.unit}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Asking Rate</span>
                        <span className="font-bold text-green-700">₹{batch.expectedPrice}/qtl</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Moisture</span>
                        <span className="font-semibold text-gray-800">{batch.moisturePercent || 12}%</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setProposalModalFarmer(batch)
                      setCounterPrice(batch.expectedPrice)
                    }}
                    className="w-full btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <span>Send Purchase Proposal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Tab 4: Price Comparison Matrix ── */}
      {activeTab === 'COMPARISON' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
            <h3 className="font-display font-bold text-gray-900 text-lg mb-1">
              Procurement landed cost calculator
            </h3>
            <p className="text-gray-500 text-xs">
              Compare wholesale mandi purchase costs (accounting for APMC mandi cess, unloading, and handling fees) against direct farmgate procurement with FasalSethu.
            </p>
          </div>
          <PriceComparisonMatrix />
        </div>
      )}

      {/* ── Modal: Post Sourcing Requirement ── */}
      <AnimatePresence>
        {postModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-green-100 text-green-800 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <h3 className="font-display font-bold text-gray-900 text-lg">Post Sourcing Requirement (RFQ)</h3>
                </div>
                <button onClick={() => setPostModalOpen(false)} className="p-1 hover:opacity-75">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handlePostRequirement} className="space-y-4 text-xs font-semibold text-gray-700">
                <div>
                  <label className="block text-gray-500 mb-1">Crop Needed</label>
                  <select
                    value={newReqForm.crop}
                    onChange={e => setNewReqForm({ ...newReqForm, crop: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-semibold focus:outline-none focus:border-green-600"
                  >
                    <option value="Onion (Nashik Red)">Onion (Nashik Red)</option>
                    <option value="Tomato (Hybrid)">Tomato (Hybrid)</option>
                    <option value="Wheat (Sharbati)">Wheat (Sharbati)</option>
                    <option value="Potato">Potato</option>
                    <option value="Soybean">Soybean</option>
                    <option value="Maize">Maize</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-500 mb-1">Required Quantity (Qtl)</label>
                    <input
                      type="number"
                      value={newReqForm.requiredQty}
                      onChange={e => setNewReqForm({ ...newReqForm, requiredQty: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-semibold"
                      required
                      min={10}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Offered Price (₹/Qtl)</label>
                    <input
                      type="number"
                      value={newReqForm.offeredPrice}
                      onChange={e => setNewReqForm({ ...newReqForm, offeredPrice: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-semibold"
                      required
                      min={100}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-500 mb-1">Quality Grade</label>
                    <select
                      value={newReqForm.qualityGrade}
                      onChange={e => setNewReqForm({ ...newReqForm, qualityGrade: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-semibold"
                    >
                      <option value="Grade A Export">Grade A Export</option>
                      <option value="Grade A Premium">Grade A Premium</option>
                      <option value="Grade A Table">Grade A Table</option>
                      <option value="Processing Grade">Processing Grade</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Target Delivery Date</label>
                    <input
                      type="date"
                      value={newReqForm.targetDeliveryDate}
                      onChange={e => setNewReqForm({ ...newReqForm, targetDeliveryDate: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-semibold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-500 mb-1">Logistics / Freight Mode</label>
                  <select
                    value={newReqForm.freightTerms}
                    onChange={e => setNewReqForm({ ...newReqForm, freightTerms: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-semibold"
                  >
                    <option value="FREE_FARMGATE_PICKUP">Free Farmgate Pickup (Buyer Dispatches Truck)</option>
                    <option value="FARMER_DELIVERY">Farmer Delivery to Buyer Hub</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-500 mb-1">Delivery Hub Location</label>
                  <input
                    type="text"
                    value={newReqForm.location}
                    onChange={e => setNewReqForm({ ...newReqForm, location: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-semibold"
                    required
                  />
                </div>

                <div className="pt-3 border-t border-gray-100 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPostModalOpen(false)}
                    className="flex-1 py-3 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 btn-primary py-3 font-bold"
                  >
                    {actionLoading ? 'Publishing...' : 'Publish Requirement'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal: Counter-Offer ── */}
      <AnimatePresence>
        {counterModalOffer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-gray-100"
            >
              <h3 className="font-display font-bold text-gray-900 text-lg mb-2">
                Submit Counter-Offer to Farmer
              </h3>
              <p className="text-gray-500 text-xs mb-4">
                Propose an updated price for {counterModalOffer.quantity} {counterModalOffer.unit} of {counterModalOffer.crop}.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Your Counter Price (₹/Qtl)</label>
                  <input
                    type="number"
                    value={counterPrice}
                    onChange={e => setCounterPrice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Note to Farmer (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Can do ₹1,360 if moisture is verified under 11%."
                    value={counterMsg}
                    onChange={e => setCounterMsg(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-xs"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCounterModalOffer(null)}
                    className="flex-1 py-2.5 rounded-full border border-gray-200 text-gray-700 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading || !counterPrice}
                    onClick={() => handleOfferAction(counterModalOffer.id, 'NEGOTIATE', {
                      counterPrice: Number(counterPrice),
                      message: counterMsg,
                    })}
                    className="flex-1 btn-primary py-2.5 text-xs font-bold"
                  >
                    Submit Counter
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal: Send Purchase Proposal to Farmer ── */}
      <AnimatePresence>
        {proposalModalFarmer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-gray-100"
            >
              <h3 className="font-display font-bold text-gray-900 text-lg mb-1">
                Direct Purchase Proposal
              </h3>
              <p className="text-gray-500 text-xs mb-4">
                Propose a purchase order for {proposalModalFarmer.crop} listed by {proposalModalFarmer.farmerName}.
              </p>

              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-green-50 text-xs space-y-1">
                  <p><strong>Available:</strong> {proposalModalFarmer.quantity} {proposalModalFarmer.unit}</p>
                  <p><strong>Farmer Asking Rate:</strong> ₹{proposalModalFarmer.expectedPrice}/qtl</p>
                  <p><strong>Location:</strong> {proposalModalFarmer.location}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Your Offered Price (₹/Qtl)</label>
                  <input
                    type="number"
                    value={counterPrice}
                    onChange={e => setCounterPrice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-bold text-sm"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setProposalModalFarmer(null)}
                    className="flex-1 py-2.5 rounded-full border border-gray-200 text-gray-700 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading || !counterPrice}
                    onClick={async () => {
                      setActionLoading(true)
                      try {
                        await marketplaceService.createDealRequest({
                          farmerId: proposalModalFarmer.farmerId || 'frm-01',
                          buyerId: profile?.id || 'byr-201',
                          buyerName: profile?.name || 'Kisan Agro Processing Ltd.',
                          crop: proposalModalFarmer.crop,
                          quantity: Number(proposalModalFarmer.quantity),
                          quotedPrice: Number(counterPrice),
                          targetDate: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
                          message: 'Direct procurement proposal sent via Buyer Radar.',
                        })
                        setProposalModalFarmer(null)
                        setStatusFeedback({ type: 'success', message: 'Purchase proposal sent to farmer!' })
                        loadBuyerData()
                      } catch (err) {
                        setStatusFeedback({ type: 'error', message: err.message || 'Failed to send proposal.' })
                      } finally {
                        setActionLoading(false)
                      }
                    }}
                    className="flex-1 btn-primary py-2.5 text-xs font-bold"
                  >
                    Send Proposal
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
