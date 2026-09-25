/**
 * M5 Data Contracts & Schemas
 * AgriBridge Farmer-Buyer Marketplace (SIH Project)
 * 
 * Provides standardized data models, JSDoc types, and factory/validation helpers.
 * Used across the API layer, pricing engine, and UI components.
 */

/**
 * @typedef {Object} Location
 * @property {string} address - Formatted address / village / district
 * @property {number} latitude - Decimal latitude coordinate
 * @property {number} longitude - Decimal longitude coordinate
 * @property {string} [district] - District name
 * @property {string} [state] - State name
 */

/**
 * @typedef {Object} Farmer
 * @property {string} id - Unique farmer identifier
 * @property {string} name - Farmer full name
 * @property {string} phone - Contact phone number
 * @property {Location} location - Farmer home/farm location
 * @property {'VERIFIED' | 'PARTIALLY_VERIFIED' | 'PENDING'} kycStatus - KYC compliance level
 * @property {number} trustScore - Score from 0 to 100
 * @property {number} farmSizeAcres - Total land holding in acres
 * @property {number} rating - Average user star rating (1.0 to 5.0)
 * @property {number} reviewsCount - Total verified deal reviews
 */

/**
 * @typedef {Object} Crop
 * @property {string} id - Crop ID
 * @property {string} name - Crop common name (e.g. Onion)
 * @property {string} [variety] - Specific cultivar (e.g. Nashik Red / Garwa)
 * @property {'Grains' | 'Vegetables' | 'Pulses' | 'Oilseeds' | 'Spices' | 'Fruits'} category - Commodity category
 * @property {string} standardUnit - Default trading unit (e.g. Quintal, Tonne)
 */

/**
 * @typedef {Object} InventoryBatch
 * @property {string} id - Unique batch listing ID
 * @property {string} farmerId - Owner farmer ID
 * @property {string} farmerName - Owner farmer name
 * @property {string} crop - Crop name and variety
 * @property {string} category - Crop category
 * @property {number} quantity - Available quantity
 * @property {string} unit - Measurement unit (Quintal, Tonne, Crates)
 * @property {number} basePrice - Minimum baseline reserve price (₹/unit)
 * @property {number} expectedPrice - Farmer target asking price (₹/unit)
 * @property {string} harvestDate - ISO date of harvest
 * @property {string} location - Village / farm location
 * @property {Location} [coordinates] - Geo coordinates
 * @property {string} qualityGrade - Grade designation (e.g. Grade A Export)
 * @property {number} moisturePercent - Moisture content percentage
 * @property {'ACTIVE' | 'IN_NEGOTIATION' | 'SOLD' | 'ARCHIVED'} status - Listing status
 * @property {boolean} verified - Whether verified by field agent
 */

/**
 * @typedef {Object} Buyer
 * @property {string} id - Unique buyer ID
 * @property {string} name - Registered business / entity name
 * @property {string} contactPerson - Primary contact name
 * @property {string} phone - Contact phone
 * @property {string} email - Business email
 * @property {string} type - Entity type (e.g. FPC, Modern Retail, Food Processor, Commission Agent)
 * @property {boolean} kycVerified - Whether KYC & GST verified
 * @property {string} verificationTier - Display badge tier
 * @property {number} trustScore - Trust score 0-100
 * @property {number} transactionsCompleted - Count of settled transactions
 * @property {string} location - City / logistics hub location
 * @property {number} latitude - Latitude coordinate
 * @property {number} longitude - Longitude coordinate
 * @property {number} distance - Distance in kilometers from farmer
 * @property {string[]} crops - Array of crops actively procured
 * @property {string} capacity - Monthly procurement capacity
 * @property {Record<string, number>} offeredPrices - Crop to quoted price (₹/unit) mapping
 * @property {string} paymentTerms - Settlement terms
 * @property {boolean} freightStatus - True if buyer provides free farmgate pickup
 * @property {number} freightRatePerKmQtl - Estimated freight rate ₹/km/qtl if farmer delivers
 */

/**
 * @typedef {Object} MandiPrice
 * @property {string} id - Unique APMC Mandi ID
 * @property {string} name - Official APMC market name
 * @property {string} crop - Crop name
 * @property {number} grossPrice - Gross trading modal rate (₹/qtl)
 * @property {number} distanceKm - Road distance from farmer's hub (km)
 * @property {number} mandiCessPercent - Official state APMC cess / tax %
 * @property {number} unloadingCostPerQtl - Handling and weighing charge per quintal (₹)
 * @property {string} lastUpdated - Last price update timestamp
 * @property {Location} [coordinates] - Mandi market yard coordinates
 */

/**
 * @typedef {Object} DealRequest
 * @property {string} [id] - Connection request ID (assigned by server)
 * @property {string} farmerId - Initiating / target farmer ID
 * @property {string} buyerId - Target / initiating buyer ID
 * @property {string} buyerName - Name of buyer
 * @property {string} [listingId] - Originating inventory batch ID
 * @property {string} crop - Crop name
 * @property {number} quantity - Quantity of commodity requested
 * @property {string} unit - Measurement unit
 * @property {number} quotedPrice - Target proposed rate (₹/unit)
 * @property {number} [farmerAskPrice] - Current counter/ask rate (₹/unit)
 * @property {'BUYER_ARRANGED_TRANSPORT' | 'FARMER_DELIVERY'} logisticsMethod - Logistics mode
 * @property {string} targetDate - Delivery / pickup date (YYYY-MM-DD)
 * @property {string} [message] - Special quality notes or instructions
 * @property {'PENDING' | 'NEGOTIATING' | 'ACCEPTED' | 'COMPLETED' | 'REJECTED'} status - State machine status
 */

/**
 * @typedef {Object} CounterOffer
 * @property {string} connectionId - Associated connection request ID
 * @property {number} counterPrice - Revised proposed price (₹/unit)
 * @property {string} actorRole - 'FARMER' or 'BUYER'
 * @property {string} [message] - Reason or notes for counter-offer
 */

/**
 * @typedef {Object} TransactionAudit
 * @property {string} timestamp - ISO timestamp of event
 * @property {'FARMER' | 'BUYER' | 'SYSTEM' | 'ESCROW'} actor - Party that performed the action
 * @property {string} action - Action title (e.g. 'Counter Offer Proposed', 'Deal Accepted')
 * @property {string} [oldStatus] - Previous status before transition
 * @property {string} [newStatus] - Updated status after transition
 * @property {number} [price] - Agreed or proposed unit price
 * @property {number} [quantity] - Commodity volume
 * @property {string} [message] - Audit note or reason
 */

/**
 * @typedef {Object} Connection
 * @property {string} id - Connection ID
 * @property {string} farmerId - Farmer ID
 * @property {string} buyerId - Buyer ID
 * @property {string} buyerName - Buyer business name
 * @property {string} crop - Crop name
 * @property {number} quantity - Batch volume
 * @property {string} unit - Unit
 * @property {number} quotedPrice - Initial agreed or requested price
 * @property {number} farmerAskPrice - Latest ask/counter rate
 * @property {'BUYER_ARRANGED_TRANSPORT' | 'FARMER_DELIVERY'} logisticsMethod - Logistics mode
 * @property {string} targetDate - Scheduled fulfillment date
 * @property {'PENDING' | 'NEGOTIATING' | 'ACCEPTED' | 'COMPLETED' | 'REJECTED'} status - State
 * @property {string} [message] - Instructions or batch notes
 * @property {TransactionAudit[]} auditTrail - Chronological event log
 * @property {boolean} verifiedDeal - Escrow protection flag
 */

/**
 * @typedef {Object} BuyerFilterQuery
 * @property {string} [crop] - Filter by crop name or 'ALL'
 * @property {number} [latitude] - Reference center latitude
 * @property {number} [longitude] - Reference center longitude
 * @property {number | 'ALL'} [radius] - Search radius in kilometers (e.g. 10, 25, 50, 100)
 * @property {boolean} [kycVerified] - Filter only KYC verified buyers
 * @property {number} [minTrustScore] - Minimum trust score (0-100)
 * @property {'DISTANCE' | 'TRUST' | 'PRICE'} [sortBy] - Sorting parameter
 */

/**
 * @typedef {Object} BuyerRequirement
 * @property {string} id - Unique requirement identifier (e.g. 'req-b-01')
 * @property {string} buyerId - Owner buyer ID
 * @property {string} buyerName - Name of purchasing entity
 * @property {string} crop - Target crop commodity
 * @property {string} [variety] - Required cultivar / specification
 * @property {string} category - Crop category
 * @property {number} requiredQty - Quantity required in quintals/tonnes
 * @property {string} unit - Measurement unit
 * @property {number} offeredPrice - Baseline purchase rate (₹/unit)
 * @property {number} [maxPrice] - Ceiling budget rate (₹/unit)
 * @property {string} targetDeliveryDate - Target fulfillment date
 * @property {string} qualityGrade - Grade requirement (e.g. Grade A Export)
 * @property {string} location - Delivery hub or warehouse location
 * @property {Location} [coordinates] - Delivery center coordinates
 * @property {'FREE_FARMGATE_PICKUP' | 'FARMER_DELIVERY'} freightTerms - Logistics requirement
 * @property {'OPEN' | 'PARTIALLY_MATCHED' | 'FULFILLED' | 'CLOSED'} status - Requirement status
 * @property {string} createdAt - Date created
 */

/**
 * @typedef {Object} MatchAnalysis
 * @property {number} matchScore - Overall match score (0-100)
 * @property {number} priceScore - Price alignment score
 * @property {number} distanceScore - Proximity score
 * @property {number} capacityScore - Quantity match score
 * @property {number} trustScore - Verification/trust score
 * @property {string[]} matchingReasons - Key match indicators
 */

// Model validation helpers
export function validateDealRequest(req) {
  const errors = {}
  if (!req.farmerId) errors.farmerId = 'Farmer ID is required'
  if (!req.buyerId) errors.buyerId = 'Buyer ID is required'
  if (!req.crop) errors.crop = 'Crop selection is required'
  if (!req.quantity || Number(req.quantity) <= 0) errors.quantity = 'Quantity must be greater than zero'
  if (!req.quotedPrice || Number(req.quotedPrice) <= 0) errors.quotedPrice = 'Quoted price must be greater than zero'
  if (!req.targetDate) errors.targetDate = 'Target fulfillment date is required'
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

export function validateBuyerRequirement(req) {
  const errors = {}
  if (!req.buyerId) errors.buyerId = 'Buyer ID is required'
  if (!req.crop) errors.crop = 'Crop is required'
  if (!req.requiredQty || Number(req.requiredQty) <= 0) errors.requiredQty = 'Quantity must be greater than zero'
  if (!req.offeredPrice || Number(req.offeredPrice) <= 0) errors.offeredPrice = 'Offered price must be greater than zero'
  if (!req.location) errors.location = 'Procurement location is required'
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

