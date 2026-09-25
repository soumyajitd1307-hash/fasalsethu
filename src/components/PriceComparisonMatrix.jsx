import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, DollarSign, Truck, AlertCircle, CheckCircle2,
  ArrowRight, Sparkles, Filter, Info, ShieldCheck,
} from 'lucide-react'
import { marketplaceService } from '../services/marketplaceService'

const AVAILABLE_CROPS = [
  'Onion (Nashik Red)',
  'Wheat (Sharbati)',
  'Tomato (Hybrid)',
  'Soybean',
  'Potato',
]

export default function PriceComparisonMatrix({ onSelectBuyerOption }) {
  const [selectedCrop, setSelectedCrop] = useState('Onion (Nashik Red)')
  const [quantity, setQuantity] = useState(250) // Quintals
  const [matrixData, setMatrixData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)

  const fetchMatrix = () => {
    let isCurrent = true
    setLoading(true)
    setErrorMessage(null)
    marketplaceService
      .getPriceComparisonMatrix(selectedCrop, quantity)
      .then(res => {
        if (isCurrent) {
          setMatrixData(res)
          setLoading(false)
        }
      })
      .catch(err => {
        console.error('Matrix calculation error:', err)
        if (isCurrent) {
          setErrorMessage(err.message || 'Unable to load price comparison data. Try again.')
          setLoading(false)
        }
      })

    return () => {
      isCurrent = false
    }
  }

  useEffect(() => {
    return fetchMatrix()
  }, [selectedCrop, quantity])

  return (
    <div className="bg-white border border-green-100 rounded-3xl shadow-sm overflow-hidden">
      {/* Header & Controls */}
      <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-green-50/50 via-white to-emerald-50/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-green-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                ₹
              </div>
              <h3 className="font-display font-bold text-gray-900 text-xl">
                Net Return Price Discovery & Comparison
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                M5 Engine
              </span>
            </div>
            <p className="text-gray-500 text-xs">
              Comparing APMC Mandi prices vs Direct Verified Buyers factoring in freight, cess, and unloading.
            </p>
          </div>

          {/* Crop Selector Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_CROPS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCrop(c)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedCrop === c
                    ? 'bg-green-700 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-green-50'
                }`}
              >
                {c.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity Slider */}
        <div className="mt-6 pt-5 border-t border-gray-200/60 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-4">
            <label className="text-xs font-semibold text-gray-700 flex items-center justify-between">
              <span>Your Crop Batch Quantity:</span>
              <strong className="text-sm font-display text-green-700 font-bold">{quantity} Quintals</strong>
            </label>
            <p className="text-gray-400 text-[11px] mt-0.5">
              Approx. {(quantity * 100).toLocaleString()} kg · {(quantity * 0.1).toFixed(1)} Metric Tonnes
            </p>
          </div>
          <div className="md:col-span-8 flex items-center gap-4">
            <input
              type="range"
              min="50"
              max="2000"
              step="25"
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
              className="flex-1 accent-green-600 h-2 bg-gray-200 rounded-lg cursor-pointer"
            />
            <div className="flex gap-1.5 shrink-0">
              {[100, 250, 500, 1000].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQuantity(preset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                    quantity === preset
                      ? 'bg-green-100 border-green-300 text-green-800'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {preset}q
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner with Retry */}
      {errorMessage && (
        <div className="p-4 mx-6 mt-6 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={fetchMatrix}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-xs font-medium">
            Calculating net returns across APMC mandis & buyers for {selectedCrop}...
          </p>
        </div>
      ) : !matrixData || matrixData.options.length === 0 ? (
        /* Empty State */
        <div className="py-16 text-center text-gray-400">
          <p className="text-sm">No mandi or buyer price quotes found for "{selectedCrop}".</p>
          <button
            type="button"
            onClick={fetchMatrix}
            className="mt-3 px-4 py-1.5 text-xs text-green-700 font-semibold border border-green-200 rounded-xl hover:bg-green-50"
          >
            Retry Search
          </button>
        </div>
      ) : (
        <>
          {/* Net Gain Highlight Banner */}
          {matrixData.bestOption && matrixData.totalBenefit > 0 && (
            <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 p-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <p className="font-bold text-sm">
                    Maximum Profit Strategy: <span className="underline decoration-amber-300">{matrixData.bestOption.name}</span>
                  </p>
                  <p className="text-green-100 text-xs">
                    Net return of <strong className="text-white">₹{matrixData.bestOption.netPricePerQtl}/qtl</strong> gives you{' '}
                    <strong className="text-amber-200">+₹{matrixData.totalBenefit.toLocaleString()} extra in-hand</strong> compared to local APMC mandis!
                  </p>
                </div>
              </div>
              {onSelectBuyerOption && (
                <button
                  type="button"
                  onClick={() => onSelectBuyerOption(matrixData.bestOption)}
                  className="px-4 py-2 rounded-full bg-white text-green-800 font-bold text-xs hover:bg-green-50 shadow-md transition-all shrink-0 self-start sm:self-auto"
                >
                  Lock Deal Now →
                </button>
              )}
            </div>
          )}

          {/* Comparison Table */}
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-sm border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-gray-50/80 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="py-3 px-5">Market / Buyer</th>
                  <th className="py-3 px-4">Distance</th>
                  <th className="py-3 px-4">Gross Quoted</th>
                  <th className="py-3 px-4">Transport Deduction</th>
                  <th className="py-3 px-4">Mandi Cess & Unload</th>
                  <th className="py-3 px-4">Net Price / Qtl</th>
                  <th className="py-3 px-5 text-right">Total Net Return ({quantity}q)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
            {matrixData?.options.map((opt, i) => {
              const isDirectBuyer = opt.type === 'DIRECT_BUYER'
              return (
                <tr
                  key={opt.id}
                  className={`transition-colors ${
                    opt.isBest
                      ? 'bg-emerald-50/70 font-semibold'
                      : i % 2 === 0
                      ? 'bg-white'
                      : 'bg-gray-50/30'
                  } hover:bg-green-50/50`}
                >
                  {/* Name & Type */}
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{isDirectBuyer ? '🏢' : '🏛️'}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-gray-900 font-bold text-sm leading-tight">{opt.name}</p>
                          {opt.isBest && (
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">
                              BEST RETURN
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs mt-0.5">{opt.badge}</p>
                      </div>
                    </div>
                  </td>

                  {/* Distance */}
                  <td className="py-4 px-4 text-gray-600 text-xs">
                    {opt.distanceKm} km
                  </td>

                  {/* Gross Price */}
                  <td className="py-4 px-4 font-mono font-semibold text-gray-900 text-sm">
                    ₹{opt.grossPricePerQtl}
                  </td>

                  {/* Transport */}
                  <td className="py-4 px-4 text-xs font-mono">
                    {opt.transportCostPerQtl === 0 ? (
                      <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">
                        FREE PICKUP
                      </span>
                    ) : (
                      <span className="text-rose-600">-₹{opt.transportCostPerQtl}</span>
                    )}
                  </td>

                  {/* Cess / Tax */}
                  <td className="py-4 px-4 text-xs font-mono">
                    {opt.mandiCessPerQtl === 0 ? (
                      <span className="text-gray-400">₹0 (No Mandi Tax)</span>
                    ) : (
                      <span className="text-rose-600">-₹{opt.mandiCessPerQtl + opt.unloadingPerQtl}</span>
                    )}
                  </td>

                  {/* Net Price / Qtl */}
                  <td className="py-4 px-4">
                    <span
                      className={`font-display font-bold text-base ${
                        opt.isBest ? 'text-emerald-700 text-lg' : 'text-gray-800'
                      }`}
                    >
                      ₹{opt.netPricePerQtl}
                    </span>
                    <span className="text-gray-400 text-[10px] block">in-hand/qtl</span>
                  </td>

                  {/* Total Net Return */}
                  <td className="py-4 px-5 text-right">
                    <span
                      className={`font-display font-bold text-base ${
                        opt.isBest ? 'text-emerald-700 text-lg' : 'text-gray-900'
                      }`}
                    >
                      ₹{opt.totalNetReturn.toLocaleString()}
                    </span>
                    {onSelectBuyerOption && isDirectBuyer && (
                      <button
                        type="button"
                        onClick={() => onSelectBuyerOption(opt)}
                        className="mt-1 text-[11px] font-semibold text-green-700 hover:text-green-800 underline block ml-auto"
                      >
                        Send Request →
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
            </table>
          </div>
        </>
      )}

      {/* Footer Info Note */}
      <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <Info className="w-4 h-4 text-green-600 shrink-0" />
          <span>
            Net return factors in realistic freight cost (₹1.15–₹1.25/qtl/km) and official APMC market cess.
          </span>
        </div>
        <span className="font-mono text-green-700 font-semibold shrink-0">Updated 10m ago</span>
      </div>
    </div>
  )
}
