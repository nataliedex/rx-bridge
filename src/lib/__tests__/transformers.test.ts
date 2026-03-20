import { normalizePhone, normalizeState, normalizeOrder, normalizeIntake, computeSendReadiness, parsePharmacyRequirements } from "../transformers/normalize";
import { transformOrder } from "../transformers/pipeline";
import { manualAdapter } from "../intake/adapters/manual";
import type { CreateOrderInput } from "../validators/order";
import type { ComplianceResult } from "../transformers/types";

describe("normalizePhone", () => {
  it("formats 10-digit numbers", () => { expect(normalizePhone("5551234567")).toBe("(555) 123-4567"); });
  it("formats 11-digit numbers starting with 1", () => { expect(normalizePhone("15551234567")).toBe("(555) 123-4567"); });
  it("strips non-digits and formats", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("(555) 123-4567");
    expect(normalizePhone("555.123.4567")).toBe("(555) 123-4567");
  });
  it("returns empty string for null/undefined", () => { expect(normalizePhone(null)).toBe(""); expect(normalizePhone(undefined)).toBe(""); });
  it("returns trimmed original for non-standard formats", () => { expect(normalizePhone("123")).toBe("123"); });
});

describe("normalizeState", () => {
  it("uppercases 2-letter abbreviations", () => { expect(normalizeState("ca")).toBe("CA"); expect(normalizeState("TX")).toBe("TX"); });
  it("converts full state names to abbreviations", () => { expect(normalizeState("california")).toBe("CA"); expect(normalizeState("New York")).toBe("NY"); });
  it("returns empty string for null/undefined", () => { expect(normalizeState(null)).toBe(""); expect(normalizeState(undefined)).toBe(""); });
});

describe("parsePharmacyRequirements", () => {
  it("returns defaults for null/undefined/empty", () => { expect(parsePharmacyRequirements(null).requiredFields).toContain("patient.dob"); });
  it("parses valid JSON", () => {
    const reqs = parsePharmacyRequirements(JSON.stringify({ requiredFields: ["patient.dob", "medication.strength"], recommendedFields: ["patient.phone"] }));
    expect(reqs.requiredFields).toEqual(["patient.dob", "medication.strength"]);
  });
  it("falls back to defaults for invalid JSON", () => { expect(parsePharmacyRequirements("not json").requiredFields.length).toBeGreaterThan(0); });
});

describe("computeSendReadiness", () => {
  it("returns ready when no missing required fields", () => {
    const compliance: ComplianceResult = {
      missingRequired: [], missingRequiredFields: [],
      missingRecommended: ["Patient phone"], missingRecommendedFields: [{ field: "patient.phone", label: "Patient phone" }],
      warnings: ["some warning"], allRequiredPresent: true,
    };
    expect(computeSendReadiness(compliance)).toBe("ready");
  });
  it("returns missing_data when required fields missing", () => {
    const compliance: ComplianceResult = {
      missingRequired: ["Quantity"], missingRequiredFields: [{ field: "medication.quantity", label: "Quantity" }],
      missingRecommended: [], missingRecommendedFields: [],
      warnings: [], allRequiredPresent: false,
    };
    expect(computeSendReadiness(compliance)).toBe("missing_data");
  });
});

const baseOrder = {
  id: "order-1", brandId: "brand-1", patientId: "p1", prescriberId: "pr1", pharmacyId: "ph1",
  medicationName: "Testosterone Cypionate", strength: "200mg/mL", dosageForm: "Injectable",
  route: "Intramuscular", directions: "Inject 0.5mL weekly", quantity: 10, refills: 2, daysSupply: 90,
  icd10: "E29.1", rxNotes: "", orderSource: "manual", sourceRef: null, priority: "normal",
  internalNotes: "", status: "submitted", sendReadiness: "ready", rawPayload: null,
  createdAt: new Date(), updatedAt: new Date(),
  patient: { id: "p1", firstName: " John ", lastName: " Doe ", dob: "1985-03-15", phone: "5551234567", email: "john@example.com", address1: "123 Main St", address2: "", city: "Austin", state: "texas", zip: "78701", createdAt: new Date(), updatedAt: new Date() },
  prescriber: { id: "pr1", name: " Dr. Smith ", npi: "1234567890", clinicName: "Smith Clinic", phone: "5559876543", fax: "5559876544", email: "dr.smith@clinic.com", address: "456 Oak Ave, Austin TX", createdAt: new Date(), updatedAt: new Date() },
  pharmacy: { id: "ph1", name: "CompoundRx Pharmacy", contactName: "Jane", phone: "5551112222", fax: "5551112223", email: "orders@compoundrx.com", formatPreference: "standard", requirementsJson: "{}", createdAt: new Date(), updatedAt: new Date() },
  statusHistory: [],
};

describe("normalizeOrder (from DB record)", () => {
  it("normalizes patient name and trims whitespace", () => {
    const normalized = normalizeOrder(baseOrder as any);
    expect(normalized.patient.fullName).toBe("John Doe");
    expect(normalized.prescriber.name).toBe("Dr. Smith");
  });
  it("normalizes phone numbers", () => {
    const normalized = normalizeOrder(baseOrder as any);
    expect(normalized.patient.phone).toBe("(555) 123-4567");
    expect(normalized.prescriber.phone).toBe("(555) 987-6543");
  });
  it("normalizes state to abbreviation", () => {
    expect(normalizeOrder(baseOrder as any).patient.address).toContain("TX");
  });
  it("reports ready for complete order", () => {
    const normalized = normalizeOrder(baseOrder as any);
    expect(normalized.compliance.missingRequired).toHaveLength(0);
    expect(normalized.compliance.allRequiredPresent).toBe(true);
    expect(normalized.sendReadiness).toBe("ready");
  });
  it("detects missing required fields with field paths", () => {
    const incomplete = { ...baseOrder, directions: "", quantity: null, patient: { ...baseOrder.patient, dob: "" } };
    const normalized = normalizeOrder(incomplete as any);
    expect(normalized.compliance.missingRequired).toContain("Patient date of birth");
    expect(normalized.compliance.missingRequiredFields).toContainEqual({ field: "patient.dob", label: "Patient date of birth" });
    expect(normalized.sendReadiness).toBe("missing_data");
  });
  it("uses pharmacy-specific requirements when configured", () => {
    const strictPharmacy = { ...baseOrder, pharmacy: { ...baseOrder.pharmacy, requirementsJson: JSON.stringify({ requiredFields: ["patient.dob", "prescriber.npi", "medication.name", "medication.directions", "medication.quantity", "medication.strength"], recommendedFields: [] }) } };
    expect(normalizeOrder(strictPharmacy as any).compliance.missingRequired).toHaveLength(0);
    const noStrength = { ...strictPharmacy, strength: "" };
    const normalized2 = normalizeOrder(noStrength as any);
    expect(normalized2.compliance.missingRequired).toContain("Strength");
    expect(normalized2.sendReadiness).toBe("missing_data");
  });
});

describe("transformOrder pipeline", () => {
  it("produces a packet with standard format and send readiness", () => {
    const { normalized, packet } = transformOrder(baseOrder as any);
    expect(packet.format).toBe("standard");
    expect(packet.sendReadiness).toBe("ready");
    expect(normalized.meta.brandId).toBe("brand-1");
  });
  it("carries compliance through to the packet", () => {
    const incomplete = { ...baseOrder, directions: "" };
    const { packet } = transformOrder(incomplete as any);
    expect(packet.compliance.allRequiredPresent).toBe(false);
    expect(packet.sendReadiness).toBe("missing_data");
  });
});

describe("manual intake adapter", () => {
  const formInput: CreateOrderInput = {
    patient: { firstName: "Jane", lastName: "Doe", dob: "1990-05-20", phone: "5551234567", email: "jane@example.com", address1: "100 Elm St", address2: "", city: "Dallas", state: "TX", zip: "75201" },
    prescriber: { name: "Dr. Lee", npi: "1111111111", clinicName: "Lee Clinic", phone: "5559999999", fax: "", email: "", address: "" },
    medication: { medicationName: "Progesterone", strength: "100mg", dosageForm: "Capsule", route: "Oral", directions: "Take 1 daily", quantity: 30, refills: 2, daysSupply: 30, icd10: "", rxNotes: "" },
    pharmacy: { pharmacyId: "ph1" },
    internal: { brandId: "brand-1", orderSource: "manual", priority: "normal", internalNotes: "" },
  };
  it("produces a RawIntake with source=manual and brandId", () => {
    const intake = manualAdapter.parse(formInput);
    expect(intake.source).toBe("manual");
    expect(intake.brandId).toBe("brand-1");
  });
  it("can be normalized into a NormalizedOrder", () => {
    const intake = manualAdapter.parse(formInput);
    const pharmacy = { id: "ph1", name: "TestRx", fax: "5551112222", email: "rx@test.com", formatPreference: "standard", requirementsJson: "{}" };
    const normalized = normalizeIntake(intake, pharmacy);
    expect(normalized.patient.fullName).toBe("Jane Doe");
    expect(normalized.sendReadiness).toBe("ready");
    expect(normalized.meta.brandId).toBe("brand-1");
    expect(normalized.orderId).toBeNull();
  });
});

describe("lifefile formatter", () => {
  const { toLifefileRow, toLifefileCSV, validateForLifefile, LIFEFILE_COLUMNS } = require("../transformers/formatters/lifefile");

  // Build a normalized order from baseOrder for testing
  const normalizedComplete = normalizeOrder(baseOrder as any);

  it("maps normalized order to lifefile row with correct columns", () => {
    const row = toLifefileRow(normalizedComplete);
    expect(row.PatientFirstName).toBe("John");
    expect(row.PatientLastName).toBe("Doe");
    expect(row.PatientDOB).toBe("1985-03-15");
    expect(row.PrescriberNPI).toBe("1234567890");
    expect(row.MedicationName).toBe("Testosterone Cypionate");
    expect(row.Strength).toBe("200mg/mL");
    expect(row.Quantity).toBe("10");
    expect(row.Directions).toBe("Inject 0.5mL weekly");
  });

  it("generates valid CSV with header and data rows", () => {
    const csv = toLifefileCSV([normalizedComplete]);
    const lines = csv.split("\n");
    expect(lines.length).toBe(2); // header + 1 row
    expect(lines[0]).toBe(LIFEFILE_COLUMNS.join(","));
    expect(lines[1]).toContain("Testosterone Cypionate");
    expect(lines[1]).toContain("1234567890");
  });

  it("validates complete order as lifefile-ready", () => {
    const result = validateForLifefile(normalizedComplete);
    expect(result.isReady).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });

  it("detects missing lifefile-required fields", () => {
    const incomplete = { ...normalizedComplete, prescription: { ...normalizedComplete.prescription, strength: "", dosageForm: "" } };
    const result = validateForLifefile(incomplete);
    expect(result.isReady).toBe(false);
    expect(result.missingFields).toContain("Strength");
    expect(result.missingFields).toContain("Dosage form");
  });

  it("escapes CSV fields with commas", () => {
    const orderWithComma = { ...normalizedComplete, prescription: { ...normalizedComplete.prescription, directions: "Take 1 capsule, twice daily" } };
    const csv = toLifefileCSV([orderWithComma]);
    expect(csv).toContain('"Take 1 capsule, twice daily"');
  });
});
