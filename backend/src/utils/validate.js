// Basic backend validation (zod). Foundation-level only:
// required names, phone/email, crop/quantity/unit, prices, dates, lat/lng, status.
const { z } = require('zod');

const phoneRegex = /^[+\d][\d\s-]{6,18}$/;
const latSchema = z.number().min(-90).max(90);
const lngSchema = z.number().min(-180).max(180);
const statusSchema = z.enum(['OPEN', 'MATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED']);
const kycSchema = z.enum(['PENDING', 'VERIFIED', 'REJECTED']);

const farmerSchema = z.object({
  name: z.string().trim().min(2, 'name is required (min 2 chars)'),
  phone: z.string().trim().regex(phoneRegex, 'invalid phone format'),
  email: z.string().trim().email('invalid email').optional().or(z.literal('')),
  village: z.string().trim().optional(),
  district: z.string().trim().optional(),
  state: z.string().trim().optional(),
  latitude: latSchema.optional(),
  longitude: lngSchema.optional(),
  kycStatus: kycSchema.optional(),
  trustScore: z.number().min(0).max(100).optional(),
});

const buyerSchema = z.object({
  name: z.string().trim().min(2, 'name is required (min 2 chars)'),
  companyName: z.string().trim().optional(),
  phone: z.string().trim().regex(phoneRegex, 'invalid phone format'),
  email: z.string().trim().email('invalid email').optional().or(z.literal('')),
  buyerType: z.string().trim().optional(),
  village: z.string().trim().optional(),
  district: z.string().trim().optional(),
  state: z.string().trim().optional(),
  latitude: latSchema.optional(),
  longitude: lngSchema.optional(),
});

const cropListingSchema = z.object({
  farmerId: z.string().trim().min(1, 'farmerId is required'),
  cropName: z.string().trim().min(2, 'cropName is required'),
  quantity: z.number().positive('quantity must be > 0'),
  unit: z.string().trim().min(1, 'unit is required (e.g. quintal, kg, tonne)'),
  minExpectedPrice: z.number().nonnegative('minExpectedPrice must be >= 0'),
  maxExpectedPrice: z.number().nonnegative('maxExpectedPrice must be >= 0'),
  availableFrom: z.coerce.date().optional(),
  status: statusSchema.optional(),
  latitude: latSchema.optional(),
  longitude: lngSchema.optional(),
});

const buyerRequirementSchema = z.object({
  buyerId: z.string().trim().min(1, 'buyerId is required'),
  cropName: z.string().trim().min(2, 'cropName is required'),
  requiredQuantity: z.number().positive('requiredQuantity must be > 0'),
  unit: z.string().trim().min(1, 'unit is required (e.g. quintal, kg, tonne)'),
  targetPrice: z.number().nonnegative('targetPrice must be >= 0'),
  neededBy: z.coerce.date().optional(),
  latitude: latSchema.optional(),
  longitude: lngSchema.optional(),
  status: statusSchema.optional(),
});

// Express middleware factory: validate req.body against a zod schema.
function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.details = parsed.error.flatten();
      return next(err);
    }
    req.body = parsed.data;
    return next();
  };
}

// Express middleware factory: validate req.query against a zod schema.
function validateQuery(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      const err = new Error('Invalid query parameters');
      err.status = 400;
      err.details = parsed.error.flatten();
      return next(err);
    }
    req.query = parsed.data;
    return next();
  };
}

// --- Farmer API schemas (B1 Task 2) ---
// Clients must NOT set id / createdAt / updatedAt (.strict() rejects them)
// and must NOT manipulate trustScore (excluded from both schemas).
// kycStatus uses the DB default (PENDING) on create; updatable afterwards.
const emailField = z
  .string()
  .trim()
  .email('invalid email')
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' ? undefined : v));

const farmerCreateSchema = z
  .object({
    name: z.string().trim().min(2, 'name is required (min 2 chars)'),
    phone: z.string().trim().regex(phoneRegex, 'invalid phone format'),
    email: emailField,
    village: z.string().trim().optional(),
    district: z.string().trim().optional(),
    state: z.string().trim().optional(),
    latitude: latSchema.optional(),
    longitude: lngSchema.optional(),
  })
  .strict();

const farmerUpdateSchema = farmerCreateSchema
  .partial()
  .extend({ kycStatus: kycSchema.optional() })
  .strict();

const paginationQuerySchema = z.object({
  page: z.coerce.number().int('page must be an integer').min(1, 'page must be >= 1').default(1),
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .min(1, 'limit must be >= 1')
    .max(100, 'limit must be <= 100')
    .default(20),
});

// --- Crop Listing API schemas (B1 Task 3 + 3.5) ---
// Mirrors the Prisma CropListing model: farmer-defined price RANGE
// (minExpectedPrice/maxExpectedPrice), no market/mandi price fields,
// no buyerId/district/state. Clients must NOT set id / createdAt / updatedAt
// (.strict() rejects them, including the old `expectedPrice` field).
// status uses the shared listing-status enum (schema default OPEN applies
// when omitted); availableFrom is optional. No mandi coupling yet: only
// min >= 0, max >= 0, min <= max is enforced.
function checkPriceRange(data, ctx) {
  if (
    data.minExpectedPrice !== undefined &&
    data.maxExpectedPrice !== undefined &&
    data.minExpectedPrice > data.maxExpectedPrice
  ) {
    ctx.addIssue({
      code: z.ZOD_ISSUE_CUSTOM,
      message: 'minExpectedPrice must be <= maxExpectedPrice',
      path: ['minExpectedPrice'],
    });
  }
}

const cropListingFieldShape = {
  farmerId: z.string().trim().min(1, 'farmerId is required'),
  cropName: z.string().trim().min(1, 'cropName is required'),
  quantity: z.number().positive('quantity must be > 0'),
  unit: z.string().trim().min(1, 'unit is required (e.g. quintal, kg, tonne)'),
  minExpectedPrice: z.number().nonnegative('minExpectedPrice must be >= 0'),
  maxExpectedPrice: z.number().nonnegative('maxExpectedPrice must be >= 0'),
  availableFrom: z.coerce.date().optional(),
  status: statusSchema.optional(),
  latitude: latSchema.optional(),
  longitude: lngSchema.optional(),
};

const cropListingCreateSchema = z
  .object(cropListingFieldShape)
  .strict()
  .superRefine(checkPriceRange);

const cropListingUpdateSchema = z
  .object(cropListingFieldShape)
  .partial()
  .strict()
  .superRefine(checkPriceRange);

// --- Market-price API schemas (B1 Task 4) ---
// Read-only filters over normalized Agmarknet observations. Text filters
// accept '' as absent (lenient query strings); dateFrom must be <= dateTo.
const filterText = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().trim().min(1, 'must not be empty').max(120, 'too long').optional()
);

function checkDateRange(data, ctx) {
  if (data.dateFrom !== undefined && data.dateTo !== undefined && data.dateFrom > data.dateTo) {
    ctx.addIssue({
      code: z.ZOD_ISSUE_CUSTOM,
      message: 'dateFrom must be <= dateTo',
      path: ['dateFrom'],
    });
  }
}

const marketPriceQuerySchema = paginationQuerySchema
  .extend({
    commodity: filterText,
    variety: filterText,
    state: filterText,
    district: filterText,
    market: filterText,
    date: z.coerce.date().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .superRefine(checkDateRange);

const marketPriceContextSchema = z
  .object({
    commodity: z.string().trim().min(1, 'commodity is required'),
    state: filterText,
    district: filterText,
    market: filterText,
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });

// --- Buyer API schemas (B2 Step 2) ---
// Clients must NOT set id / createdAt / updatedAt (.strict() rejects them).
const buyerCreateSchema = z
  .object({
    name: z.string().trim().min(2, 'name is required (min 2 chars)'),
    companyName: z.string().trim().optional(),
    phone: z.string().trim().regex(phoneRegex, 'invalid phone format'),
    email: emailField,
    buyerType: z.string().trim().optional(),
    village: z.string().trim().optional(),
    district: z.string().trim().optional(),
    state: z.string().trim().optional(),
    latitude: latSchema.optional(),
    longitude: lngSchema.optional(),
  })
  .strict();

const buyerUpdateSchema = buyerCreateSchema.partial().strict();

// --- Buyer Requirement API schemas (B2 Step 2) ---
// Mirrors the Prisma BuyerRequirement model.
// Clients must NOT set id / createdAt / updatedAt (.strict() rejects them).
const buyerRequirementFieldShape = {
  buyerId: z.string().trim().min(1, 'buyerId is required'),
  cropName: z.string().trim().min(1, 'cropName is required'),
  requiredQuantity: z.number().positive('requiredQuantity must be > 0'),
  unit: z.string().trim().min(1, 'unit is required (e.g. quintal, kg, tonne)'),
  targetPrice: z.number().nonnegative('targetPrice must be >= 0'),
  neededBy: z.coerce.date().optional(),
  latitude: latSchema.optional(),
  longitude: lngSchema.optional(),
  status: statusSchema.optional(),
};

const buyerRequirementCreateSchema = z
  .object(buyerRequirementFieldShape)
  .strict();

const buyerRequirementUpdateSchema = z
  .object(buyerRequirementFieldShape)
  .partial()
  .strict();
// --- Deal API schemas (B3 Task) ---
const dealStatusSchema = z.enum([
  'ACCEPTED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

const dealCreateSchema = z
  .object({
    offerId: z.string().trim().min(1, 'offerId is required'),
    pickupLocation: z.string().trim().max(250).optional(),
    deliveryLocation: z.string().trim().max(250).optional(),
  })
  .strict();

const dealStatusUpdateSchema = z
  .object({
    status: dealStatusSchema,
  })
  .strict();

const dealCancelSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

const dealQuerySchema = paginationQuerySchema.extend({
  status: dealStatusSchema.optional(),
  farmerId: z.string().trim().optional(),
  buyerId: z.string().trim().optional(),
});

// --- Notification API schemas (B3 Task) ---
const notificationQuerySchema = paginationQuerySchema.extend({
  read: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

const notificationCreateSchema = z
  .object({
    userId: z.string().trim().min(1, 'userId is required'),
    userRole: z.string().trim().optional(),
    type: z.string().trim().min(1, 'type is required'),
    title: z.string().trim().min(1, 'title is required'),
    message: z.string().trim().min(1, 'message is required'),
    dealId: z.string().trim().optional(),
    offerId: z.string().trim().optional(),
  })
  .strict();

module.exports = {
  farmerSchema,
  buyerSchema,
  cropListingSchema,
  buyerRequirementSchema,
  farmerCreateSchema,
  farmerUpdateSchema,
  cropListingCreateSchema,
  cropListingUpdateSchema,
  buyerCreateSchema,
  buyerUpdateSchema,
  buyerRequirementCreateSchema,
  buyerRequirementUpdateSchema,
  marketPriceQuerySchema,
  marketPriceContextSchema,
  dealStatusSchema,
  dealCreateSchema,
  dealStatusUpdateSchema,
  dealCancelSchema,
  dealQuerySchema,
  notificationQuerySchema,
  notificationCreateSchema,
  paginationQuerySchema,
  validateBody,
  validateQuery,
};


