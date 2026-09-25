import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck,
  Truck, MessageSquare, DollarSign, Calendar, ChevronDown,
  RefreshCw, FileText, Check, X,
} from 'lucide-react'
import { marketplaceService } from '../services/marketplaceService'

export default function ConnectionStatusTracker({ requests = [], onRefresh }) {
  const [filter, setFilter] = useState('ALL') // ALL, PENDING, ACCEPTED, NEGOTIATING, COMPLETED
  const [counterModalReq, setCounterModalReq] = useState(null)
  const [counterPrice, setCounterPrice] = useState('')
  const [counterMessage, setCounterMessage] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)

  const filteredRequests = requests.filter(r => {
    if (filter === 'ALL') return true
    return r.status === filter
  })

  async function handleAcceptDeal(requestId) {
    setActionLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await marketplaceService.acceptDeal(requestId)
      setActionSuccess('Deal successfully accepted and price locked in Escrow.')
      if (onRefresh) onRefresh()
    } catch (err) {
      console.error('Accept deal failed:', err)
      setActionError(err.message || 'Unable to accept deal. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCounterOffer(requestId) {
    if (!counterPrice || Number(counterPrice) <= 0) {
      setActionError('Please enter a valid counter-offer price.')
      return
    }
    setActionLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await marketplaceService.submitCounterOffer(requestId, {
        counterPrice: Number(counterPrice),
        message: counterMessage,
      })
      setActionSuccess(`Counter-offer of ₹${counterPrice}/qtl submitted successfully.`)
      setCounterModalReq(null)
      if (onRefresh) onRefresh()
    } catch (err) {
      console.error('Counter offer failed:', err)
      setActionError(err.message || 'Unable to submit counter offer. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCompleteDeal(requestId) {
    setActionLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await marketplaceService.completeDeal(requestId)
      setActionSuccess('Weighment verified & deal completed successfully!')
      if (onRefresh) onRefresh()
    } catch (err) {
      console.error('Complete deal failed:', err)
      setActionError(err.message || 'Unable to finalize settlement. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRejectDeal(requestId) {
    setActionLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await marketplaceService.updateConnectionStatus(requestId, 'REJECT')
      setActionSuccess('Deal inquiry declined.')
      if (onRefresh) onRefresh()
    } catch (err) {
      console.error('Reject deal failed:', err)
      setActionError(err.message || 'Unable to decline request.')
    } finally {
      setActionLoading(false)
    }
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
            <Check className="w-3 h-3 text-green-700" /> DEAL ACCEPTED
          </span>
        )
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 text-amber-700" /> AWAITING RESPONSE
          </span>
        )
      case 'NEGOTIATING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
            <RefreshCw className="w-3 h-3 text-sky-700 animate-spin-slow" /> IN NEGOTIATION
          </span>
        )
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-700 text-white shadow-sm">
            <ShieldCheck className="w-3 h-3 text-white" /> VERIFIED & SETTLED
          </span>
        )
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
            <X className="w-3 h-3 text-rose-700" /> DECLINED
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="bg-white border border-green-100 rounded-3xl shadow-sm overflow-hidden">
      {/* Header & Filter Tabs */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center text-green-700 font-bold">
              ⚡
            </div>
            <h3 className="font-display font-bold text-gray-900 text-xl">
              Connection Requests & Deal Tracker
            </h3>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">
              M5 State Machine
            </span>
          </div>
          <p className="text-gray-500 text-xs">
            Live lifecycle tracking for direct transactions between farmers and verified buyers.
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap gap-1.5">
          {['ALL', 'PENDING', 'NEGOTIATING', 'ACCEPTED', 'COMPLETED'].map(st => (
            <button
              key={st}
              type="button"
              onClick={() => setFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filter === st
                  ? 'bg-green-700 text-white shadow-sm'
                  : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {st} {st !== 'ALL' && `(${requests.filter(r => r.status === st).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Notifications */}
      {actionError && (
        <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700 text-sm font-bold">✕</button>
        </div>
      )}
      {actionSuccess && (
        <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-700 text-sm font-bold">✕</button>
        </div>
      )}

      {/* Requests List */}
      <div className="p-6 space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No connection requests matching "{filter}".</p>
          </div>
        ) : (
          filteredRequests.map(req => {
            const totalVal = req.requestedQty * (req.farmerAskPrice || req.offeredPrice)
            return (
              <div
                key={req.id}
                className="p-5 rounded-2xl border border-gray-100 bg-gradient-to-r from-white via-gray-50/40 to-green-50/20 hover:border-green-200 hover:shadow-md transition-all space-y-4"
              >
                {/* Top Row: Buyer Name & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏢</span>
                      <h4 className="font-display font-bold text-gray-900 text-base">
                        {req.buyerName}
                      </h4>
                      <span className="text-[10px] text-gray-400 font-mono">ID: {req.id}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Batch: <strong className="text-gray-800">{req.requestedQty} {req.unit} of {req.crop}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(req.status)}
                  </div>
                </div>

                {/* Key Numbers Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-gray-100 text-xs">
                  <div>
                    <span className="text-gray-400 text-[11px] block">Offered Rate</span>
                    <strong className="text-sm font-bold text-gray-900 font-display">
                      ₹{req.offeredPrice} <span className="font-normal text-gray-400 text-[10px]">/qtl</span>
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[11px] block">Farmer Ask</span>
                    <strong className="text-sm font-bold text-green-700 font-display">
                      ₹{req.farmerAskPrice || req.offeredPrice} <span className="font-normal text-gray-400 text-[10px]">/qtl</span>
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[11px] block">Total Deal Value</span>
                    <strong className="text-sm font-bold text-gray-900 font-display">
                      ₹{totalVal.toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[11px] block">Target Date</span>
                    <strong className="text-sm font-bold text-gray-900 font-display">
                      {req.expectedDate}
                    </strong>
                  </div>
                </div>

                {/* Logistics & Special Notes */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-600 bg-gray-50/60 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-green-600 shrink-0" />
                    <span>
                      Logistics: <strong>{req.pickupType === 'BUYER_ARRANGED_TRANSPORT' ? 'Buyer Arranges Farm Pickup' : 'Farmer Delivery'}</strong>
                    </span>
                  </div>
                  {req.notes && (
                    <p className="text-gray-500 italic text-[11px]">
                      "{req.notes}"
                    </p>
                  )}
                </div>

                {/* Stepper / Timeline progress */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      Deal Audit Trail (SIH Verified Protocol)
                    </p>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-mono font-semibold">
                      Tamper-evident log
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {req.timeline?.map((step, idx) => {
                      const hasTransition = step.oldStatus && step.newStatus && step.oldStatus !== 'NONE'
                      return (
                        <div
                          key={idx}
                          className="p-2 rounded-xl bg-white/80 border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-700 gap-1"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                            <div>
                              <span className="font-semibold text-gray-900">{step.step || step.action}</span>
                              {step.actor && (
                                <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 font-medium">
                                  {step.actor}
                                </span>
                              )}
                              {step.price && (
                                <span className="ml-1.5 text-[11px] font-bold text-green-700">
                                  ₹{step.price}/qtl
                                </span>
                              )}
                              {hasTransition && (
                                <span className="ml-1.5 text-[10px] font-mono text-gray-500">
                                  [{step.oldStatus} → {step.newStatus}]
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono shrink-0 pl-5 sm:pl-0">
                            {step.date || (step.timestamp ? new Date(step.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Action Buttons based on status */}
                <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-end gap-2">
                  {req.status === 'PENDING' && (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleRejectDeal(req.id)}
                        className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-100 transition-all disabled:opacity-50"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => {
                          setCounterModalReq(req)
                          setCounterPrice(String(req.farmerAskPrice || req.offeredPrice))
                        }}
                        className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-all disabled:opacity-50"
                      >
                        💬 Counter-Offer
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleAcceptDeal(req.id)}
                        className="btn-primary py-2 px-5 text-xs font-bold shadow-sm disabled:opacity-50"
                      >
                        ✓ Accept & Lock Price
                      </button>
                    </>
                  )}

                  {req.status === 'NEGOTIATING' && (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleAcceptDeal(req.id)}
                        className="btn-primary py-2 px-5 text-xs font-bold shadow-sm disabled:opacity-50"
                      >
                        ✓ Accept Current Offer (₹{req.offeredPrice}/qtl)
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => {
                          setCounterModalReq(req)
                          setCounterPrice(String(req.farmerAskPrice || req.offeredPrice))
                        }}
                        className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-all disabled:opacity-50"
                      >
                        Revise Counter-Offer
                      </button>
                    </>
                  )}

                  {req.status === 'ACCEPTED' && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleCompleteDeal(req.id)}
                      className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Confirm Weighment & Release Escrow
                    </button>
                  )}

                  {req.status === 'COMPLETED' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Transaction Successfully Settled
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Counter-Offer Modal */}
      {counterModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100">
            <h4 className="font-display font-bold text-gray-900 text-lg mb-1">
              Propose Counter-Offer to {counterModalReq.buyerName}
            </h4>
            <p className="text-gray-500 text-xs mb-4">
              Current offer is ₹{counterModalReq.offeredPrice}/qtl for {counterModalReq.requestedQty} {counterModalReq.unit} of {counterModalReq.crop}.
            </p>
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                Your Counter Price (₹ / {counterModalReq.unit})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">₹</span>
                <input
                  type="number"
                  value={counterPrice}
                  onChange={e => setCounterPrice(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-green-500"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                Message / Rationale (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Higher moisture standard, premium grade sorting included"
                value={counterMessage}
                onChange={e => setCounterMessage(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-green-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCounterModalReq(null)}
                className="btn-outline flex-1 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleCounterOffer(counterModalReq.id)}
                className="btn-primary flex-1 py-2 text-xs disabled:opacity-50"
              >
                {actionLoading ? 'Submitting...' : 'Send Counter-Offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
