import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Brands
  const brand1 = await prisma.brand.create({
    data: { name: "Vitality Wellness Co.", active: true, notes: "D2C hormone therapy brand — high volume" },
  });
  const brand2 = await prisma.brand.create({
    data: { name: "NovaDerm Health", active: true, notes: "Dermatology-focused brand — topical compounding" },
  });
  const brand3 = await prisma.brand.create({
    data: { name: "PeakLife Rx", active: true, notes: "Functional medicine brand — LDN, integrative protocols" },
  });

  // Pharmacies
  const pharmacy1 = await prisma.pharmacy.create({
    data: {
      name: "CompoundRx Pharmacy", contactName: "Sarah Mitchell",
      phone: "5125551234", fax: "5125551235", email: "orders@compoundrx.example.com",
      formatPreference: "standard",
      requirementsJson: JSON.stringify({
        requiredFields: ["patient.dob", "prescriber.npi", "medication.name", "medication.directions", "medication.quantity"],
        recommendedFields: ["patient.phone", "medication.strength", "medication.dosageForm", "medication.daysSupply"],
      }),
    },
  });
  const pharmacy2 = await prisma.pharmacy.create({
    data: {
      name: "PrecisionMed Compounding", contactName: "James Carter",
      phone: "2125559876", fax: "2125559877", email: "intake@precisionmed.example.com",
      formatPreference: "standard",
      requirementsJson: JSON.stringify({
        requiredFields: ["patient.dob", "prescriber.npi", "medication.name", "medication.directions", "medication.quantity", "medication.strength", "medication.dosageForm"],
        recommendedFields: ["patient.phone", "patient.email", "medication.daysSupply", "prescriber.fax"],
      }),
    },
  });
  const pharmacy3 = await prisma.pharmacy.create({
    data: {
      name: "BioFormula Pharmacy", contactName: "Linda Tran",
      phone: "3105557890", fax: "3105557891", email: "rx@bioformula.example.com",
      formatPreference: "standard",
      requirementsJson: JSON.stringify({
        requiredFields: ["patient.dob", "prescriber.npi", "medication.name", "medication.directions", "medication.quantity"],
        recommendedFields: ["patient.phone", "medication.strength", "medication.daysSupply"],
      }),
    },
  });

  // Brand-Pharmacy routing configs
  await prisma.brandPharmacyConfig.create({ data: { brandId: brand1.id, pharmacyId: pharmacy1.id, isDefault: true, routingPriority: 0 } });
  await prisma.brandPharmacyConfig.create({ data: { brandId: brand1.id, pharmacyId: pharmacy3.id, isDefault: false, routingPriority: 1 } });
  await prisma.brandPharmacyConfig.create({ data: { brandId: brand2.id, pharmacyId: pharmacy2.id, isDefault: true, routingPriority: 0 } });
  await prisma.brandPharmacyConfig.create({ data: { brandId: brand3.id, pharmacyId: pharmacy3.id, isDefault: true, routingPriority: 0 } });
  await prisma.brandPharmacyConfig.create({ data: { brandId: brand3.id, pharmacyId: pharmacy1.id, isDefault: false, routingPriority: 1 } });

  // Prescribers
  const prescriber1 = await prisma.prescriber.create({ data: { name: "Dr. Emily Richardson", npi: "1234567890", clinicName: "Austin Integrative Health", phone: "5125554321", fax: "5125554322", email: "erichardson@aih.example.com", address: "200 West Ave, Suite 300, Austin, TX 78701" } });
  const prescriber2 = await prisma.prescriber.create({ data: { name: "Dr. Marcus Chen", npi: "9876543210", clinicName: "Manhattan Wellness Center", phone: "2125551111", fax: "2125551112", email: "mchen@mwc.example.com", address: "450 Park Ave, New York, NY 10022" } });
  const prescriber3 = await prisma.prescriber.create({ data: { name: "Dr. Priya Patel", npi: "5678901234", clinicName: "Pacific Coast Medical Group", phone: "3105553333", fax: "3105553334", email: "ppatel@pcmg.example.com", address: "1200 Ocean Blvd, Santa Monica, CA 90401" } });

  // Patients
  const patient1 = await prisma.patient.create({ data: { firstName: "John", lastName: "Martinez", dob: "1985-03-15", phone: "5125557001", email: "john.martinez@example.com", address1: "123 Main Street", city: "Austin", state: "TX", zip: "78701" } });
  const patient2 = await prisma.patient.create({ data: { firstName: "Sarah", lastName: "Johnson", dob: "1992-07-22", phone: "2125558001", email: "sjohnson@example.com", address1: "456 Broadway", address2: "Apt 12B", city: "New York", state: "NY", zip: "10013" } });
  const patient3 = await prisma.patient.create({ data: { firstName: "Robert", lastName: "Kim", dob: "1978-11-08", phone: "3105559001", email: "rkim@example.com", address1: "789 Sunset Blvd", city: "Los Angeles", state: "CA", zip: "90028" } });
  const patient4 = await prisma.patient.create({ data: { firstName: "Lisa", lastName: "Thompson", dob: "1990-01-30", phone: "5125557002", address1: "321 Oak Drive", city: "Round Rock", state: "TX", zip: "78664" } });

  // Medications (network catalog)
  const meds = await Promise.all([
    prisma.medication.create({ data: { name: "Testosterone Cypionate", form: "Injectable Solution", strength: "200mg/mL" } }),
    prisma.medication.create({ data: { name: "Progesterone", form: "Capsule", strength: "100mg" } }),
    prisma.medication.create({ data: { name: "Progesterone Troche", form: "Troche", strength: "200mg" } }),
    prisma.medication.create({ data: { name: "Low Dose Naltrexone", form: "Capsule", strength: "4.5mg" } }),
    prisma.medication.create({ data: { name: "Vitamin D3", form: "Capsule", strength: "50000 IU" } }),
    prisma.medication.create({ data: { name: "Estradiol/Estriol Cream", form: "Topical Cream", strength: "80/20 ratio" } }),
    prisma.medication.create({ data: { name: "Thyroid T3/T4 Combination", form: "Capsule", strength: "5mcg/65mcg" } }),
    prisma.medication.create({ data: { name: "DHEA", form: "Capsule", strength: "25mg" } }),
    prisma.medication.create({ data: { name: "Sermorelin", form: "Injectable Solution", strength: "9mg" } }),
    prisma.medication.create({ data: { name: "BPC-157", form: "Capsule", strength: "500mcg" } }),
    prisma.medication.create({ data: { name: "Glutathione", form: "Injectable Solution", strength: "200mg/mL" } }),
    prisma.medication.create({ data: { name: "Oxytocin Nasal Spray", form: "Nasal Spray", strength: "40IU/mL" } }),
    prisma.medication.create({ data: { name: "NAD+ Nasal Spray", form: "Nasal Spray", strength: "100mg/mL" } }),
    prisma.medication.create({ data: { name: "Sildenafil Troche", form: "Troche", strength: "50mg" } }),
    prisma.medication.create({ data: { name: "Tadalafil Capsule", form: "Capsule", strength: "5mg" } }),
    prisma.medication.create({ data: { name: "Ipamorelin/CJC-1295", form: "Injectable Solution", strength: "9mg/9mg" } }),
    prisma.medication.create({ data: { name: "Metformin Extended Release", form: "Capsule", strength: "500mg" } }),
    prisma.medication.create({ data: { name: "Methylcobalamin B12", form: "Sublingual Tablet", strength: "5000mcg" } }),
    prisma.medication.create({ data: { name: "Tretinoin Cream", form: "Topical Cream", strength: "0.05%" } }),
    prisma.medication.create({ data: { name: "DHEA Cream", form: "Topical Cream", strength: "25mg/g" } }),
    prisma.medication.create({ data: { name: "Pregnenolone", form: "Capsule", strength: "50mg" } }),
  ]);

  // Medication pricing history — date-stamped entries
  const pharmacies = [pharmacy1, pharmacy2, pharmacy3];
  const basePrices: number[] = [125.80, 46.80, 58.50, 29.25, 20.00, 84.00, 68.40, 30.00, 173.60, 136.50, 97.15, 107.25, 140.80, 77.00, 54.00, 192.00, 29.75, 24.60, 63.75, 42.90, 38.40];
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const sixWeeksAgo = new Date(Date.now() - 42 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Skip some medication-pharmacy combos to create "missing" rows in the audit
  // Meds 16-20: only available at pharmacy1 and pharmacy2 (missing at pharmacy3)
  // Meds 18-20: only available at pharmacy1 (missing at pharmacy2 and pharmacy3)
  for (let i = 0; i < meds.length; i++) {
    for (let p = 0; p < pharmacies.length; p++) {
      // Create intentional gaps for newer/less-established medications
      if (i >= 18 && p >= 1) continue;  // meds 19-21 only at pharmacy1
      if (i >= 16 && p >= 2) continue;  // meds 17-18 missing at pharmacy3

      const multiplier = [1.0, 1.08, 1.15][p];
      const currentPrice = Math.round(basePrices[i] * multiplier * 100) / 100;

      // For the first 5 medications, create a historical price entry that was superseded
      if (i < 5) {
        const oldPrice = Math.round(currentPrice * 1.12 * 100) / 100; // 12% higher before GPO negotiation
        await prisma.medicationPriceEntry.create({
          data: {
            medicationId: meds[i].id, pharmacyId: pharmacies[p].id,
            price: oldPrice,
            effectiveDate: threeMonthsAgo,
            endDate: oneMonthAgo,
            notes: "Pre-GPO rate",
          },
        });
      }

      // Current active price — vary verifiedAt for audit demo
      // First 5 meds (GPO negotiated): verified recently (fresh)
      // Meds 6-10: verified 6 weeks ago (aging)
      // Meds 11-15: verified 3 months ago (stale)
      // Meds 16+: never verified (stale)
      const verifiedAt = i < 5 ? (p === 0 ? oneWeekAgo : twoWeeksAgo)
        : i < 10 ? sixWeeksAgo
        : i < 15 ? threeMonthsAgo
        : null;

      await prisma.medicationPriceEntry.create({
        data: {
          medicationId: meds[i].id, pharmacyId: pharmacies[p].id,
          price: currentPrice,
          effectiveDate: i < 5 ? oneMonthAgo : threeMonthsAgo,
          notes: i < 5 ? "GPO negotiated rate" : undefined,
          verifiedAt,
          verificationSource: verifiedAt ? (i < 5 ? "GPO portal" : "pharmacy call") : undefined,
        },
      });
    }
  }

  // Providers — represent the revenue side (what brands/providers pay Rx-Bridge)
  const provider1 = await prisma.provider.create({
    data: { name: "Vitality Wellness Co.", notes: "D2C hormone therapy brand" },
  });
  const provider2 = await prisma.provider.create({
    data: { name: "NovaDerm Health", notes: "Dermatology-focused brand" },
  });
  const provider3 = await prisma.provider.create({
    data: { name: "PeakLife Rx", notes: "Functional medicine brand" },
  });

  // Provider pricing — revenue rates (higher than pharmacy cost to create margin)
  // Provider prices are ~40-60% above the base pharmacy cost
  const providerMarkups = [1.45, 1.55, 1.40]; // per provider
  const providerAssignments = [
    // [medIndex range, providerId, markupIndex]
    { start: 0, end: 7, provider: provider1, markupIdx: 0 },   // Vitality covers first 7 meds
    { start: 3, end: 12, provider: provider2, markupIdx: 1 },  // NovaDerm covers meds 4-12
    { start: 8, end: 20, provider: provider3, markupIdx: 2 },  // PeakLife covers meds 9-20
  ];

  for (const assignment of providerAssignments) {
    for (let i = assignment.start; i <= Math.min(assignment.end, meds.length - 1); i++) {
      const providerPrice = Math.round(basePrices[i] * providerMarkups[assignment.markupIdx] * 100) / 100;
      // Vary verification: first 5 meds fresh, 5-8 aging, rest stale/unverified
      const provVerifiedAt = i < 5 ? twoWeeksAgo
        : i < 8 ? sixWeeksAgo
        : i < 12 ? threeMonthsAgo
        : null;

      await prisma.providerMedicationPrice.create({
        data: {
          providerId: assignment.provider.id,
          medicationId: meds[i].id,
          price: providerPrice,
          effectiveDate: threeMonthsAgo,
          notes: "Contract rate",
          verifiedAt: provVerifiedAt,
          verificationSource: provVerifiedAt ? "Contract review" : undefined,
        },
      });
    }
  }

  // Orders
  const order1 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient1.id, prescriberId: prescriber1.id, pharmacyId: pharmacy1.id, medicationName: "Testosterone Cypionate", strength: "200mg/mL", dosageForm: "Injectable Solution", route: "Intramuscular", directions: "Inject 0.5mL (100mg) intramuscularly once weekly", quantity: 10, refills: 2, daysSupply: 90, icd10: "E29.1", orderSource: "manual", priority: "normal", status: "submitted", sendReadiness: "ready" } });
  const order2 = await prisma.order.create({ data: { brandId: brand2.id, patientId: patient2.id, prescriberId: prescriber2.id, pharmacyId: pharmacy2.id, medicationName: "Progesterone", strength: "100mg", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule at bedtime", quantity: 30, refills: 5, daysSupply: 30, icd10: "N91.1", orderSource: "api", priority: "normal", status: "queued", sendReadiness: "ready" } });
  const order3 = await prisma.order.create({ data: { brandId: brand3.id, patientId: patient3.id, prescriberId: prescriber3.id, pharmacyId: pharmacy3.id, medicationName: "Low Dose Naltrexone", strength: "4.5mg", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule daily at bedtime", quantity: 30, refills: 3, daysSupply: 30, rxNotes: "Start at 1.5mg for first week, then increase to 4.5mg", orderSource: "ehr", priority: "normal", status: "sent_to_pharmacy", sendReadiness: "ready" } });
  const order4 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient4.id, prescriberId: prescriber1.id, pharmacyId: pharmacy1.id, medicationName: "Vitamin D3", strength: "50000 IU", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule weekly", quantity: 12, refills: 1, daysSupply: 84, orderSource: "manual", priority: "low", status: "draft", sendReadiness: "ready" } });
  const order5 = await prisma.order.create({ data: { brandId: brand2.id, patientId: patient2.id, prescriberId: prescriber2.id, pharmacyId: pharmacy2.id, medicationName: "Estradiol/Estriol Cream", strength: "80/20 ratio, 0.5mg/g", dosageForm: "Topical Cream", route: "Topical", directions: "Apply 1g to inner wrist daily", quantity: 30, daysSupply: 30, orderSource: "api", priority: "high", status: "needs_clarification", sendReadiness: "needs_review", internalNotes: "Prescriber needs to confirm concentration ratio" } });
  const order6 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient1.id, prescriberId: prescriber1.id, pharmacyId: pharmacy3.id, medicationName: "Thyroid T3/T4 Combination", strength: "5mcg T3 / 65mcg T4", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule every morning on empty stomach", quantity: 90, refills: 3, daysSupply: 90, icd10: "E03.9", orderSource: "manual", priority: "normal", status: "completed", sendReadiness: "ready" } });
  const order7 = await prisma.order.create({ data: { brandId: brand3.id, patientId: patient3.id, prescriberId: prescriber3.id, pharmacyId: pharmacy1.id, medicationName: "DHEA Cream", strength: "25mg/g", dosageForm: "Topical Cream", route: "Topical", orderSource: "ehr", priority: "normal", status: "submitted", sendReadiness: "missing_data", internalNotes: "Incomplete Rx from EHR — waiting on prescriber to send full sig" } });

  // Additional patients
  const patient5 = await prisma.patient.create({ data: { firstName: "Michael", lastName: "Davis", dob: "1975-06-12", phone: "4155551001", email: "mdavis@example.com", address1: "500 Market St", city: "San Francisco", state: "CA", zip: "94105" } });
  const patient6 = await prisma.patient.create({ data: { firstName: "Amanda", lastName: "Garcia", dob: "1988-09-04", phone: "7135552001", email: "agarcia@example.com", address1: "1200 Main St", city: "Houston", state: "TX", zip: "77002" } });
  const patient7 = await prisma.patient.create({ data: { firstName: "David", lastName: "Wilson", dob: "1965-02-28", phone: "3035553001", email: "dwilson@example.com", address1: "800 Colfax Ave", city: "Denver", state: "CO", zip: "80204" } });
  const patient8 = await prisma.patient.create({ data: { firstName: "Jennifer", lastName: "Lee", dob: "1995-11-15", phone: "6025554001", email: "jlee@example.com", address1: "2200 Camelback Rd", city: "Phoenix", state: "AZ", zip: "85016" } });
  const patient9 = await prisma.patient.create({ data: { firstName: "Christopher", lastName: "Brown", dob: "1982-04-20", phone: "9715555001", email: "cbrown@example.com", address1: "900 NW 23rd Ave", city: "Portland", state: "OR", zip: "97210" } });
  const patient10 = await prisma.patient.create({ data: { firstName: "Emily", lastName: "Taylor", dob: "1993-08-07", phone: "6155556001", email: "etaylor@example.com", address1: "400 Broadway", city: "Nashville", state: "TN", zip: "37203" } });
  const patient11 = await prisma.patient.create({ data: { firstName: "James", lastName: "Anderson", dob: "1970-12-01", phone: "3125557001", email: "janderson@example.com", address1: "233 S Wacker Dr", city: "Chicago", state: "IL", zip: "60606" } });
  const patient12 = await prisma.patient.create({ data: { firstName: "Maria", lastName: "Rodriguez", dob: "1987-03-22", phone: "3055558001", email: "mrodriguez@example.com", address1: "1000 Brickell Ave", city: "Miami", state: "FL", zip: "33131" } });

  // 15 additional orders across various states
  const order8 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient5.id, prescriberId: prescriber1.id, pharmacyId: pharmacy1.id, medicationName: "Testosterone Cypionate", strength: "200mg/mL", dosageForm: "Injectable Solution", route: "Intramuscular", directions: "Inject 0.5mL weekly", quantity: 10, refills: 2, daysSupply: 70, icd10: "E29.1", orderSource: "api", priority: "normal", status: "approved", sendReadiness: "ready" } });
  const order9 = await prisma.order.create({ data: { brandId: brand2.id, patientId: patient6.id, prescriberId: prescriber2.id, pharmacyId: pharmacy2.id, medicationName: "Progesterone Troche", strength: "200mg", dosageForm: "Troche", route: "Sublingual", directions: "Dissolve 1 troche under tongue at bedtime", quantity: 30, refills: 3, daysSupply: 30, orderSource: "manual", priority: "normal", status: "draft", sendReadiness: "ready" } });
  const order10 = await prisma.order.create({ data: { brandId: brand3.id, patientId: patient7.id, prescriberId: prescriber3.id, pharmacyId: pharmacy3.id, medicationName: "Metformin Extended Release", strength: "500mg", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule twice daily with meals", quantity: 60, refills: 5, daysSupply: 30, icd10: "E11.9", orderSource: "ehr", priority: "normal", status: "queued", sendReadiness: "ready" } });
  const order11 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient8.id, prescriberId: prescriber1.id, pharmacyId: pharmacy1.id, medicationName: "DHEA", strength: "25mg", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule daily in the morning", quantity: 30, refills: 2, daysSupply: 30, orderSource: "api", priority: "high", status: "submitted", sendReadiness: "ready" } });
  const order12 = await prisma.order.create({ data: { brandId: brand2.id, patientId: patient9.id, prescriberId: prescriber2.id, pharmacyId: pharmacy2.id, medicationName: "Pregnenolone", strength: "50mg", dosageForm: "Capsule", route: "Oral", quantity: 30, refills: 2, daysSupply: 30, orderSource: "manual", priority: "normal", status: "submitted", sendReadiness: "missing_data" } });
  const order13 = await prisma.order.create({ data: { brandId: brand3.id, patientId: patient10.id, prescriberId: prescriber3.id, pharmacyId: pharmacy3.id, medicationName: "Oxytocin Nasal Spray", strength: "40IU/mL", dosageForm: "Nasal Spray", route: "Intranasal", directions: "1 spray each nostril twice daily", quantity: 1, refills: 1, daysSupply: 30, orderSource: "ehr", priority: "urgent", status: "approved", sendReadiness: "ready" } });
  const order14 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient11.id, prescriberId: prescriber1.id, pharmacyId: pharmacy3.id, medicationName: "Sermorelin", strength: "9mg", dosageForm: "Injectable Solution", route: "Subcutaneous", directions: "Inject 300mcg subcutaneously at bedtime", quantity: 1, refills: 2, daysSupply: 30, icd10: "E23.0", orderSource: "api", priority: "normal", status: "queued", sendReadiness: "ready" } });
  const order15 = await prisma.order.create({ data: { brandId: brand2.id, patientId: patient12.id, prescriberId: prescriber2.id, pharmacyId: pharmacy1.id, medicationName: "BPC-157", strength: "500mcg", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule twice daily on empty stomach", quantity: 60, refills: 1, daysSupply: 30, orderSource: "manual", priority: "normal", status: "approved", sendReadiness: "ready" } });
  const order16 = await prisma.order.create({ data: { brandId: brand3.id, patientId: patient5.id, prescriberId: prescriber3.id, pharmacyId: pharmacy2.id, medicationName: "Glutathione", strength: "200mg/mL", dosageForm: "Injectable Solution", route: "Intramuscular", directions: "Inject 1mL intramuscularly twice weekly", quantity: 10, refills: 2, daysSupply: 35, orderSource: "ehr", priority: "normal", status: "sent_to_pharmacy", sendReadiness: "ready" } });
  const order17 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient6.id, prescriberId: prescriber1.id, pharmacyId: pharmacy3.id, medicationName: "NAD+ Nasal Spray", strength: "100mg/mL", dosageForm: "Nasal Spray", route: "Intranasal", orderSource: "api", priority: "normal", status: "submitted", sendReadiness: "missing_data" } });
  const order18 = await prisma.order.create({ data: { brandId: brand2.id, patientId: patient7.id, prescriberId: prescriber2.id, pharmacyId: pharmacy1.id, medicationName: "Methylcobalamin B12", strength: "5000mcg", dosageForm: "Sublingual Tablet", route: "Sublingual", directions: "Dissolve 1 tablet under tongue daily", quantity: 30, refills: 5, daysSupply: 30, orderSource: "manual", priority: "low", status: "draft", sendReadiness: "ready" } });
  const order19 = await prisma.order.create({ data: { brandId: brand3.id, patientId: patient8.id, prescriberId: prescriber3.id, pharmacyId: pharmacy2.id, medicationName: "Ipamorelin/CJC-1295", strength: "9mg/9mg", dosageForm: "Injectable Solution", route: "Subcutaneous", directions: "Inject 300mcg/300mcg subcutaneously at bedtime", quantity: 1, refills: 2, daysSupply: 30, icd10: "E23.0", orderSource: "ehr", priority: "high", status: "needs_clarification", sendReadiness: "needs_review", internalNotes: "Brand requesting dose confirmation from prescriber" } });
  const order20 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient9.id, prescriberId: prescriber1.id, pharmacyId: pharmacy3.id, medicationName: "Tretinoin Cream", strength: "0.05%", dosageForm: "Topical Cream", route: "Topical", directions: "Apply thin layer to face at bedtime", quantity: 30, refills: 3, daysSupply: 30, orderSource: "manual", priority: "normal", status: "completed", sendReadiness: "ready" } });
  const order21 = await prisma.order.create({ data: { brandId: brand2.id, patientId: patient10.id, prescriberId: prescriber2.id, pharmacyId: pharmacy1.id, medicationName: "Sildenafil Troche", strength: "50mg", dosageForm: "Troche", route: "Sublingual", directions: "Dissolve 1 troche under tongue as needed, max 1 per day", quantity: 10, refills: 2, daysSupply: 30, orderSource: "api", priority: "normal", status: "queued", sendReadiness: "ready" } });
  const order22 = await prisma.order.create({ data: { brandId: brand3.id, patientId: patient11.id, prescriberId: prescriber3.id, pharmacyId: pharmacy2.id, medicationName: "Tadalafil Capsule", strength: "5mg", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule daily", quantity: 30, refills: 5, daysSupply: 30, orderSource: "ehr", priority: "normal", status: "approved", sendReadiness: "ready" } });

  // Mock pricing — GPO discount ranges from 15-40% off retail
  const pricingData: Record<string, { retail: number; discount: number }> = {
    "Testosterone Cypionate": { retail: 185, discount: 0.32 },
    "Progesterone": { retail: 65, discount: 0.28 },
    "Progesterone Troche": { retail: 78, discount: 0.25 },
    "Low Dose Naltrexone": { retail: 45, discount: 0.35 },
    "Vitamin D3": { retail: 25, discount: 0.20 },
    "Estradiol/Estriol Cream": { retail: 120, discount: 0.30 },
    "Thyroid T3/T4 Combination": { retail: 95, discount: 0.28 },
    "DHEA Cream": { retail: 55, discount: 0.22 },
    "DHEA": { retail: 40, discount: 0.25 },
    "Pregnenolone": { retail: 48, discount: 0.20 },
    "Oxytocin Nasal Spray": { retail: 165, discount: 0.35 },
    "Sermorelin": { retail: 280, discount: 0.38 },
    "BPC-157": { retail: 195, discount: 0.30 },
    "Glutathione": { retail: 145, discount: 0.33 },
    "NAD+ Nasal Spray": { retail: 220, discount: 0.36 },
    "Methylcobalamin B12": { retail: 30, discount: 0.18 },
    "Ipamorelin/CJC-1295": { retail: 320, discount: 0.40 },
    "Tretinoin Cream": { retail: 85, discount: 0.25 },
    "Sildenafil Troche": { retail: 110, discount: 0.30 },
    "Tadalafil Capsule": { retail: 75, discount: 0.28 },
    "Metformin Extended Release": { retail: 35, discount: 0.15 },
  };

  const allOrders = [order1, order2, order3, order4, order5, order6, order7, order8, order9, order10, order11, order12, order13, order14, order15, order16, order17, order18, order19, order20, order21, order22];
  for (const order of allOrders) {
    const med = pricingData[order.medicationName];
    if (med) {
      const gpoPrice = Math.round(med.retail * (1 - med.discount) * 100) / 100;
      const pricing = {
        gpoPrice,
        retailEstimate: med.retail,
        savingsAbsolute: Math.round((med.retail - gpoPrice) * 100) / 100,
        savingsPercent: Math.round(med.discount * 100),
      };
      await prisma.order.update({ where: { id: order.id }, data: { pricingJson: JSON.stringify(pricing) } });
    }
  }

  // Issues for new orders
  await prisma.issue.create({ data: { orderId: order12.id, type: "missing_required_field", severity: "blocking", source: "system", fieldPath: "medication.directions", title: "Directions missing", message: "Required by pharmacy" } });
  await prisma.issue.create({ data: { orderId: order17.id, type: "missing_required_field", severity: "blocking", source: "system", fieldPath: "medication.directions", title: "Directions missing", message: "Required by pharmacy" } });
  await prisma.issue.create({ data: { orderId: order17.id, type: "missing_required_field", severity: "blocking", source: "system", fieldPath: "medication.quantity", title: "Quantity missing", message: "Required by pharmacy" } });
  await prisma.issue.create({ data: { orderId: order19.id, type: "clarification_request", severity: "blocking", source: "rx_bridge_user", title: "Dose confirmation needed", message: "Brand requesting prescriber confirm Ipamorelin/CJC-1295 dosing" } });

  // Issues (unified Issue model)
  await prisma.issue.create({ data: { orderId: order5.id, type: "clarification_request", severity: "blocking", source: "rx_bridge_user", title: "Concentration ratio unclear", message: "Prescriber needs to confirm exact 80/20 ratio before compounding" } });
  await prisma.issue.create({ data: { orderId: order7.id, type: "missing_required_field", severity: "blocking", source: "system", fieldPath: "medication.directions", title: "Directions missing", message: "Required by pharmacy" } });
  await prisma.issue.create({ data: { orderId: order7.id, type: "missing_required_field", severity: "blocking", source: "system", fieldPath: "medication.quantity", title: "Quantity missing", message: "Required by pharmacy" } });

  // Transmission for order 3
  await prisma.orderTransmission.create({ data: { orderId: order3.id, pharmacyId: pharmacy3.id, method: "manual", payloadSnapshot: JSON.stringify({ orderId: order3.id, format: "standard" }), overrideUsed: false } });

  // Status history
  const statusHistories = [
    { orderId: order1.id, status: "draft", note: "Order created via manual" },
    { orderId: order1.id, status: "submitted", note: "Submitted for review" },
    { orderId: order2.id, status: "submitted", note: "Order created via api" },
    { orderId: order2.id, status: "under_review", note: "Under clinical review" },
    { orderId: order2.id, status: "approved", note: "Approved — ready for pharmacy" },
    { orderId: order2.id, status: "queued", note: "Added to send queue" },
    { orderId: order3.id, status: "submitted", note: "Order created via ehr" },
    { orderId: order3.id, status: "approved", note: "Approved" },
    { orderId: order3.id, status: "sent_to_pharmacy", note: "Sent to BioFormula Pharmacy" },
    { orderId: order4.id, status: "draft", note: "Order created via manual" },
    { orderId: order5.id, status: "submitted", note: "Order created via api" },
    { orderId: order5.id, status: "needs_clarification", note: "Concentration ratio unclear — contacting prescriber" },
    { orderId: order6.id, status: "draft", note: "Order created via manual" },
    { orderId: order6.id, status: "submitted", note: "Submitted" },
    { orderId: order6.id, status: "approved", note: "Approved" },
    { orderId: order6.id, status: "sent_to_pharmacy", note: "Sent to pharmacy" },
    { orderId: order6.id, status: "completed", note: "Pharmacy confirmed fill" },
    { orderId: order7.id, status: "submitted", note: "Order created via ehr — incomplete data" },
    // New orders
    { orderId: order8.id, status: "submitted", note: "Order created via api" },
    { orderId: order8.id, status: "approved", note: "Approved" },
    { orderId: order9.id, status: "draft", note: "Order created via manual" },
    { orderId: order10.id, status: "submitted", note: "Order created via ehr" },
    { orderId: order10.id, status: "approved", note: "Approved" },
    { orderId: order10.id, status: "queued", note: "Added to send queue" },
    { orderId: order11.id, status: "submitted", note: "Order created via api" },
    { orderId: order12.id, status: "draft", note: "Order created via manual" },
    { orderId: order12.id, status: "submitted", note: "Submitted for review" },
    { orderId: order13.id, status: "submitted", note: "Order created via ehr" },
    { orderId: order13.id, status: "approved", note: "Approved — urgent" },
    { orderId: order14.id, status: "submitted", note: "Order created via api" },
    { orderId: order14.id, status: "approved", note: "Approved" },
    { orderId: order14.id, status: "queued", note: "Added to send queue" },
    { orderId: order15.id, status: "draft", note: "Order created via manual" },
    { orderId: order15.id, status: "submitted", note: "Submitted" },
    { orderId: order15.id, status: "approved", note: "Approved" },
    { orderId: order16.id, status: "submitted", note: "Order created via ehr" },
    { orderId: order16.id, status: "approved", note: "Approved" },
    { orderId: order16.id, status: "queued", note: "Added to send queue" },
    { orderId: order16.id, status: "sent_to_pharmacy", note: "Sent to PrecisionMed Compounding" },
    { orderId: order17.id, status: "submitted", note: "Order created via api — incomplete data" },
    { orderId: order18.id, status: "draft", note: "Order created via manual" },
    { orderId: order19.id, status: "submitted", note: "Order created via ehr" },
    { orderId: order19.id, status: "needs_clarification", note: "Brand requesting dose confirmation" },
    { orderId: order20.id, status: "draft", note: "Order created via manual" },
    { orderId: order20.id, status: "submitted", note: "Submitted" },
    { orderId: order20.id, status: "approved", note: "Approved" },
    { orderId: order20.id, status: "sent_to_pharmacy", note: "Sent to BioFormula Pharmacy" },
    { orderId: order20.id, status: "completed", note: "Pharmacy confirmed fill" },
    { orderId: order21.id, status: "submitted", note: "Order created via api" },
    { orderId: order21.id, status: "approved", note: "Approved" },
    { orderId: order21.id, status: "queued", note: "Added to send queue" },
    { orderId: order22.id, status: "submitted", note: "Order created via ehr" },
    { orderId: order22.id, status: "approved", note: "Approved" },
  ];

  for (const entry of statusHistories) {
    await prisma.orderStatusHistory.create({ data: entry });
  }

  console.log("Seed data created successfully");
  console.log("  3 brands, 3 pharmacies, 5 brand-pharmacy configs");
  console.log("  3 prescribers, 12 patients, 22 orders, 7 issues, 1 transmission");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
