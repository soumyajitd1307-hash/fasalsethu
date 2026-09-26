/**
 * buyerDatabase.js
 * ─────────────────────────────────────────────────────────────────
 * localStorage-based buyer registry for Fasal Sethu.
 * Acts as the "database" in this frontend-only application.
 * All buyer data (name, company, crops, location + lat/lng) is
 * persisted in localStorage and searchable by geographic radius.
 */

import { resolveLocationCoords } from '../utils/geoLookup'

const STORAGE_KEY = 'fasalsethu_buyers'
const SESSION_KEY = 'fasalsethu_current_buyer'

// ── Haversine great-circle distance (km) ───────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function generateId() {
  return 'buyer_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

// ── Seed buyers (first-launch only) ────────────────────────────────
const SEED_BUYERS = [
  {
    buyerId: 'buyer_seed_001',
    name: 'Rajesh Kumar',
    companyName: 'ABC Agro Traders',
    phone: '9876543210',
    email: 'rajesh@abcagro.com',
    cropsRequired: ['Rice', 'Wheat'],
    requiredQuantity: 1000,
    unit: 'quintal',
    location: {
      address: 'Pune, Maharashtra, India',
      latitude: 18.5204,
      longitude: 73.8567,
    },
    createdAt: Date.now() - 86400000 * 3,
    passwordHash: 'seed',
  },
  {
    buyerId: 'buyer_seed_002',
    name: 'Priya Agro Exports',
    companyName: 'Priya Agro Exports Pvt Ltd',
    phone: '9823456789',
    email: 'priya@agroxports.in',
    cropsRequired: ['Onion', 'Tomato', 'Potato'],
    requiredQuantity: 500,
    unit: 'quintal',
    location: {
      address: 'Nashik, Maharashtra, India',
      latitude: 19.9975,
      longitude: 73.7898,
    },
    createdAt: Date.now() - 86400000 * 7,
    passwordHash: 'seed',
  },
  {
    buyerId: 'buyer_seed_003',
    name: 'Suresh Grain Merchants',
    companyName: 'Suresh Grain Merchants',
    phone: '9012345678',
    email: 'suresh@grainmerchants.com',
    cropsRequired: ['Wheat', 'Maize', 'Soybean'],
    requiredQuantity: 2000,
    unit: 'quintal',
    location: {
      address: 'Indore, Madhya Pradesh, India',
      latitude: 22.7196,
      longitude: 75.8577,
    },
    createdAt: Date.now() - 86400000 * 14,
    passwordHash: 'seed',
  },
  {
    buyerId: 'buyer_seed_004',
    name: 'Kavita Cotton Mills',
    companyName: 'Kavita Cotton Mills Ltd',
    phone: '9145678900',
    email: 'kavita@cottonmills.in',
    cropsRequired: ['Cotton', 'Soybean'],
    requiredQuantity: 3000,
    unit: 'quintal',
    location: {
      address: 'Nagpur, Maharashtra, India',
      latitude: 21.1458,
      longitude: 79.0882,
    },
    createdAt: Date.now() - 86400000 * 5,
    passwordHash: 'seed',
  },
  {
    buyerId: 'buyer_seed_005',
    name: 'Delhi Fresh Exports',
    companyName: 'Delhi Fresh Exports Pvt Ltd',
    phone: '9811234567',
    email: 'delhifresh@exports.in',
    cropsRequired: ['Onion', 'Garlic', 'Ginger'],
    requiredQuantity: 800,
    unit: 'quintal',
    location: {
      address: 'Delhi, India',
      latitude: 28.6139,
      longitude: 77.2090,
    },
    createdAt: Date.now() - 86400000 * 2,
    passwordHash: 'seed',
  },
]

// ── Internal helpers ────────────────────────────────────────────────
function initStorage() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_BUYERS))
  }
}

export function getAllBuyers() {
  initStorage()
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}

function saveBuyers(buyers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buyers))
}

// ── Public API ──────────────────────────────────────────────────────

/** Get a single buyer by ID */
export function getBuyerById(buyerId) {
  return getAllBuyers().find((b) => b.buyerId === buyerId) || null
}

/**
 * Register a new buyer.
 * Geocodes the manually entered location and stores lat/lng.
 * Returns the full buyer object with generated ID.
 */
export async function registerBuyer(data) {
  const coords = await resolveLocationCoords(data.location)

  const cropsArray = Array.isArray(data.cropsRequired)
    ? data.cropsRequired
    : String(data.cropsRequired || '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)

  const newBuyer = {
    buyerId: generateId(),
    name: data.name,
    companyName: data.companyName || '',
    phone: data.phone || '',
    email: data.email || '',
    cropsRequired: cropsArray,
    requiredQuantity: Number(data.requiredQuantity) || 0,
    unit: data.unit || 'quintal',
    location: {
      address: coords.name || data.location,
      latitude: coords.lat,
      longitude: coords.lng,
    },
    createdAt: Date.now(),
    // Never store plain-text passwords; this is a demo hash
    passwordHash: 'mock_' + btoa(encodeURIComponent(data.password || '')).slice(0, 16),
  }

  const buyers = getAllBuyers()
  buyers.push(newBuyer)
  saveBuyers(buyers)

  // Persist session
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      buyerId: newBuyer.buyerId,
      name: newBuyer.name,
      companyName: newBuyer.companyName,
      email: newBuyer.email,
    })
  )

  return newBuyer
}

/**
 * Update an existing buyer's location.
 * Geocodes the new address and refreshes lat/lng in the DB.
 */
export async function updateBuyerLocation(buyerId, newLocationStr) {
  const coords = await resolveLocationCoords(newLocationStr)
  const buyers = getAllBuyers()
  const idx = buyers.findIndex((b) => b.buyerId === buyerId)
  if (idx === -1) throw new Error('Buyer not found')

  buyers[idx].location = {
    address: coords.name || newLocationStr,
    latitude: coords.lat,
    longitude: coords.lng,
  }
  saveBuyers(buyers)
  return buyers[idx]
}

/**
 * Search registered buyers near a given location string.
 * Geocodes the search query, then returns all buyers within `radiusKm`.
 * Each result includes a `distanceKm` field.
 *
 * @param {string} locationStr  - e.g. "Pune" or "Nashik, Maharashtra"
 * @param {number} radiusKm     - Search radius in kilometres (default 100)
 * @returns {{ buyers: Array, center: { lat, lng, name } }}
 */
export async function searchBuyersByLocation(locationStr, radiusKm = 100) {
  const center = await resolveLocationCoords(locationStr)
  const buyers = getAllBuyers()

  const results = buyers
    .map((buyer) => {
      const dist = haversineKm(
        center.lat,
        center.lng,
        buyer.location.latitude,
        buyer.location.longitude
      )
      return { ...buyer, distanceKm: Math.round(dist * 10) / 10 }
    })
    .filter((b) => b.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)

  return { buyers: results, center }
}

/**
 * Simulate buyer login.
 * In production this would validate against a real backend.
 */
export function loginBuyer(emailOrGstin, _password) {
  const buyers = getAllBuyers()
  const buyer = buyers.find(
    (b) => b.email?.toLowerCase() === emailOrGstin.toLowerCase()
  )
  if (!buyer) return null

  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      buyerId: buyer.buyerId,
      name: buyer.name,
      companyName: buyer.companyName,
      email: buyer.email,
    })
  )
  return buyer
}

/** Get the currently logged-in buyer from session */
export function getCurrentBuyer() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Log out the current buyer */
export function logoutBuyer() {
  sessionStorage.removeItem(SESSION_KEY)
}
