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
  expectedPrice: z.number().nonnegative('expectedPrice must be >= 0'),
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

module.exports = {
  farmerSchema,
  buyerSchema,
  cropListingSchema,
  buyerRequirementSchema,
  validateBody,
};
