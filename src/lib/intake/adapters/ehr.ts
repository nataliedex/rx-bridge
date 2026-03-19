// Stub adapter for EHR/eRx system imports.
// When an EHR integration is built, this adapter will parse HL7/FHIR messages
// (or whatever the EHR sends) into the common RawIntake shape.

import type { IntakeAdapter, RawIntake } from "../types";

// Placeholder for the shape of an incoming EHR message.
// Replace with actual HL7/FHIR types when integrating.
export interface EhrMessage {
  messageId: string;
  patient: {
    given: string;
    family: string;
    birthDate: string;
    telecom?: string;
    email?: string;
    addressLine?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
  };
  prescriber: {
    display: string;
    npi: string;
    organization?: string;
    telecom?: string;
    fax?: string;
  };
  medication: {
    display: string;
    strength?: string;
    form?: string;
    route?: string;
    sig?: string;
    quantity?: number;
    refills?: number;
    daysSupply?: number;
    icd10?: string;
  };
  pharmacyId: string;
  brandId?: string;
}

export const ehrAdapter: IntakeAdapter<EhrMessage> = {
  source: "ehr",

  parse(input: EhrMessage): RawIntake {
    return {
      source: "ehr",
      receivedAt: new Date().toISOString(),
      brandId: input.brandId,
      patient: {
        firstName: input.patient.given,
        lastName: input.patient.family,
        dob: input.patient.birthDate,
        phone: input.patient.telecom,
        email: input.patient.email,
        address1: input.patient.addressLine?.[0],
        address2: input.patient.addressLine?.[1],
        city: input.patient.city,
        state: input.patient.state,
        zip: input.patient.postalCode,
      },
      prescriber: {
        name: input.prescriber.display,
        npi: input.prescriber.npi,
        clinicName: input.prescriber.organization,
        phone: input.prescriber.telecom,
        fax: input.prescriber.fax,
      },
      medication: {
        name: input.medication.display,
        strength: input.medication.strength,
        dosageForm: input.medication.form,
        route: input.medication.route,
        directions: input.medication.sig,
        quantity: input.medication.quantity,
        refills: input.medication.refills,
        daysSupply: input.medication.daysSupply,
        icd10: input.medication.icd10,
      },
      pharmacyId: input.pharmacyId,
      meta: {
        sourceRef: input.messageId,
        raw: input,
      },
    };
  },
};
