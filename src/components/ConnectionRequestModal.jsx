import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, CheckCircle2, ShieldCheck, Truck, Calendar,
  DollarSign, FileText, Send, AlertCircle, Building2,
} from 'lucide-react'
import { marketplaceService } from '../services/marketplaceService'
import { validateDealRequest } from '../types/contracts'

export default function ConnectionRequestModal({
  isOpen,
  onClose,
  buyer,
  // Supplied by FarmerDashboard from the authenticated session. No placeholder
  // default: an absent id must stay absent rather than become a fake identity.
  farmerId = null,
  batchId = null,
  defaultCrop = 'Onion (Nashik Red)',
  onSuccess,
}) {
  const [crop, setCrop] = useState(defaultCrop)
  const [quantity, setQuantity] = useState(200)
  const [unit, setUnit] = useState('Quintal')
  const [offeredPrice, setOfferedPrice] = useState(
    buyer?.offeredPricePerQtl?.[defaultCrop] || 1320
  )
  const [pickupType, setPickupType] = useState('BUYER_ARRANGED_TRANSPORT')
  const [expectedDate, setExpectedDate] = useState(
    new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
  )
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [validationErrors, setValidationErrors] = useState({})

  if (!isOpen || !buyer) return null

  const totalValue = quantity * offeredPrice

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return // Prevent duplicate submission

    setSubmitError(null)

    // Validate payload against data contracts
    const payload = {
      farmerId,
      buyerId: buyer.id,
      buyerName: buyer.name,
      crop,
      cropId: `crop-${crop.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      batchId: batchId || `batch-${Date.now()}`,
      quantity: Number(quantity),
      requestedQty: Number(quantity),
      unit,
      quotedPrice: Number(offeredPrice),
      offeredPrice: Number(offeredPrice),
      farmerAskPrice: Number(offeredPrice),
      logisticsMethod: pickupType,
      pickupType,
      targetDate: expectedDate,
      expectedDate,
      message: notes,
      notes,
    }

    const validation = validateDealRequest(payload)
    if (!validation.isValid) {
      setValidationErrors(validation.errors)
      return
    }
    setValidationErrors({})

    setSubmitting(true)
    try {
      const newReq = await marketplaceService.createDealRequest(payload)
      setSubmitting(false)
      setSubmitted(true)
      if (onSuccess) onSuccess(newReq)
    } catch (err) {
      console.error('Deal request failed:', err)
      setSubmitError(err.message || 'Unable to send request. Try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-green-50/70 via-white to-emerald-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-green-600 text-white flex items-center justify-center shadow-md">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-gray-900 text-lg">
                  Propose Direct Farmer-Buyer Deal
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  M5 Transaction Link
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-0.5">
                Connecting with <strong className="text-gray-800">{buyer.name}</strong> ({buyer.distanceKm} km away)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-2xl mb-4 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="font-display font-bold text-gray-900 text-2xl mb-2">
              Connection Request Sent!
            </h4>
            <p className="text-gray-600 text-sm max-w-md mb-6 leading-relaxed">
              Your deal proposal for <strong className="text-green-800">{quantity} Quintals of {crop}</strong> at{' '}
              <strong className="text-green-800">₹{offeredPrice}/qtl</strong> (Total ₹{totalValue.toLocaleString()}) has been transmitted to {buyer.name}.
            </p>
            <div className="p-4 rounded-2xl bg-green-50 border border-green-200 text-xs text-green-800 w-full max-w-md mb-6 text-left space-y-1">
              <p className="font-semibold">Next Steps (SIH M5 Workflow):</p>
              <p>1. Buyer will review quality specifications within 24 hours.</p>
              <p>2. You will be notified when they accept or send a counter-offer.</p>
              <p>3. Escrow weighment slip and pickup code will be generated automatically.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn-primary py-3 px-8 text-sm"
            >
              Done / Return to Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
            {/* Error Notification */}
            {submitError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Validation Errors Summary */}
            {Object.keys(validationErrors).length > 0 && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Please correct the following:
                </p>
                {Object.values(validationErrors).map((msg, i) => (
                  <p key={i} className="pl-5">• {msg}</p>
                ))}
              </div>
            )}

            {/* Buyer Trust Pill */}
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-emerald-950">
                  {buyer.verificationTier || 'KYC VERIFIED'}
                </span>
                <span className="text-emerald-700">· {buyer.trustScore}% Trust Score</span>
              </div>
              <span className="text-gray-500 font-medium">Payment: {buyer.paymentTerms}</span>
            </div>

            {/* Grid 1: Crop and Quantity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                  Select Crop
                </label>
                <select
                  value={crop}
                  onChange={e => {
                    const newCrop = e.target.value
                    setCrop(newCrop)
                    if (buyer.offeredPricePerQtl[newCrop]) {
                      setOfferedPrice(buyer.offeredPricePerQtl[newCrop])
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-green-500"
                >
                  {buyer.interestedCrops.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                  Quantity ({unit})
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                    required
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-green-500"
                  />
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-700 focus:outline-none"
                  >
                    <option>Quintal</option>
                    <option>Tonne</option>
                    <option>Crates</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Grid 2: Offered Price and Expected Fulfillment Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                  Target Price (₹ / {unit})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={offeredPrice}
                    onChange={e => setOfferedPrice(Number(e.target.value))}
                    required
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-green-500"
                  />
                </div>
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Buyer standard quote: ₹{buyer.offeredPricePerQtl[crop] || offeredPrice}/qtl
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                  Expected Delivery / Pickup Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={e => setExpectedDate(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>
            </div>

            {/* Logistics / Pickup Preference */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                Transport & Logistics Method
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPickupType('BUYER_ARRANGED_TRANSPORT')}
                  className={`p-3 rounded-2xl border text-left text-xs transition-all ${
                    pickupType === 'BUYER_ARRANGED_TRANSPORT'
                      ? 'bg-green-50 border-green-500 text-green-900 ring-2 ring-green-200'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-green-600" /> Buyer Dispatches Vehicle
                  </p>
                  <p className="text-gray-500 text-[11px] mt-0.5">
                    Pickup directly from your farm gate. Zero freight deducted.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPickupType('FARMER_DELIVERY')}
                  className={`p-3 rounded-2xl border text-left text-xs transition-all ${
                    pickupType === 'FARMER_DELIVERY'
                      ? 'bg-green-50 border-green-500 text-green-900 ring-2 ring-green-200'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    🏡 Farmer Delivery to Hub
                  </p>
                  <p className="text-gray-500 text-[11px] mt-0.5">
                    You transport batch to {buyer.location} ({buyer.distanceKm} km).
                  </p>
                </button>
              </div>
            </div>

            {/* Special Instructions / Quality Notes */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                Quality Specifications & Batch Notes
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Moisture < 12%, sorted in 50kg bags, harvested on 22nd Sept, pesticide residue tested."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Deal Valuation Summary Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-gray-900 to-emerald-950 text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] text-green-300 uppercase tracking-wider font-semibold">
                  Estimated Total Deal Value
                </span>
                <p className="font-display font-black text-2xl text-white">
                  ₹{totalValue.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-gray-300">
                    ({quantity} {unit} @ ₹{offeredPrice})
                  </span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] bg-green-500/20 text-green-300 px-2.5 py-1 rounded-full font-mono border border-green-500/30">
                  Escrow Protected
                </span>
              </div>
            </div>

            {/* Submit & Cancel */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-outline flex-1 py-3 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 shadow-md"
              >
                {submitting ? 'Transmitting...' : '🚀 Submit Deal Request'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  )
}
