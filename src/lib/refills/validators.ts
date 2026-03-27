import { z } from "zod";

export const refillRequestSchema = z.object({
  brandId: z.string().min(1).optional().or(z.null()),
  patientId: z.string().min(1, "patientId is required"),
  prescriptionId: z.string().min(1, "prescriptionId is required"), // = orderId
  medicationName: z.string().optional(), // for cross-validation, not required
  requestedBy: z.object({
    userId: z.string().optional(),
    name: z.string().optional(),
    email: z.string().email().optional(),
  }).optional(),
  quantity: z.number().int().positive().optional(),
  notes: z.string().optional(),
  source: z.enum(["brand_portal", "api", "internal_ops", "brand_simulator"]).default("api"),
  idempotencyKey: z.string().optional(),
});

export type RefillRequestInput = z.infer<typeof refillRequestSchema>;

export const pharmacyFillStatusSchema = z.object({
  pharmacyId: z.string().min(1),
  refillRequestId: z.string().min(1),
  prescriptionId: z.string().min(1),
  rxBridgeOrderId: z.string().min(1),
  pharmacyOrderId: z.string().optional(),
  status: z.enum(["acknowledged", "filled", "rejected", "cancelled"]),
  fillType: z.enum(["full", "partial"]).optional(),
  quantityDispensed: z.number().int().positive().optional(),
  filledAt: z.string().optional(),
  pharmacyCostCents: z.number().int().optional(),
  sellPriceCents: z.number().int().optional(),
});

export type PharmacyFillStatusInput = z.infer<typeof pharmacyFillStatusSchema>;
