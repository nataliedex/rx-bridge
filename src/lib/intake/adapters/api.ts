// Stub adapter for external API submissions.
// When a partner API integration is built, this adapter will parse
// the incoming JSON payload into the common RawIntake shape.

import { z } from "zod";
import type { IntakeAdapter, RawIntake } from "../types";

// Zod schema for the external API payload — acts as both
// documentation and runtime validation for partner submissions.
export const apiOrderPayloadSchema = z.object({
  patient: z.object({
    firstName: z.string(),
    lastName: z.string(),
    dob: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
    }).optional(),
  }),
  prescriber: z.object({
    name: z.string(),
    npi: z.string(),
    clinicName: z.string().optional(),
    phone: z.string().optional(),
    fax: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
  }),
  medication: z.object({
    name: z.string(),
    strength: z.string().optional(),
    dosageForm: z.string().optional(),
    route: z.string().optional(),
    directions: z.string().optional(),
    quantity: z.number().optional(),
    refills: z.number().optional(),
    daysSupply: z.number().optional(),
    icd10: z.string().optional(),
    notes: z.string().optional(),
  }),
  pharmacyId: z.string(),
  brandId: z.string().optional(),
  priority: z.string().optional(),
  externalRef: z.string().optional(),
});

export type ApiOrderPayload = z.infer<typeof apiOrderPayloadSchema>;

export const apiAdapter: IntakeAdapter<ApiOrderPayload> = {
  source: "api",

  parse(input: ApiOrderPayload): RawIntake {
    return {
      source: "api",
      receivedAt: new Date().toISOString(),
      brandId: input.brandId,
      patient: {
        firstName: input.patient.firstName,
        lastName: input.patient.lastName,
        dob: input.patient.dob,
        phone: input.patient.phone,
        email: input.patient.email,
        address1: input.patient.address?.line1,
        address2: input.patient.address?.line2,
        city: input.patient.address?.city,
        state: input.patient.address?.state,
        zip: input.patient.address?.zip,
      },
      prescriber: {
        name: input.prescriber.name,
        npi: input.prescriber.npi,
        clinicName: input.prescriber.clinicName,
        phone: input.prescriber.phone,
        fax: input.prescriber.fax,
        email: input.prescriber.email,
        address: input.prescriber.address,
      },
      medication: {
        name: input.medication.name,
        strength: input.medication.strength,
        dosageForm: input.medication.dosageForm,
        route: input.medication.route,
        directions: input.medication.directions,
        quantity: input.medication.quantity,
        refills: input.medication.refills,
        daysSupply: input.medication.daysSupply,
        icd10: input.medication.icd10,
        notes: input.medication.notes,
      },
      pharmacyId: input.pharmacyId,
      meta: {
        priority: input.priority,
        sourceRef: input.externalRef,
        raw: input,
      },
    };
  },
};
