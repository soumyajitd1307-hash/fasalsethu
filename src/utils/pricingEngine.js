/**
 * Pricing Engine & Net Return Calculator
 * 
 * Separates raw marketplace data from mathematical calculation and presentation.
 * Computes take-home net return for farmers factoring in:
 * - Gross quoted rate (₹/qtl)
 * - Freight deductions based on road distance and freight rate per km
 * - APMC state market cess & committee fees
 * - Weighing, unloading, and labor charges
 * - Volume projections across batch quantities
 */

export const DEFAULT_FREIGHT_RATE_PER_KM_QTL = 1.20 // Standard regional mini-truck freight rate

/**
 * Calculates net return per quintal for a single destination (Mandi or Buyer)
 * 
 * Formula:
 * Net Price/Qtl = Gross Quote - Transport Deduction - Mandi Cess - Unloading Fees
 * 
 * @param {Object} params
 * @param {number} params.grossPrice - Gross quoted price per quintal (₹)
 * @param {number} params.distanceKm - Road distance from farm gate in km
 * @param {number} [params.freightRatePerKm=1.20] - Freight rate in ₹/km/quintal
 * @param {boolean} [params.isFreePickup=false] - True if buyer covers transport
 * @param {number} [params.mandiCessPercent=0] - State APMC cess percentage (e.g. 1.5%)
 * @param {number} [params.unloadingCostPerQtl=0] - Unloading & weighment fee per quintal (₹)
 * @returns {Object} Complete breakdown of deductions and net take-home rate
 */
export function calculateNetReturn({
  grossPrice,
  distanceKm,
  freightRatePerKm = DEFAULT_FREIGHT_RATE_PER_KM_QTL,
  isFreePickup = false,
  mandiCessPercent = 0,
  unloadingCostPerQtl = 0,
}) {
  const safeGross = Math.max(0, Number(grossPrice) || 0)
  const safeKm = Math.max(0, Number(distanceKm) || 0)
  const safeFreightRate = Math.max(0, Number(freightRatePerKm) || DEFAULT_FREIGHT_RATE_PER_KM_QTL)

  // If buyer provides transport, farmer transport deduction is ₹0
  const transportDeductionPerQtl = isFreePickup ? 0 : Math.round(safeKm * safeFreightRate)

  // APMC Mandi Cess is calculated as a percentage of gross value
  const mandiCessDeductionPerQtl = Math.round(safeGross * (Number(mandiCessPercent || 0) / 100))

  const unloadingDeductionPerQtl = Math.round(Number(unloadingCostPerQtl) || 0)

  const totalDeductionsPerQtl =
    transportDeductionPerQtl + mandiCessDeductionPerQtl + unloadingDeductionPerQtl

  const netPricePerQtl = Math.max(0, safeGross - totalDeductionsPerQtl)

  return {
    grossPricePerQtl: safeGross,
    distanceKm: safeKm,
    transportDeductionPerQtl,
    mandiCessDeductionPerQtl,
    unloadingDeductionPerQtl,
    totalDeductionsPerQtl,
    netPricePerQtl,
  }
}

/**
 * Computes batch valuation and compares Mandis vs Direct Buyers
 * 
 * @param {string} crop
 * @param {number} quantityQtl - Quantity in quintals
 * @param {Array} mandis - Array of Mandi raw data objects
 * @param {Array} buyers - Array of Buyer raw data objects
 * @param {number} [userAdditionalKm=0] - Extra distance offset from base hub
 * @returns {Object} Ranked options, best choice, and dynamic net profit gain
 */
export function buildPriceComparison({
  crop,
  quantityQtl = 100,
  mandis = [],
  buyers = [],
  userAdditionalKm = 0,
}) {
  const safeQty = Math.max(1, Number(quantityQtl) || 1)

  // 1. Process Mandis
  const mandiRows = mandis
    .filter(m => m.prices && m.prices[crop])
    .map(m => {
      const gross = m.prices[crop]
      const totalKm = m.distanceKm + userAdditionalKm
      const calc = calculateNetReturn({
        grossPrice: gross,
        distanceKm: totalKm,
        freightRatePerKm: DEFAULT_FREIGHT_RATE_PER_KM_QTL,
        isFreePickup: false,
        mandiCessPercent: m.mandiCessPercent || 1.5,
        unloadingCostPerQtl: m.unloadingCostPerQtl || 25,
      })

      const totalNetReturn = calc.netPricePerQtl * safeQty

      return {
        id: m.id,
        type: 'MANDI',
        name: m.name,
        distanceKm: totalKm,
        grossPricePerQtl: calc.grossPricePerQtl,
        transportCostPerQtl: calc.transportDeductionPerQtl,
        mandiCessPerQtl: calc.mandiCessDeductionPerQtl,
        unloadingPerQtl: calc.unloadingDeductionPerQtl,
        totalDeductionsPerQtl: calc.totalDeductionsPerQtl,
        netPricePerQtl: calc.netPricePerQtl,
        totalNetReturn,
        paymentMode: 'Mandi Commission Slip (3–7 Days)',
        reliability: 'APMC Regulated Market',
        badge: 'REGULATED MANDI',
        isBest: false,
      }
    })

  // 2. Process Direct Buyers
  const buyerRows = buyers
    .filter(b => b.crops && b.crops.some(c => c.toLowerCase().includes(crop.toLowerCase())))
    .map(b => {
      // Find matching price
      const matchingKey = Object.keys(b.offeredPrices || {}).find(k =>
        k.toLowerCase().includes(crop.toLowerCase())
      )
      const gross = matchingKey ? b.offeredPrices[matchingKey] : 0
      if (!gross) return null

      const totalKm = b.distance + userAdditionalKm
      const calc = calculateNetReturn({
        grossPrice: gross,
        distanceKm: totalKm,
        freightRatePerKm: b.freightRatePerKmQtl || DEFAULT_FREIGHT_RATE_PER_KM_QTL,
        isFreePickup: Boolean(b.freightStatus),
        mandiCessPercent: 0, // Direct procurement has zero APMC cess
        unloadingCostPerQtl: 0,
      })

      const totalNetReturn = calc.netPricePerQtl * safeQty

      return {
        id: b.id,
        type: 'DIRECT_BUYER',
        name: b.name,
        distanceKm: totalKm,
        grossPricePerQtl: calc.grossPricePerQtl,
        transportCostPerQtl: calc.transportDeductionPerQtl,
        mandiCessPerQtl: 0,
        unloadingPerQtl: 0,
        totalDeductionsPerQtl: calc.totalDeductionsPerQtl,
        netPricePerQtl: calc.netPricePerQtl,
        totalNetReturn,
        paymentMode: b.paymentTerms || 'Bank transfer',
        reliability: `${b.trustScore}% Trust Score (${b.transactionsCompleted} deals)`,
        badge: b.freightStatus ? 'FREE FARM PICKUP' : 'DIRECT VERIFIED BUYER',
        isBest: false,
      }
    })
    .filter(Boolean)

  const allRows = [...buyerRows, ...mandiRows]
  allRows.sort((a, b) => b.netPricePerQtl - a.netPricePerQtl)

  if (allRows.length > 0) {
    allRows[0].isBest = true
  }

  const bestOption = allRows[0] || null
  const baselineMandi = mandiRows[0] || allRows[allRows.length - 1] || null

  const netBenefitPerQtl =
    bestOption && baselineMandi
      ? Math.max(0, bestOption.netPricePerQtl - baselineMandi.netPricePerQtl)
      : 0

  const totalBenefit = netBenefitPerQtl * safeQty

  return {
    crop,
    quantityQtl: safeQty,
    options: allRows,
    bestOption,
    baselineMandi,
    netBenefitPerQtl,
    totalBenefit,
  }
}
