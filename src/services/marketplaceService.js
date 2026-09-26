/**
 * Centralized Marketplace API Service
 * AgriBridge Farmer-Buyer Marketplace (SIH Project M5)
 * 
 * Reusable backend-ready service functions with:
 * - Direct HTTP calls via apiClient to backend endpoints
 * - Transparent fallback to mockMarketplaceData if backend is unavailable
 * - Reusable pricing calculations via pricingEngine
 * - Type validation using contracts.js
 */

import { apiClient } from './apiClient'
import {
  MOCK_FARMER_PROFILE,
  MOCK_INVENTORY_BATCHES,
  MOCK_VERIFIED_BUYERS,
  MOCK_REGIONAL_MANDIS,
  MOCK_INITIAL_CONNECTIONS,
  STORAGE_KEY_LISTINGS,
  STORAGE_KEY_REQUESTS,
  getStoredData,
  setStoredData,
} from './mockMarketplaceData'
import { buildPriceComparison } from '../utils/pricingEngine'
import { validateDealRequest } from '../types/contracts'

export const marketplaceService = {
  // =========================================================================
  // 1. Farmer Profile & Inventory Endpoints
  // =========================================================================

  /**
   * Fetches farmer profile and KYC status
   * Backend Endpoint: GET /api/farmers/:farmerId
   * @param {string} [farmerId='frm-01']
   */
  async getFarmerProfile(farmerId = 'frm-01') {
    try {
      if (apiClient.isConfigured()) {
        return await apiClient.get(`farmers/${farmerId}`)
      }
    } catch (err) {
      if (!apiClient.shouldFallback()) throw err
      console.warn('[marketplaceService] Backend offline, using mock farmer profile:', err.message)
    }

    // Mock Fallback
    await new Promise(r => setTimeout(r, 40))
    return { ...MOCK_FARMER_PROFILE, id: farmerId }
  },

  /**
   * Fetches all inventory batches for a farmer
   * Backend Endpoint: GET /api/farmers/:farmerId/inventory
   * @param {string} [farmerId='frm-01']
   */
  async getFarmerInventory(farmerId = 'frm-01') {
    try {
      if (apiClient.isConfigured()) {
        return await apiClient.get(`farmers/${farmerId}/inventory`)
      }
    } catch (err) {
      if (!apiClient.shouldFallback()) throw err
      console.warn('[marketplaceService] Backend offline, using mock inventory:', err.message)
    }

    await new Promise(r => setTimeout(r, 50))
    return getStoredData(STORAGE_KEY_LISTINGS, MOCK_INVENTORY_BATCHES)
  },

  /**
   * Creates a new crop inventory batch
   * Backend Endpoint: POST /api/farmers/:farmerId/inventory
   * @param {Object} batchData
   */
  async addCropListing(batchData) {
    try {
      if (apiClient.isConfigured()) {
        return await apiClient.post(`farmers/${batchData.farmerId || 'frm-01'}/inventory`, batchData)
      }
    } catch (err) {
      if (!apiClient.shouldFallback()) throw err
      console.warn('[marketplaceService] Backend offline, saving batch to local storage:', err.message)
    }

    await new Promise(r => setTimeout(r, 60))
    const listings = getStoredData(STORAGE_KEY_LISTINGS, MOCK_INVENTORY_BATCHES)
    const newListing = {
      id: `lst-${Date.now().toString().slice(-4)}`,
      farmerId: 'frm-01',
      farmerName: 'Ramesh Patil',
      crop: batchData.crop || 'Wheat',
      variety: batchData.variety || 'Standard Grade',
      category: batchData.category || 'Grains',
      quantity: Number(batchData.quantity || 100),
      unit: batchData.unit || 'Quintal',
      basePrice: Number(batchData.basePrice || 1200),
      expectedPrice: Number(batchData.expectedPrice || 1300),
      harvestDate: batchData.harvestDate || new Date().toISOString().split('T')[0],
      location: batchData.location || 'Nashik, Maharashtra',
      coordinates: { latitude: 20.0, longitude: 73.8 },
      qualityGrade: batchData.qualityGrade || 'Grade A',
      moisturePercent: Number(batchData.moisturePercent || 11.5),
      status: 'ACTIVE',
      verified: true,
    }

    listings.unshift(newListing)
    setStoredData(STORAGE_KEY_LISTINGS, listings)
    return newListing
  },

  /**
   * Unified farmer dashboard summary
   */
  async getFarmerDashboard(farmerId = 'frm-01') {
    const [farmer, listings, requests] = await Promise.all([
      this.getFarmerProfile(farmerId),
      this.getFarmerInventory(farmerId),
      this.getConnections(farmerId),
    ])

    const activeListings = listings.filter(l => l.status === 'ACTIVE' || l.status === 'IN_NEGOTIATION')
    const totalQtl = activeListings.reduce((sum, l) => sum + Number(l.quantity), 0)
    const potentialEarnings = activeListings.reduce(
      (sum, l) => sum + Number(l.quantity) * Number(l.expectedPrice),
      0
    )
    const pendingRequests = requests.filter(r => r.status === 'PENDING').length
    const activeDeals = requests.filter(r => r.status === 'ACCEPTED' || r.status === 'NEGOTIATING').length

    return {
      farmer,
      stats: {
        activeListingsCount: activeListings.length,
        totalStockQuintals: totalQtl,
        potentialRevenue: potentialEarnings,
        pendingRequestsCount: pendingRequests,
        activeDealsCount: activeDeals,
        completedTransactions: 36,
      },
      listings,
      requests,
    }
  },

  // =========================================================================
  // 2. Buyer Discovery & Hyperlocal Radar Endpoints
  // =========================================================================

  /**
   * Fetches verified buyers with structured filter query
   * Backend Endpoint: GET /api/buyers/nearby
   * @param {import('../types/contracts').BuyerFilterQuery} params
   */
  async getNearbyBuyers(params = {}) {
    const query = {
      crop: params.crop && params.crop !== 'ALL' ? params.crop : undefined,
      radius: params.radius && params.radius !== 'ALL' ? params.radius : undefined,
      kycVerified: params.kycVerified ? true : undefined,
      minTrustScore: params.minTrustScore,
      sortBy: params.sortBy || 'DISTANCE',
      latitude: params.latitude,
      longitude: params.longitude,
    }

    try {
      if (apiClient.isConfigured()) {
        return await apiClient.get('buyers/nearby', query)
      }
    } catch (err) {
      if (!apiClient.shouldFallback()) throw err
      console.warn('[marketplaceService] Backend offline, applying client-side filtering on mock buyers:', err.message)
    }

    // Mock query processing
    await new Promise(r => setTimeout(r, 60))
    let results = MOCK_VERIFIED_BUYERS.map((b, idx) => {
      const buyerCopy = { ...b }
      // If custom farmer coordinates provided, calculate or simulate realistic local distances
      if (typeof query.latitude === 'number' && typeof query.longitude === 'number') {
        // Deterministic angle & distance for buyers relative to farmer's custom coordinates
        const relativeDistances = [8, 14, 22, 38, 55, 74]
        const d = relativeDistances[idx % relativeDistances.length]
        const angle = (idx * 60 + 25) * (Math.PI / 180)
        const latOffset = (d / 111) * Math.sin(angle)
        const lngOffset = (d / (111 * Math.cos(query.latitude * (Math.PI / 180)))) * Math.cos(angle)
        
        buyerCopy.distance = d
        buyerCopy.distanceKm = d
        buyerCopy.latitude = +(query.latitude + latOffset).toFixed(4)
        buyerCopy.longitude = +(query.longitude + lngOffset).toFixed(4)
      }
      return buyerCopy
    })

    if (query.crop) {
      const searchCrop = query.crop.trim().toLowerCase()
      // First try to find buyers who already buy this crop
      const matched = results.filter(b =>
        b.crops.some(c => c.toLowerCase().includes(searchCrop) || searchCrop.includes(c.toLowerCase()))
      )
      if (matched.length > 0) {
        results = matched
      } else {
        // Dynamically assign this crop to nearby buyers with an estimated market price
        results = results.slice(0, 5).map(b => ({
          ...b,
          crops: [query.crop, ...b.crops],
          offeredPrices: {
            ...b.offeredPrices,
            [query.crop]: Math.round(2100 + (b.trustScore * 5))
          }
        }))
      }
    }

    if (query.radius) {
      const maxKm = Number(query.radius)
      results = results.filter(b => (b.distance || b.distanceKm || 0) <= maxKm)
    }

    if (query.kycVerified) {
      results = results.filter(b => b.kycVerified)
    }

    if (query.minTrustScore) {
      results = results.filter(b => b.trustScore >= Number(query.minTrustScore))
    }

    if (query.sortBy === 'DISTANCE') {
      results.sort((a, b) => a.distance - b.distance)
    } else if (query.sortBy === 'TRUST') {
      results.sort((a, b) => b.trustScore - a.trustScore)
    } else if (query.sortBy === 'PRICE' && query.crop) {
      results.sort((a, b) => {
        const pA = a.offeredPrices[query.crop] || 0
        const pB = b.offeredPrices[query.crop] || 0
        return pB - pA
      })
    }

    return results
  },

  // Backward compatibility alias for getNearbyBuyers
  async getBuyers(filters = {}) {
    return this.getNearbyBuyers({
      crop: filters.crop,
      radius: filters.maxDistanceKm,
      kycVerified: filters.verifiedOnly,
      minTrustScore: filters.minTrustScore,
      sortBy: filters.sortBy,
    })
  },

  /**
   * Fetches single buyer details
   * Backend Endpoint: GET /api/buyers/:buyerId
   * @param {string} buyerId
   */
  async getBuyerDetails(buyerId) {
    try {
      if (apiClient.isConfigured()) {
        return await apiClient.get(`buyers/${buyerId}`)
      }
    } catch (err) {
      if (!apiClient.shouldFallback()) throw err
      console.warn('[marketplaceService] Backend offline, returning mock buyer details:', err.message)
    }

    await new Promise(r => setTimeout(r, 30))
    const found = MOCK_VERIFIED_BUYERS.find(b => b.id === buyerId)
    if (!found) throw new Error(`Buyer not found: ${buyerId}`)
    return found
  },

  // =========================================================================
  // 3. Mandi Benchmarks & Pricing Calculation
  // =========================================================================

  /**
   * Fetches latest APMC Mandi rates
   * Backend Endpoint: GET /api/prices/mandi
   * @param {Object} [params]
   */
  async getMandiPrices(params = {}) {
    try {
      if (apiClient.isConfigured()) {
        return await apiClient.get('prices/mandi', params)
      }
    } catch (err) {
      if (!apiClient.shouldFallback()) throw err
      console.warn('[marketplaceService] Backend offline, returning mock mandi rates:', err.message)
    }

    await new Promise(r => setTimeout(r, 40))
    return MOCK_REGIONAL_MANDIS
  },

  /**
   * Price Comparison Matrix decoupled into calculation engine
   * Combines raw mandi and buyer quotes with pricingEngine
   */
  async getPriceComparisonMatrix(cropName = 'Onion (Nashik Red)', quantityQtl = 100, userKm = 0) {
    const [mandis, buyers] = await Promise.all([
      this.getMandiPrices({ crop: cropName }),
      this.getNearbyBuyers({ crop: cropName }),
    ])

    // Compute net-return matrix through pricingEngine
    return buildPriceComparison({
      crop: cropName,
      quantityQtl,
      mandis,
      buyers,
      userAdditionalKm: userKm,
    })
  },

  // =========================================================================
  // 4. Connection State Machine & Deal Requests
  // =========================================================================

  /**
   * Fetches all connection requests for a farmer
   * Backend Endpoint: GET /api/connections
   * @param {string} [farmerId='frm-01']
   */
  async getConnections(farmerId = 'frm-01') {
    try {
      if (apiClient.isConfigured()) {
        return await apiClient.get('connections', { farmerId })
      }
    } catch (err) {
      if (!apiClient.shouldFallback()) throw err
      console.warn('[marketplaceService] Backend offline, returning mock connections:', err.message)
    }

    await new Promise(r => setTimeout(r, 50))
    return getStoredData(STORAGE_KEY_REQUESTS, MOCK_INITIAL_CONNECTIONS)
  },

  /**
   * Fetches single connection details
   * Backend Endpoint: GET /api/connections/:connectionId
   * @param {string} connectionId
   */
  async getConnectionDetails(connectionId) {
    try {
      if (apiClient.isConfigured()) {
        return await apiClient.get(`connections/${connectionId}`)
      }
    } catch (err) {
      if (!apiClient.shouldFallback()) throw err
      console.warn('[marketplaceService] Backend offline, returning mock connection detail:', err.message)
    }

    await new Promise(r => setTimeout(r, 30))
    const list = getStoredData(STORAGE_KEY_REQUESTS, MOCK_INITIAL_CONNECTIONS)
    const found = list.find(c => c.id === connectionId)
    if (!found) throw new Error(`Connection not found: ${connectionId}`)
    return found
  },

  /**
   * Submits a new Deal Request
   * Backend Endpoint: POST /api/connections
   * @param {import('../types/contracts').DealRequest} data
   */
  async createDealRequest(data) {
    const validation = validateDealRequest(data)
    if (!validation.isValid) {
      throw new Error(`Validation Error: ${Object.values(validation.errors).join(', ')}`)
    }

    try {
      if (apiClient.isConfigured()) {
        return await apiClient.post('connections', data)
      }
    } catch (err) {
      if (!apiClient.shouldFallback()) throw err
      console.warn('[marketplaceService] Backend offline, storing connection locally:', err.message)
    }

    await new Promise(r => setTimeout(r, 90))
    const requests = getStoredData(STORAGE_KEY_REQUESTS, MOCK_INITIAL_CONNECTIONS)
    const newReq = {
      id: `req-${Date.now().toString().slice(-5)}`,
      farmerId: data.farmerId || 'frm-01',
      buyerId: data.buyerId,
      buyerName: data.buyerName,
      crop: data.crop,
      quantity: Number(data.quantity),
      unit: data.unit || 'Quintal',
      quotedPrice: Number(data.quotedPrice),
      farmerAskPrice: Number(data.farmerAskPrice || data.quotedPrice),
      logisticsMethod: data.logisticsMethod || 'BUYER_ARRANGED_TRANSPORT',
      targetDate: data.targetDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      status: 'PENDING',
      message: data.message || '',
      auditTrail: [
        {
          timestamp: new Date().toISOString(),
          actor: 'FARMER',
          action: 'Connection Request Initiated',
          oldStatus: null,
          newStatus: 'PENDING',
          price: Number(data.quotedPrice),
          quantity: Number(data.quantity),
          message: data.message || 'Direct farmer proposal submitted.',
        },
      ],
      verifiedDeal: true,
    }

    requests.unshift(newReq)
    setStoredData(STORAGE_KEY_REQUESTS, requests)
    return newReq
  },

  // Backward compatibility alias
  async sendConnectionRequest(params) {
    return this.createDealRequest({
      farmerId: params.farmerId,
      buyerId: params.buyerId,
      buyerName: params.buyerName,
      crop: params.crop,
      quantity: params.requestedQty,
      unit: params.unit,
      quotedPrice: params.offeredPrice,
      farmerAskPrice: params.farmerAskPrice,
      logisticsMethod: params.pickupType,
      targetDate: params.expectedDate,
      message: params.notes,
    })
  },

  /**
   * Submits a counter-offer
   * Backend Endpoint: POST /api/connections/:connectionId/counter-offer
   * @param {string} connectionId
   * @param {number} counterPrice
   * @param {string} [message]
   */
  async submitCounterOffer(connectionId, counterPrice, message = '') {
    const payload = {
      counterPrice: Number(counterPrice),
      actorRole: 'FARMER',
      message,
    }

    try {
      if (apiClient.isConfigured()) {
        return await apiClient.post(`connections/${connectionId}/counter-offer`, payload)
      }
    } catch (err) {
      if (!apiClient.shouldFallback()) throw err
      console.warn('[marketplaceService] Backend offline, applying counter-offer locally:', err.message)
    }

    return this.updateConnectionStatus(connectionId, 'NEGOTIATE', { counterPrice, message })
  },

  /**
   * Accepts a deal
   * Backend Endpoint: POST /api/connections/:connectionId/accept
   * @param {string} connectionId
   */
  async acceptDeal(connectionId) {
    try {
      if (apiClient.isConfigured()) {
        return await apiClient.post(`connections/${connectionId}/accept`, {})
      }
    } catch (err) {
      if (!apiClient.shouldFallback()) throw err
      console.warn('[marketplaceService] Backend offline, accepting deal locally:', err.message)
    }

    return this.updateConnectionStatus(connectionId, 'ACCEPT')
  },

  /**
   * Completes a deal & marks escrow as settled
   * Backend Endpoint: POST /api/connections/:connectionId/complete
   * @param {string} connectionId
   */
  async completeDeal(connectionId) {
    try {
      if (apiClient.isConfigured()) {
        return await apiClient.post(`connections/${connectionId}/complete`, {})
      }
    } catch (err) {
      if (!apiClient.shouldFallback()) throw err
      console.warn('[marketplaceService] Backend offline, completing deal locally:', err.message)
    }

    return this.updateConnectionStatus(connectionId, 'COMPLETE')
  },

  /**
   * Internal status updater for connection lifecycle state machine
   * @param {string} connectionId
   * @param {'ACCEPT' | 'REJECT' | 'NEGOTIATE' | 'COMPLETE'} action
   * @param {Object} [payload]
   */
  async updateConnectionStatus(connectionId, action, payload = {}) {
    await new Promise(r => setTimeout(r, 60))
    const requests = getStoredData(STORAGE_KEY_REQUESTS, MOCK_INITIAL_CONNECTIONS)
    const idx = requests.findIndex(r => r.id === connectionId)
    if (idx === -1) throw new Error(`Connection request not found: ${connectionId}`)

    const req = requests[idx]
    const timestamp = new Date().toISOString()
    const oldStatus = req.status

    if (action === 'ACCEPT') {
      req.status = 'ACCEPTED'
      req.auditTrail.push({
        timestamp,
        actor: 'FARMER',
        action: 'Deal Accepted & Price Locked',
        oldStatus,
        newStatus: 'ACCEPTED',
        price: req.farmerAskPrice || req.quotedPrice,
        quantity: req.quantity,
        message: 'Farmer agreed to proposed terms.',
      })
    } else if (action === 'REJECT') {
      req.status = 'REJECTED'
      req.auditTrail.push({
        timestamp,
        actor: 'FARMER',
        action: 'Deal Declined',
        oldStatus,
        newStatus: 'REJECTED',
        message: payload.message || 'Declined by farmer.',
      })
    } else if (action === 'NEGOTIATE') {
      req.status = 'NEGOTIATING'
      if (payload.counterPrice) {
        req.farmerAskPrice = Number(payload.counterPrice)
      }
      req.auditTrail.push({
        timestamp,
        actor: 'FARMER',
        action: 'Counter-Offer Proposed',
        oldStatus,
        newStatus: 'NEGOTIATING',
        price: Number(payload.counterPrice),
        quantity: req.quantity,
        message: payload.message || `Counter-offer of ₹${payload.counterPrice}/qtl proposed.`,
      })
    } else if (action === 'COMPLETE') {
      req.status = 'COMPLETED'
      req.auditTrail.push({
        timestamp,
        actor: 'ESCROW',
        action: 'Weighment Verified & Payment Disbursed',
        oldStatus,
        newStatus: 'COMPLETED',
        price: req.farmerAskPrice || req.quotedPrice,
        quantity: req.quantity,
        message: 'Transaction successfully closed.',
      })
    }

    requests[idx] = req
    setStoredData(STORAGE_KEY_REQUESTS, requests)
    return req
  },

  /**
   * Fetches full audit trail for a connection
   * Backend Endpoint: GET /api/connections/:connectionId/audit
   * @param {string} connectionId
   */
  async getTransactionAudit(connectionId) {
    const conn = await this.getConnectionDetails(connectionId)
    return conn.auditTrail || []
  },
}
