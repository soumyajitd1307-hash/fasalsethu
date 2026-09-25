# AgriBridge M5: Farmer-Buyer Architecture & API Contract Specification

> **Version:** 1.0.0-rc  
> **Target Release:** SIH AgriBridge M5 Marketplace  
> **Client Consumer:** React 19 Frontend (`/seller`, `/buyer`)  
> **Environment Base URL:** Derived from `VITE_API_BASE_URL` (default: `http://localhost:5000/api`)  
> **Fallback Mechanism:** Dedicated Mock Layer (`src/services/mockMarketplaceData.js`) with LocalStorage persistence  

---

## Architecture Overview

```
Frontend UI Components (FarmerDashboard, NearbyMapInterface, PriceComparisonMatrix, DealModal)
       │
       ▼
Centralized Service Layer (`src/services/marketplaceService.js`)
       │
       ├─── Pure Pricing Engine (`src/utils/pricingEngine.js`)
       │
       ├─── Unified HTTP Client (`src/services/apiClient.js`)
       │       │
       │       ▼ (Network Fetch via VITE_API_BASE_URL)
       │    Backend Server (Node.js / Express / Spring / FastAPI)
       │
       └─── Offline / Development Fallback (`src/services/mockMarketplaceData.js`)
```

---

## 1. Farmer Profile & Inventory Endpoints

### 1.1 Get Farmer Profile
- **Endpoint:** `GET /api/farmers/:farmerId`
- **Description:** Retrieves the verified farmer's identity, KYC certification tier, farm acreage, and trust ratings.
- **URL Parameters:**
  - `farmerId` (`string`, required) — Unique farmer identifier (e.g., `frm-01`).

#### Success Response (`200 OK`)
```json
{
  "id": "frm-01",
  "name": "Ramesh Patil",
  "phone": "+91 98231 44521",
  "village": "Dindori",
  "district": "Nashik",
  "state": "Maharashtra",
  "farmSizeAcres": 14.5,
  "kycStatus": "VERIFIED",
  "trustScore": 96,
  "reviewsCount": 42,
  "coordinates": {
    "latitude": 20.201,
    "longitude": 73.832
  }
}
```

#### Error Response (`404 Not Found`)
```json
{
  "error": "NOT_FOUND",
  "message": "Farmer with id 'frm-01' not found",
  "statusCode": 404
}
```

---

### 1.2 Get Farmer Inventory Batches
- **Endpoint:** `GET /api/farmers/:farmerId/inventory`
- **Description:** Returns all live and in-negotiation crop batches listed by the farmer.
- **URL Parameters:**
  - `farmerId` (`string`, required)

#### Success Response (`200 OK`)
```json
[
  {
    "id": "inv-001",
    "farmerId": "frm-01",
    "crop": "Onion (Nashik Red)",
    "variety": "Garwa / Late Kharif",
    "category": "Vegetables",
    "quantity": 350,
    "unit": "Quintal",
    "basePrice": 1250,
    "expectedPrice": 1380,
    "harvestDate": "2026-09-18",
    "location": "Dindori, Nashik",
    "coordinates": {
      "latitude": 20.201,
      "longitude": 73.832
    },
    "qualityGrade": "Grade A",
    "moisturePercent": 11.5,
    "status": "ACTIVE",
    "verified": true
  }
]
```

---

### 1.3 Add New Crop Batch Listing
- **Endpoint:** `POST /api/farmers/:farmerId/inventory`
- **Description:** Publishes a newly harvested batch into the geo-discovery radar.
- **URL Parameters:**
  - `farmerId` (`string`, required)

#### Request Body
```json
{
  "crop": "Wheat (Sharbati)",
  "variety": "Sharbati Gold",
  "category": "Grains",
  "quantity": 150,
  "unit": "Quintal",
  "basePrice": 2200,
  "expectedPrice": 2350,
  "location": "Dindori, Nashik",
  "moisturePercent": 10.2,
  "qualityGrade": "Grade A"
}
```

#### Success Response (`201 Created`)
```json
{
  "id": "inv-1727221800000",
  "farmerId": "frm-01",
  "crop": "Wheat (Sharbati)",
  "variety": "Sharbati Gold",
  "category": "Grains",
  "quantity": 150,
  "unit": "Quintal",
  "basePrice": 2200,
  "expectedPrice": 2350,
  "location": "Dindori, Nashik",
  "coordinates": {
    "latitude": 20.0,
    "longitude": 73.8
  },
  "qualityGrade": "Grade A",
  "moisturePercent": 10.2,
  "status": "ACTIVE",
  "verified": true,
  "createdAt": "2026-09-24T18:30:00.000Z"
}
```

---

## 2. Hyperlocal Buyer Discovery & Radar Endpoints

### 2.1 Get Nearby Buyers
- **Endpoint:** `GET /api/buyers/nearby`
- **Description:** Retrieves verified buyers within a specified radius, matching crop criteria and trust score constraints.
- **Query Parameters:**
  - `crop` (`string`, optional) — Crop name or filter token (e.g. `Onion`, `Wheat`). If omitted or `ALL`, matches any buyer.
  - `radius` (`number`, optional) — Radius in kilometers (e.g. `25`, `50`, `100`).
  - `latitude` (`number`, optional) — Farmer's GPS latitude for distance sorting.
  - `longitude` (`number`, optional) — Farmer's GPS longitude for distance sorting.
  - `kycVerified` (`boolean`, optional) — When `true`, filters only KYC-verified buyers.
  - `minTrustScore` (`number`, optional) — Threshold from 0 to 100.
  - `sortBy` (`string`, optional) — `DISTANCE` | `TRUST` | `PRICE`.

#### Example Request
```http
GET /api/buyers/nearby?crop=Onion&radius=50&kycVerified=true&sortBy=DISTANCE&latitude=20.201&longitude=73.832 HTTP/1.1
Host: api.agribridge.in
```

#### Success Response (`200 OK`)
```json
[
  {
    "id": "byr-01",
    "name": "Sahyadri Agro Processing Hub",
    "type": "Food Processor",
    "latitude": 20.05,
    "longitude": 73.78,
    "distance": 18,
    "distanceKm": 18,
    "crops": ["Onion (Nashik Red)", "Tomato (Hybrid)", "Soybean"],
    "interestedCrops": ["Onion (Nashik Red)", "Tomato (Hybrid)", "Soybean"],
    "offeredPrice": 1360,
    "offeredPrices": {
      "Onion (Nashik Red)": 1360,
      "Tomato (Hybrid)": 1820,
      "Soybean": 4850
    },
    "offeredPricePerQtl": {
      "Onion (Nashik Red)": 1360,
      "Tomato (Hybrid)": 1820,
      "Soybean": 4850
    },
    "trustScore": 98,
    "kycVerified": true,
    "verificationTier": "GOVT REGISTERED PROCESSOR",
    "capacity": "2,000 Qtl/Week",
    "buyingCapacity": "2,000 Qtl/Week",
    "paymentTerms": "T+1 Escrow Instant",
    "freightStatus": true,
    "transportProvided": true,
    "location": "Mohadi Industrial Estate, Dindori"
  }
]
```

#### Error Response (`400 Bad Request`)
```json
{
  "error": "INVALID_QUERY_PARAMS",
  "message": "Radius must be a positive integer or 'ALL'",
  "statusCode": 400
}
```

---

### 2.2 Get Buyer Details
- **Endpoint:** `GET /api/buyers/:buyerId`
- **Description:** Returns full operational, financial, and logistical details for an individual buyer.

#### Success Response (`200 OK`)
```json
{
  "id": "byr-01",
  "name": "Sahyadri Agro Processing Hub",
  "contactPerson": "Anand Shinde (Procurement Lead)",
  "phone": "+91 94222 88190",
  "gstin": "27AABCS1429B1Z8",
  "panVerified": true,
  "kycVerified": true,
  "trustScore": 98,
  "operatingSince": 2017,
  "warehouseCapacityQtl": 15000,
  "paymentTerms": "T+1 Escrow Instant",
  "freightStatus": true
}
```

---

## 3. Mandi Benchmarks & Pricing Calculation

### 3.1 Get Regional Mandi Prices
- **Endpoint:** `GET /api/prices/mandi`
- **Description:** Retrieves live APMC Mandi modal rates, mandi tax/cess schedules, and distance references for net-return comparison.
- **Query Parameters:**
  - `crop` (`string`, optional) — Crop name (e.g. `Onion (Nashik Red)`).

#### Success Response (`200 OK`)
```json
[
  {
    "id": "mandi-lasalgaon",
    "name": "Lasalgaon APMC Mandi",
    "badge": "Asia's Largest Onion Market",
    "distanceKm": 42,
    "grossPricePerQtl": 1280,
    "transportCostPerQtl": 50,
    "mandiCessPerQtl": 26,
    "unloadingPerQtl": 14,
    "lastUpdated": "Today 10:15 AM",
    "location": "Lasalgaon, Niphad"
  }
]
```

---

## 4. Deal Negotiation & Connection State Machine

### Allowed State Transitions
```
                ┌───────────────────────────────────┐
                │                                   │
                ▼                                   │ (Counter)
  [CREATE] ──► PENDING ──► NEGOTIATING ─────────────┘
                 │             │
                 ├─────────────┴──────► ACCEPTED ──► COMPLETED
                 │
                 ▼
              REJECTED
```

---

### 4.1 Create Deal Request
- **Endpoint:** `POST /api/connections/deal-request`
- **Description:** Submits a formal direct purchase proposal from farmer to buyer.
- **Pre-condition:** Validated required fields (`farmerId`, `buyerId`, `crop`, `quantity`, `quotedPrice`, `targetDate`).

#### Request Body
```json
{
  "farmerId": "frm-01",
  "buyerId": "byr-01",
  "buyerName": "Sahyadri Agro Processing Hub",
  "crop": "Onion (Nashik Red)",
  "cropId": "crop-onion-nashik-red",
  "batchId": "inv-001",
  "quantity": 200,
  "unit": "Quintal",
  "quotedPrice": 1360,
  "logisticsMethod": "BUYER_ARRANGED_TRANSPORT",
  "targetDate": "2026-09-28",
  "message": "Harvested Grade A onions, moisture 11.5% in 50kg bags."
}
```

#### Success Response (`201 Created`)
```json
{
  "id": "req-1727222400000",
  "farmerId": "frm-01",
  "buyerId": "byr-01",
  "buyerName": "Sahyadri Agro Processing Hub",
  "crop": "Onion (Nashik Red)",
  "requestedQty": 200,
  "unit": "Quintal",
  "offeredPrice": 1360,
  "farmerAskPrice": 1360,
  "totalValue": 272000,
  "status": "PENDING",
  "pickupType": "BUYER_ARRANGED_TRANSPORT",
  "expectedDate": "2026-09-28",
  "notes": "Harvested Grade A onions, moisture 11.5% in 50kg bags.",
  "timeline": [
    {
      "step": "Deal proposed by Farmer",
      "date": "24 Sep, 18:30",
      "by": "Farmer",
      "actor": "Farmer",
      "action": "PROPOSE_DEAL",
      "oldStatus": "NONE",
      "newStatus": "PENDING",
      "price": 1360,
      "quantity": 200,
      "message": "Harvested Grade A onions, moisture 11.5% in 50kg bags.",
      "timestamp": "2026-09-24T18:30:00.000Z"
    }
  ]
}
```

---

### 4.2 Submit Counter-Offer
- **Endpoint:** `POST /api/connections/:connectionId/counter-offer`
- **Description:** Modifies price terms and transitions connection state to `NEGOTIATING`.
- **URL Parameters:**
  - `connectionId` (`string`, required)

#### Request Body
```json
{
  "counterPrice": 1390,
  "quantity": 200,
  "message": "Moisture is verified under 11%, requesting ₹1,390/qtl."
}
```

#### Success Response (`200 OK`)
```json
{
  "id": "req-01",
  "status": "NEGOTIATING",
  "offeredPrice": 1390,
  "farmerAskPrice": 1390,
  "timeline": [
    {
      "step": "Counter-offer submitted by Farmer (₹1,390/qtl)",
      "date": "24 Sep, 18:45",
      "by": "Farmer",
      "actor": "Farmer",
      "action": "COUNTER_OFFER",
      "oldStatus": "PENDING",
      "newStatus": "NEGOTIATING",
      "price": 1390,
      "quantity": 200,
      "message": "Moisture is verified under 11%, requesting ₹1,390/qtl.",
      "timestamp": "2026-09-24T18:45:00.000Z"
    }
  ]
}
```

---

### 4.3 Accept Deal
- **Endpoint:** `PATCH /api/connections/:connectionId/accept`
- **Description:** Formally accepts current price and quantity terms; transitions to `ACCEPTED` and locks escrow.

#### Success Response (`200 OK`)
```json
{
  "id": "req-01",
  "status": "ACCEPTED",
  "verifiedDeal": true,
  "escrowLocked": true,
  "timeline": [
    {
      "step": "Price locked & Deal Accepted",
      "date": "24 Sep, 19:00",
      "by": "Farmer",
      "actor": "Farmer",
      "action": "ACCEPT_DEAL",
      "oldStatus": "NEGOTIATING",
      "newStatus": "ACCEPTED",
      "timestamp": "2026-09-24T19:00:00.000Z"
    }
  ]
}
```

---

### 4.4 Complete Deal & Settle Escrow
- **Endpoint:** `PATCH /api/connections/:connectionId/complete`
- **Description:** Verifies gate weighment slip, releases buyer escrow funds to the farmer bank account, and marks state `COMPLETED`.

#### Success Response (`200 OK`)
```json
{
  "id": "req-01",
  "status": "COMPLETED",
  "settlementStatus": "DISBURSED",
  "timeline": [
    {
      "step": "Gate weighment verified & Escrow released",
      "date": "24 Sep, 19:15",
      "by": "System Escrow",
      "actor": "Escrow System",
      "action": "COMPLETE_DEAL",
      "oldStatus": "ACCEPTED",
      "newStatus": "COMPLETED",
      "timestamp": "2026-09-24T19:15:00.000Z"
    }
  ]
}
```

---

### 4.5 Get Transaction Audit Trail
- **Endpoint:** `GET /api/connections/:connectionId/audit`
- **Description:** Retrieves the tamper-evident chronological event log for compliance and escrow verification.

#### Success Response (`200 OK`)
```json
[
  {
    "timestamp": "2026-09-24T10:30:00.000Z",
    "actor": "Farmer",
    "action": "PROPOSE_DEAL",
    "oldStatus": "NONE",
    "newStatus": "PENDING",
    "price": 1350,
    "quantity": 200,
    "message": "Initial deal proposal"
  },
  {
    "timestamp": "2026-09-24T14:15:00.000Z",
    "actor": "Buyer",
    "action": "COUNTER_OFFER",
    "oldStatus": "PENDING",
    "newStatus": "NEGOTIATING",
    "price": 1365,
    "quantity": 200,
    "message": "Revised counter offer from buyer"
  }
]
```

---

## 5. Unresolved Contracts / TODO Items for Backend Team

| Feature | Target Endpoint | Description | Status |
|---|---|---|---|
| **E-Way Bill Generation** | `POST /api/logistics/eway-bill` | Generate national GST E-Way Bill for inter-district agricultural transport | `TODO: [Backend Team]` |
| **Escrow Webhook Notifications** | `POST /api/webhooks/escrow` | Receive instant ICICI / RazorpayX webhook upon weighment verification | `TODO: [Backend Team]` |
| **SMS Gateway OTP Verification** | `POST /api/auth/otp/send` | SMS OTP verification for farmer mobile authentication (MSAMB protocol) | `TODO: [Backend Team]` |
| **Automated Mandi Scraper Sync** | `GET /api/prices/mandi/sync` | Live sync with Agmarknet / e-NAM portal rates | `TODO: [Backend Team]` |
