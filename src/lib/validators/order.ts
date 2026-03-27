import { z } from "zod";

export const patientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  phone: z.string().optional().default(""),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address1: z.string().optional().default(""),
  address2: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  zip: z.string().optional().default(""),
});

export const prescriberSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Prescriber name is required"),
  npi: z.string().min(10, "NPI must be 10 digits").max(10, "NPI must be 10 digits"),
  clinicName: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  fax: z.string().optional().default(""),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional().default(""),
});

export const medicationSchema = z.object({
  medicationName: z.string().min(1, "Medication name is required"),
  strength: z.string().optional().default(""),
  dosageForm: z.string().optional().default(""),
  route: z.string().optional().default(""),
  directions: z.string().optional().default(""),
  quantity: z.coerce.number().int().positive("Quantity must be positive").optional(),
  refills: z.coerce.number().int().min(0).optional().default(0),
  daysSupply: z.coerce.number().int().positive("Days supply must be positive").optional(),
  icd10: z.string().optional().default(""),
  rxNotes: z.string().optional().default(""),
});

export const pharmacySelectionSchema = z.object({
  pharmacyId: z.string().min(1, "Pharmacy selection is required"),
});

export const internalSchema = z.object({
  brandId: z.string().optional().default(""),
  orderSource: z.enum(["manual", "ehr", "api"]).default("manual"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  internalNotes: z.string().optional().default(""),
});

export const createOrderSchema = z.object({
  patient: patientSchema,
  prescriber: prescriberSchema,
  medication: medicationSchema,
  pharmacy: pharmacySelectionSchema,
  internal: internalSchema,
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const statusUpdateSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum([
    "draft",
    "submitted",
    "under_review",
    "needs_clarification",
    "correction_requested",
    "approved",
    "queued",
    "sent_to_pharmacy",
    "completed",
    "rejected",
  ]),
  note: z.string().optional().default(""),
});
