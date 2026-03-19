import type { CreateOrderInput } from "@/lib/validators/order";
import type { IntakeAdapter, RawIntake } from "../types";

export const manualAdapter: IntakeAdapter<CreateOrderInput> = {
  source: "manual",

  parse(input: CreateOrderInput): RawIntake {
    return {
      source: "manual",
      receivedAt: new Date().toISOString(),
      brandId: input.internal.brandId || undefined,
      patient: {
        firstName: input.patient.firstName,
        lastName: input.patient.lastName,
        dob: input.patient.dob,
        phone: input.patient.phone,
        email: input.patient.email,
        address1: input.patient.address1,
        address2: input.patient.address2,
        city: input.patient.city,
        state: input.patient.state,
        zip: input.patient.zip,
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
        name: input.medication.medicationName,
        strength: input.medication.strength,
        dosageForm: input.medication.dosageForm,
        route: input.medication.route,
        directions: input.medication.directions,
        quantity: input.medication.quantity,
        refills: input.medication.refills,
        daysSupply: input.medication.daysSupply,
        icd10: input.medication.icd10,
        notes: input.medication.rxNotes,
      },
      pharmacyId: input.pharmacy.pharmacyId,
      meta: {
        priority: input.internal.priority,
        internalNotes: input.internal.internalNotes,
      },
    };
  },
};
