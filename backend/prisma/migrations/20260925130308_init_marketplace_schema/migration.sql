-- CreateTable
CREATE TABLE "farmers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "village" TEXT,
    "district" TEXT,
    "state" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farmers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "buyerType" TEXT,
    "village" TEXT,
    "district" TEXT,
    "state" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crop_listings" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "cropName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "minExpectedPrice" DOUBLE PRECISION NOT NULL,
    "maxExpectedPrice" DOUBLE PRECISION NOT NULL,
    "availableFrom" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crop_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_requirements" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "cropName" TEXT NOT NULL,
    "requiredQuantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "targetPrice" DOUBLE PRECISION NOT NULL,
    "neededBy" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_prices" (
    "id" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "variety" TEXT,
    "grade" TEXT,
    "market" TEXT NOT NULL,
    "district" TEXT,
    "state" TEXT NOT NULL,
    "minPrice" DOUBLE PRECISION NOT NULL,
    "maxPrice" DOUBLE PRECISION NOT NULL,
    "modalPrice" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT 'quintal',
    "observedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'agmarknet',
    "sourceRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "farmers_email_key" ON "farmers"("email");

-- CreateIndex
CREATE INDEX "farmers_phone_idx" ON "farmers"("phone");

-- CreateIndex
CREATE INDEX "farmers_district_state_idx" ON "farmers"("district", "state");

-- CreateIndex
CREATE UNIQUE INDEX "buyers_email_key" ON "buyers"("email");

-- CreateIndex
CREATE INDEX "buyers_phone_idx" ON "buyers"("phone");

-- CreateIndex
CREATE INDEX "buyers_district_state_idx" ON "buyers"("district", "state");

-- CreateIndex
CREATE INDEX "crop_listings_farmerId_idx" ON "crop_listings"("farmerId");

-- CreateIndex
CREATE INDEX "crop_listings_cropName_status_idx" ON "crop_listings"("cropName", "status");

-- CreateIndex
CREATE INDEX "buyer_requirements_buyerId_idx" ON "buyer_requirements"("buyerId");

-- CreateIndex
CREATE INDEX "buyer_requirements_cropName_status_idx" ON "buyer_requirements"("cropName", "status");

-- CreateIndex
CREATE INDEX "market_prices_commodity_observedAt_idx" ON "market_prices"("commodity", "observedAt");

-- CreateIndex
CREATE INDEX "market_prices_state_district_observedAt_idx" ON "market_prices"("state", "district", "observedAt");

-- CreateIndex
CREATE INDEX "market_prices_market_observedAt_idx" ON "market_prices"("market", "observedAt");

-- AddForeignKey
ALTER TABLE "crop_listings" ADD CONSTRAINT "crop_listings_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_requirements" ADD CONSTRAINT "buyer_requirements_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
