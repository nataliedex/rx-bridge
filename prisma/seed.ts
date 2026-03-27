import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Brands
  const brand1 = await prisma.brand.create({
    data: {
      name: "Vitality Wellness Co.", active: true, notes: "D2C hormone therapy brand — high volume",
      contactName: "Amanda Chen", email: "amanda@vitalitywellness.com", phone: "5125559001", website: "https://vitalitywellness.com",
    },
  });
  const brand2 = await prisma.brand.create({
    data: {
      name: "NovaDerm Health", active: true, notes: "Dermatology-focused brand — topical compounding",
      contactName: "Marcus Rivera", email: "marcus@novaderm.com", phone: "3105559002", website: "https://novadermhealth.com",
    },
  });
  const brand3 = await prisma.brand.create({
    data: {
      name: "PeakLife Rx", active: true, notes: "Functional medicine brand — LDN, integrative protocols",
      contactName: "Dr. Sarah Kim", email: "sarah@peakliferx.com", phone: "6465559003",
    },
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

  // Medications (network catalog) — sellPrice is the Rx-Bridge negotiated rate (same for all brands)
  const medData = [
    { name: "Testosterone Cypionate", form: "Injectable Solution", strength: "200mg/mL" },
    { name: "Progesterone", form: "Capsule", strength: "100mg" },
    { name: "Progesterone Troche", form: "Troche", strength: "200mg" },
    { name: "Low Dose Naltrexone", form: "Capsule", strength: "4.5mg" },
    { name: "Vitamin D3", form: "Capsule", strength: "50000 IU" },
    { name: "Estradiol/Estriol Cream", form: "Topical Cream", strength: "80/20 ratio" },
    { name: "Thyroid T3/T4 Combination", form: "Capsule", strength: "5mcg/65mcg" },
    { name: "DHEA", form: "Capsule", strength: "25mg" },
    { name: "Sermorelin", form: "Injectable Solution", strength: "9mg" },
    { name: "BPC-157", form: "Capsule", strength: "500mcg" },
    { name: "Glutathione", form: "Injectable Solution", strength: "200mg/mL" },
    { name: "Oxytocin Nasal Spray", form: "Nasal Spray", strength: "40IU/mL" },
    { name: "NAD+ Nasal Spray", form: "Nasal Spray", strength: "100mg/mL" },
    { name: "Sildenafil Troche", form: "Troche", strength: "50mg" },
    { name: "Tadalafil Capsule", form: "Capsule", strength: "5mg" },
    { name: "Ipamorelin/CJC-1295", form: "Injectable Solution", strength: "9mg/9mg" },
    { name: "Metformin Extended Release", form: "Capsule", strength: "500mg" },
    { name: "Methylcobalamin B12", form: "Sublingual Tablet", strength: "5000mcg" },
    { name: "Tretinoin Cream", form: "Topical Cream", strength: "0.05%" },
    { name: "DHEA Cream", form: "Topical Cream", strength: "25mg/g" },
    { name: "Pregnenolone", form: "Capsule", strength: "50mg" },
    { name: "Semaglutide", form: "Injectable Solution", strength: "5mg/2mL" },
    { name: "Tirzepatide", form: "Injectable Solution", strength: "10mg/2mL" },
    { name: "Semaglutide Sublingual", form: "Sublingual Tablet", strength: "2mg" },
  ];

  // Per-unit pharmacy costs (base, at cheapest pharmacy).
  // Pricing basis by form:
  //   Capsule/Troche/Sublingual Tablet → per unit
  //   Injectable Solution → per vial (1 vial = 30-day supply)
  //   Topical Cream → per tube/jar (30g = 30-day supply)
  //   Nasal Spray → per bottle (1 bottle = 30-day supply)
  const basePrices: number[] = [
    85.00,   // Testosterone Cypionate — per vial (10mL)
    1.10,    // Progesterone — per cap
    1.40,    // Progesterone Troche — per troche
    0.90,    // Low Dose Naltrexone — per cap
    0.55,    // Vitamin D3 — per cap
    52.00,   // Estradiol/Estriol Cream — per tube (30g)
    1.80,    // Thyroid T3/T4 — per cap
    0.65,    // DHEA — per cap
    175.00,  // Sermorelin — per vial
    2.80,    // BPC-157 — per cap
    72.00,   // Glutathione — per vial (10mL)
    58.00,   // Oxytocin Nasal Spray — per bottle
    95.00,   // NAD+ Nasal Spray — per bottle
    3.50,    // Sildenafil Troche — per troche
    1.80,    // Tadalafil Capsule — per cap
    195.00,  // Ipamorelin/CJC-1295 — per vial
    0.35,    // Metformin ER — per cap
    0.40,    // Methylcobalamin B12 — per tab
    35.00,   // Tretinoin Cream — per tube (30g)
    28.00,   // DHEA Cream — per tube (30g)
    0.70,    // Pregnenolone — per cap
    165.00,  // Semaglutide — per vial (2mL, 4-week supply)
    195.00,  // Tirzepatide — per vial (2mL, 4-week supply)
    4.50,    // Semaglutide Sublingual — per tab (daily)
  ];

  // Sell prices (Rx-Bridge negotiated GPO rate, same per-unit basis as above).
  // Margins range 28–39% to provide realistic variety for analytics demos.
  const sellPrices: number[] = [
    125.00,  // Testosterone Cypionate (32% margin)
    1.60,    // Progesterone (31%)
    2.15,    // Progesterone Troche (35%)
    1.45,    // Low Dose Naltrexone (38%)
    0.80,    // Vitamin D3 (31%)
    78.00,   // Estradiol/Estriol Cream (33%)
    2.50,    // Thyroid T3/T4 (28%)
    0.95,    // DHEA (32%)
    275.00,  // Sermorelin (36%)
    4.25,    // BPC-157 (34%)
    105.00,  // Glutathione (31%)
    92.00,   // Oxytocin Nasal Spray (37%)
    150.00,  // NAD+ Nasal Spray (37%)
    5.75,    // Sildenafil Troche (39%)
    2.85,    // Tadalafil Capsule (37%)
    310.00,  // Ipamorelin/CJC-1295 (37%)
    0.50,    // Metformin ER (30%)
    0.60,    // Methylcobalamin B12 (33%)
    55.00,   // Tretinoin Cream (36%)
    42.00,   // DHEA Cream (33%)
    1.05,    // Pregnenolone (33%)
    299.00,  // Semaglutide (45% margin — high demand, premium positioning)
    379.00,  // Tirzepatide (49% margin — newest GLP-1, highest demand)
    8.50,    // Semaglutide Sublingual (47% margin — convenience premium)
  ];

  // Create medications with explicit sell prices
  const meds = await Promise.all(
    medData.map((d, i) =>
      prisma.medication.create({
        data: { ...d, sellPrice: sellPrices[i] },
      })
    )
  );

  // Medication pricing history — date-stamped entries
  const pharmacies = [pharmacy1, pharmacy2, pharmacy3];
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const sixWeeksAgo = new Date(Date.now() - 42 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Skip a small number of medication-pharmacy combos to create "missing" rows in the audit.
  // Target: ~5% missing for demo realism (4 out of 72 = 5.6%).
  // Meds 19-20 (DHEA Cream, Pregnenolone): only at pharmacy1 — missing at pharmacy2+3
  for (let i = 0; i < meds.length; i++) {
    for (let p = 0; p < pharmacies.length; p++) {
      if (i >= 19 && i <= 20 && p >= 1) continue;  // DHEA Cream + Pregnenolone only at CompoundRx

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
          verificationSource: verifiedAt ? (i < 5 ? "contract_import" : "pharmacy_confirmed") : undefined,
        },
      });
    }
  }

  // Orders
  const order1 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient1.id, prescriberId: prescriber1.id, pharmacyId: pharmacy1.id, medicationName: "Testosterone Cypionate", strength: "200mg/mL", dosageForm: "Injectable Solution", route: "Intramuscular", directions: "Inject 0.5mL (100mg) intramuscularly once weekly", quantity: 1, refills: 4, daysSupply: 70, icd10: "E29.1", orderSource: "manual", priority: "normal", status: "submitted", sendReadiness: "ready" } });
  const order2 = await prisma.order.create({ data: { brandId: brand2.id, patientId: patient2.id, prescriberId: prescriber2.id, pharmacyId: pharmacy2.id, medicationName: "Progesterone", strength: "100mg", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule at bedtime", quantity: 30, refills: 5, daysSupply: 30, icd10: "N91.1", orderSource: "api", priority: "normal", status: "queued", sendReadiness: "ready" } });
  const order3 = await prisma.order.create({ data: { brandId: brand3.id, patientId: patient3.id, prescriberId: prescriber3.id, pharmacyId: pharmacy3.id, medicationName: "Low Dose Naltrexone", strength: "4.5mg", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule daily at bedtime", quantity: 30, refills: 3, daysSupply: 30, rxNotes: "Start at 1.5mg for first week, then increase to 4.5mg", orderSource: "ehr", priority: "normal", status: "sent_to_pharmacy", sendReadiness: "ready" } });
  const order4 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient4.id, prescriberId: prescriber1.id, pharmacyId: pharmacy1.id, medicationName: "Vitamin D3", strength: "50000 IU", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule weekly", quantity: 12, refills: 1, daysSupply: 84, orderSource: "manual", priority: "low", status: "draft", sendReadiness: "ready" } });
  const order5 = await prisma.order.create({ data: { brandId: brand2.id, patientId: patient2.id, prescriberId: prescriber2.id, pharmacyId: pharmacy2.id, medicationName: "Estradiol/Estriol Cream", strength: "80/20 ratio, 0.5mg/g", dosageForm: "Topical Cream", route: "Topical", directions: "Apply 1g to inner wrist daily", quantity: 1, daysSupply: 30, orderSource: "api", priority: "high", status: "needs_clarification", sendReadiness: "needs_review", internalNotes: "Prescriber needs to confirm concentration ratio" } });
  const order6 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient1.id, prescriberId: prescriber1.id, pharmacyId: pharmacy3.id, medicationName: "Thyroid T3/T4 Combination", strength: "5mcg T3 / 65mcg T4", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule every morning on empty stomach", quantity: 90, refills: 3, daysSupply: 90, icd10: "E03.9", orderSource: "manual", priority: "normal", status: "completed", sendReadiness: "ready", completedAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000) } });
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
  const order8 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient5.id, prescriberId: prescriber1.id, pharmacyId: pharmacy1.id, medicationName: "Testosterone Cypionate", strength: "200mg/mL", dosageForm: "Injectable Solution", route: "Intramuscular", directions: "Inject 0.5mL weekly", quantity: 1, refills: 4, daysSupply: 70, icd10: "E29.1", orderSource: "api", priority: "normal", status: "approved", sendReadiness: "ready" } });
  const order9 = await prisma.order.create({ data: { brandId: brand2.id, patientId: patient6.id, prescriberId: prescriber2.id, pharmacyId: pharmacy2.id, medicationName: "Progesterone Troche", strength: "200mg", dosageForm: "Troche", route: "Sublingual", directions: "Dissolve 1 troche under tongue at bedtime", quantity: 30, refills: 3, daysSupply: 30, orderSource: "manual", priority: "normal", status: "draft", sendReadiness: "ready" } });
  const order10 = await prisma.order.create({ data: { brandId: brand3.id, patientId: patient7.id, prescriberId: prescriber3.id, pharmacyId: pharmacy3.id, medicationName: "Metformin Extended Release", strength: "500mg", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule twice daily with meals", quantity: 60, refills: 5, daysSupply: 30, icd10: "E11.9", orderSource: "ehr", priority: "normal", status: "queued", sendReadiness: "ready" } });
  const order11 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient8.id, prescriberId: prescriber1.id, pharmacyId: pharmacy1.id, medicationName: "DHEA", strength: "25mg", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule daily in the morning", quantity: 30, refills: 2, daysSupply: 30, orderSource: "api", priority: "high", status: "submitted", sendReadiness: "ready" } });
  const order12 = await prisma.order.create({ data: { brandId: brand2.id, patientId: patient9.id, prescriberId: prescriber2.id, pharmacyId: pharmacy2.id, medicationName: "Pregnenolone", strength: "50mg", dosageForm: "Capsule", route: "Oral", quantity: 30, refills: 2, daysSupply: 30, orderSource: "manual", priority: "normal", status: "submitted", sendReadiness: "missing_data" } });
  const order13 = await prisma.order.create({ data: { brandId: brand3.id, patientId: patient10.id, prescriberId: prescriber3.id, pharmacyId: pharmacy3.id, medicationName: "Oxytocin Nasal Spray", strength: "40IU/mL", dosageForm: "Nasal Spray", route: "Intranasal", directions: "1 spray each nostril twice daily", quantity: 1, refills: 1, daysSupply: 30, orderSource: "ehr", priority: "urgent", status: "approved", sendReadiness: "ready" } });
  const order14 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient11.id, prescriberId: prescriber1.id, pharmacyId: pharmacy3.id, medicationName: "Sermorelin", strength: "9mg", dosageForm: "Injectable Solution", route: "Subcutaneous", directions: "Inject 300mcg subcutaneously at bedtime", quantity: 1, refills: 2, daysSupply: 30, icd10: "E23.0", orderSource: "api", priority: "normal", status: "queued", sendReadiness: "ready" } });
  const order15 = await prisma.order.create({ data: { brandId: brand2.id, patientId: patient12.id, prescriberId: prescriber2.id, pharmacyId: pharmacy1.id, medicationName: "BPC-157", strength: "500mcg", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule twice daily on empty stomach", quantity: 60, refills: 1, daysSupply: 30, orderSource: "manual", priority: "normal", status: "approved", sendReadiness: "ready" } });
  const order16 = await prisma.order.create({ data: { brandId: brand3.id, patientId: patient5.id, prescriberId: prescriber3.id, pharmacyId: pharmacy2.id, medicationName: "Glutathione", strength: "200mg/mL", dosageForm: "Injectable Solution", route: "Intramuscular", directions: "Inject 1mL intramuscularly twice weekly", quantity: 1, refills: 2, daysSupply: 35, orderSource: "ehr", priority: "normal", status: "sent_to_pharmacy", sendReadiness: "ready" } });
  const order17 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient6.id, prescriberId: prescriber1.id, pharmacyId: pharmacy3.id, medicationName: "NAD+ Nasal Spray", strength: "100mg/mL", dosageForm: "Nasal Spray", route: "Intranasal", orderSource: "api", priority: "normal", status: "submitted", sendReadiness: "missing_data" } });
  const order18 = await prisma.order.create({ data: { brandId: brand2.id, patientId: patient7.id, prescriberId: prescriber2.id, pharmacyId: pharmacy1.id, medicationName: "Methylcobalamin B12", strength: "5000mcg", dosageForm: "Sublingual Tablet", route: "Sublingual", directions: "Dissolve 1 tablet under tongue daily", quantity: 30, refills: 5, daysSupply: 30, orderSource: "manual", priority: "low", status: "draft", sendReadiness: "ready" } });
  const order19 = await prisma.order.create({ data: { brandId: brand3.id, patientId: patient8.id, prescriberId: prescriber3.id, pharmacyId: pharmacy2.id, medicationName: "Ipamorelin/CJC-1295", strength: "9mg/9mg", dosageForm: "Injectable Solution", route: "Subcutaneous", directions: "Inject 300mcg/300mcg subcutaneously at bedtime", quantity: 1, refills: 2, daysSupply: 30, icd10: "E23.0", orderSource: "ehr", priority: "high", status: "needs_clarification", sendReadiness: "needs_review", internalNotes: "Brand requesting dose confirmation from prescriber" } });
  const order20 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient9.id, prescriberId: prescriber1.id, pharmacyId: pharmacy3.id, medicationName: "Tretinoin Cream", strength: "0.05%", dosageForm: "Topical Cream", route: "Topical", directions: "Apply thin layer to face at bedtime", quantity: 1, refills: 3, daysSupply: 30, orderSource: "manual", priority: "normal", status: "completed", sendReadiness: "ready", completedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } });
  const order21 = await prisma.order.create({ data: { brandId: brand2.id, patientId: patient10.id, prescriberId: prescriber2.id, pharmacyId: pharmacy1.id, medicationName: "Sildenafil Troche", strength: "50mg", dosageForm: "Troche", route: "Sublingual", directions: "Dissolve 1 troche under tongue as needed, max 1 per day", quantity: 10, refills: 2, daysSupply: 30, orderSource: "api", priority: "normal", status: "queued", sendReadiness: "ready" } });
  const order22 = await prisma.order.create({ data: { brandId: brand3.id, patientId: patient11.id, prescriberId: prescriber3.id, pharmacyId: pharmacy2.id, medicationName: "Tadalafil Capsule", strength: "5mg", dosageForm: "Capsule", route: "Oral", directions: "Take 1 capsule daily", quantity: 30, refills: 5, daysSupply: 30, orderSource: "ehr", priority: "normal", status: "approved", sendReadiness: "ready" } });
  const order23 = await prisma.order.create({ data: { brandId: brand1.id, patientId: patient4.id, prescriberId: prescriber1.id, pharmacyId: pharmacy1.id, medicationName: "Semaglutide", strength: "5mg/2mL", dosageForm: "Injectable Solution", route: "Subcutaneous", directions: "Inject 0.25mg subcutaneously once weekly for 4 weeks, then increase to 0.5mg weekly", quantity: 1, refills: 5, daysSupply: 28, icd10: "E66.01", orderSource: "api", priority: "normal", status: "queued", sendReadiness: "ready" } });
  const order24 = await prisma.order.create({ data: { brandId: brand2.id, patientId: patient8.id, prescriberId: prescriber2.id, pharmacyId: pharmacy2.id, medicationName: "Tirzepatide", strength: "10mg/2mL", dosageForm: "Injectable Solution", route: "Subcutaneous", directions: "Inject 2.5mg subcutaneously once weekly", quantity: 1, refills: 5, daysSupply: 28, icd10: "E66.01", orderSource: "ehr", priority: "high", status: "sent_to_pharmacy", sendReadiness: "ready" } });
  const order25 = await prisma.order.create({ data: { brandId: brand3.id, patientId: patient10.id, prescriberId: prescriber3.id, pharmacyId: pharmacy1.id, medicationName: "Semaglutide Sublingual", strength: "2mg", dosageForm: "Sublingual Tablet", route: "Sublingual", directions: "Dissolve 1 tablet under tongue daily in the morning on empty stomach", quantity: 30, refills: 5, daysSupply: 30, icd10: "E11.65", orderSource: "manual", priority: "normal", status: "submitted", sendReadiness: "ready" } });

  // Per-fill retail estimates and GPO discounts.
  // Retail = what a patient would pay direct (no GPO).
  // GPO price = retail × (1 - discount) ≈ sellPrice × typical qty.
  const pricingData: Record<string, { retail: number; discount: number }> = {
    "Testosterone Cypionate": { retail: 180, discount: 0.31 },           // GPO ~$124 vs sell $125/vial
    "Progesterone": { retail: 65, discount: 0.26 },                      // GPO ~$48 vs 30 × $1.60
    "Progesterone Troche": { retail: 85, discount: 0.24 },               // GPO ~$65 vs 30 × $2.15
    "Low Dose Naltrexone": { retail: 55, discount: 0.21 },               // GPO ~$43 vs 30 × $1.45
    "Vitamin D3": { retail: 15, discount: 0.36 },                        // GPO ~$10 vs 12 × $0.80
    "Estradiol/Estriol Cream": { retail: 115, discount: 0.32 },          // GPO ~$78 vs sell $78/tube
    "Thyroid T3/T4 Combination": { retail: 295, discount: 0.24 },        // GPO ~$224 vs 90 × $2.50
    "DHEA Cream": { retail: 60, discount: 0.30 },                        // GPO ~$42 vs sell $42/tube
    "DHEA": { retail: 40, discount: 0.29 },                              // GPO ~$28 vs 30 × $0.95
    "Pregnenolone": { retail: 45, discount: 0.30 },                      // GPO ~$32 vs 30 × $1.05
    "Oxytocin Nasal Spray": { retail: 135, discount: 0.32 },             // GPO ~$92 vs sell $92/bottle
    "Sermorelin": { retail: 395, discount: 0.30 },                       // GPO ~$277 vs sell $275/vial
    "BPC-157": { retail: 350, discount: 0.27 },                          // GPO ~$256 vs 60 × $4.25
    "Glutathione": { retail: 155, discount: 0.32 },                      // GPO ~$105 vs sell $105/vial
    "NAD+ Nasal Spray": { retail: 225, discount: 0.33 },                 // GPO ~$151 vs sell $150/bottle
    "Methylcobalamin B12": { retail: 28, discount: 0.36 },               // GPO ~$18 vs 30 × $0.60
    "Ipamorelin/CJC-1295": { retail: 450, discount: 0.31 },              // GPO ~$311 vs sell $310/vial
    "Tretinoin Cream": { retail: 80, discount: 0.31 },                   // GPO ~$55 vs sell $55/tube
    "Sildenafil Troche": { retail: 85, discount: 0.32 },                 // GPO ~$58 vs 10 × $5.75
    "Tadalafil Capsule": { retail: 120, discount: 0.29 },                // GPO ~$85 vs 30 × $2.85
    "Metformin Extended Release": { retail: 42, discount: 0.29 },         // GPO ~$30 vs 60 × $0.50
    "Semaglutide": { retail: 550, discount: 0.46 },                       // GPO ~$297 vs sell $299/vial (vs brand Ozempic ~$900+)
    "Tirzepatide": { retail: 650, discount: 0.42 },                       // GPO ~$377 vs sell $379/vial (vs brand Mounjaro ~$1000+)
    "Semaglutide Sublingual": { retail: 15, discount: 0.43 },             // GPO ~$8.55 vs sell $8.50/tab (30ct = ~$255/mo)
  };

  const allOrders = [order1, order2, order3, order4, order5, order6, order7, order8, order9, order10, order11, order12, order13, order14, order15, order16, order17, order18, order19, order20, order21, order22, order23, order24, order25];
  for (const order of allOrders) {
    const med = pricingData[order.medicationName];
    if (med) {
      const gpoPrice = Math.round(med.retail * (1 - med.discount) * 100) / 100;
      const pricing = {
        gpoPrice,
        retailEstimate: med.retail,
        savingsAbsolute: Math.round((med.retail - gpoPrice) * 100) / 100,
        savingsPercent: med.discount,
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
    // GLP-1 orders
    { orderId: order23.id, status: "submitted", note: "Order created via api" },
    { orderId: order23.id, status: "approved", note: "Approved" },
    { orderId: order23.id, status: "queued", note: "Added to send queue" },
    { orderId: order24.id, status: "submitted", note: "Order created via ehr" },
    { orderId: order24.id, status: "approved", note: "Approved — priority" },
    { orderId: order24.id, status: "sent_to_pharmacy", note: "Sent to PrecisionMed Compounding" },
    { orderId: order25.id, status: "submitted", note: "Order created via manual" },
  ];

  for (const entry of statusHistories) {
    await prisma.orderStatusHistory.create({ data: entry });
  }

  // --- Completed orders for Revenue analytics demo ---
  // Spread across brands, pharmacies, medications, and dates to populate
  // the Revenue page with meaningful data out of the box.
  const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

  const completedOrders = [
    // Recent (last 7 days)
    { brand: brand1, patient: patient1, prescriber: prescriber1, pharmacy: pharmacy1, med: "Testosterone Cypionate", strength: "200mg/mL", form: "Injectable Solution", qty: 1, refills: 4, days: 70, completedAt: daysAgo(2) },
    { brand: brand2, patient: patient2, prescriber: prescriber2, pharmacy: pharmacy2, med: "Progesterone", strength: "100mg", form: "Capsule", qty: 30, refills: 5, days: 30, completedAt: daysAgo(3) },
    { brand: brand3, patient: patient3, prescriber: prescriber3, pharmacy: pharmacy1, med: "Low Dose Naltrexone", strength: "4.5mg", form: "Capsule", qty: 30, refills: 3, days: 30, completedAt: daysAgo(5) },
    // Last 30 days
    { brand: brand1, patient: patient5, prescriber: prescriber1, pharmacy: pharmacy3, med: "Sermorelin", strength: "9mg", form: "Injectable Solution", qty: 1, refills: 2, days: 30, completedAt: daysAgo(12) },
    { brand: brand2, patient: patient6, prescriber: prescriber2, pharmacy: pharmacy2, med: "Estradiol/Estriol Cream", strength: "80/20 ratio", form: "Topical Cream", qty: 1, refills: 3, days: 30, completedAt: daysAgo(18) },
    { brand: brand3, patient: patient7, prescriber: prescriber3, pharmacy: pharmacy1, med: "BPC-157", strength: "500mcg", form: "Capsule", qty: 60, refills: 1, days: 30, completedAt: daysAgo(22) },
    { brand: brand1, patient: patient8, prescriber: prescriber1, pharmacy: pharmacy3, med: "DHEA", strength: "25mg", form: "Capsule", qty: 30, refills: 2, days: 30, completedAt: daysAgo(25) },
    { brand: brand2, patient: patient9, prescriber: prescriber2, pharmacy: pharmacy1, med: "Sildenafil Troche", strength: "50mg", form: "Troche", qty: 10, refills: 2, days: 30, completedAt: daysAgo(28) },
    // Older (30-60 days)
    { brand: brand3, patient: patient10, prescriber: prescriber3, pharmacy: pharmacy2, med: "Tadalafil Capsule", strength: "5mg", form: "Capsule", qty: 30, refills: 5, days: 30, completedAt: daysAgo(35) },
    { brand: brand1, patient: patient11, prescriber: prescriber1, pharmacy: pharmacy1, med: "Vitamin D3", strength: "50000 IU", form: "Capsule", qty: 12, refills: 1, days: 84, completedAt: daysAgo(40) },
    { brand: brand2, patient: patient12, prescriber: prescriber2, pharmacy: pharmacy3, med: "Metformin Extended Release", strength: "500mg", form: "Capsule", qty: 60, refills: 5, days: 30, completedAt: daysAgo(45) },
    { brand: brand3, patient: patient4, prescriber: prescriber3, pharmacy: pharmacy2, med: "Glutathione", strength: "200mg/mL", form: "Injectable Solution", qty: 1, refills: 2, days: 35, completedAt: daysAgo(50) },
    // GLP-1 completed orders
    { brand: brand1, patient: patient5, prescriber: prescriber1, pharmacy: pharmacy1, med: "Semaglutide", strength: "5mg/2mL", form: "Injectable Solution", qty: 1, refills: 3, days: 28, completedAt: daysAgo(6) },
    { brand: brand2, patient: patient6, prescriber: prescriber2, pharmacy: pharmacy2, med: "Tirzepatide", strength: "10mg/2mL", form: "Injectable Solution", qty: 1, refills: 3, days: 28, completedAt: daysAgo(10) },
    { brand: brand3, patient: patient7, prescriber: prescriber3, pharmacy: pharmacy1, med: "Semaglutide Sublingual", strength: "2mg", form: "Sublingual Tablet", qty: 30, refills: 5, days: 30, completedAt: daysAgo(14) },
    { brand: brand1, patient: patient12, prescriber: prescriber1, pharmacy: pharmacy2, med: "Semaglutide", strength: "5mg/2mL", form: "Injectable Solution", qty: 1, refills: 3, days: 28, completedAt: daysAgo(32) },
    { brand: brand2, patient: patient11, prescriber: prescriber2, pharmacy: pharmacy1, med: "Tirzepatide", strength: "10mg/2mL", form: "Injectable Solution", qty: 1, refills: 3, days: 28, completedAt: daysAgo(42) },
  ];

  for (const o of completedOrders) {
    const order = await prisma.order.create({
      data: {
        brandId: o.brand.id, patientId: o.patient.id, prescriberId: o.prescriber.id, pharmacyId: o.pharmacy.id,
        medicationName: o.med, strength: o.strength, dosageForm: o.form,
        directions: "As directed by prescriber", quantity: o.qty, refills: o.refills, daysSupply: o.days,
        orderSource: "api", priority: "normal", status: "completed", sendReadiness: "ready",
        completedAt: o.completedAt,
      },
    });
    // Full status history for each completed order
    await prisma.orderStatusHistory.create({ data: { orderId: order.id, status: "submitted", note: "Order created via api" } });
    await prisma.orderStatusHistory.create({ data: { orderId: order.id, status: "approved", note: "Approved" } });
    await prisma.orderStatusHistory.create({ data: { orderId: order.id, status: "sent_to_pharmacy", note: "Sent to pharmacy" } });
    await prisma.orderStatusHistory.create({ data: { orderId: order.id, status: "completed", note: "Pharmacy confirmed fill" } });
    await prisma.orderTransmission.create({ data: { orderId: order.id, pharmacyId: o.pharmacy.id, method: "manual", payloadSnapshot: JSON.stringify({ orderId: order.id, format: "standard" }), overrideUsed: false } });

    // Attach pricing
    const med = pricingData[o.med];
    if (med) {
      const gpoPrice = Math.round(med.retail * (1 - med.discount) * 100) / 100;
      await prisma.order.update({ where: { id: order.id }, data: { pricingJson: JSON.stringify({ gpoPrice, retailEstimate: med.retail, savingsAbsolute: Math.round((med.retail - gpoPrice) * 100) / 100, savingsPercent: med.discount }) } });
    }
  }

  // --- Filled refills for Revenue analytics demo ---
  // These represent refill fills with actual pharmacy economics (sellPriceCents, pharmacyCostCents).
  // Mix of complete data (high confidence) and partial data (data quality flags).
  // Refills reference existing completed orders (order6, order20, and the new completed orders).

  // Get some completed order IDs for refill references
  const completedOrderIds = await prisma.order.findMany({
    where: { status: "completed" },
    select: { id: true, patientId: true, pharmacyId: true, brandId: true, medicationName: true, quantity: true },
    orderBy: { completedAt: "desc" },
    take: 15,
  });

  // completedOrderIds order (by completedAt desc):
  // [0] Testosterone Cypionate (qty 1, vial) — sell $125, cost $85
  // [1] Progesterone (qty 30, caps) — sell 30×$1.60=$48, cost 30×$1.10=$33
  // [2] LDN (qty 30, caps) — sell 30×$1.45=$43.50, cost 30×$0.90=$27
  // [3] Semaglutide (qty 1, vial) — sell $299, cost $165
  // [4] Tirzepatide (qty 1, vial) — sell $379, cost $195 (pharmacy2 = ×1.08 = $210.60)
  // [5] Sermorelin (qty 1, vial) — sell $275, cost $175 (pharmacy3 = ×1.15 = $201.25)
  // [6] Semaglutide Sublingual (qty 30, tabs) — sell 30×$8.50=$255, cost 30×$4.50=$135
  // [7] Estradiol/Estriol Cream (qty 1, tube) — sell $78, cost $52 (pharmacy2 = ×1.08 = $56.16)
  // [8] BPC-157 (qty 60, caps) — sell 60×$4.25=$255, cost 60×$2.80=$168
  // [9] DHEA (qty 30, caps) — sell 30×$0.95=$28.50
  // [10] Sildenafil Troche (qty 10) — sell 10×$5.75=$57.50
  // [11] Semaglutide (qty 1, vial) — older fill, pharmacy2
  // [12] Tadalafil Capsule (qty 30)
  const refillData = [
    // High-confidence refills (both sell and cost present)
    { orderIdx: 0, filledDaysAgo: 1, sellCents: 12500, costCents: 8500, source: "brand_portal" },     // Testosterone — $125 / $85
    { orderIdx: 1, filledDaysAgo: 4, sellCents: 4800, costCents: 3300, source: "api" },                // Progesterone 30ct — $48 / $33
    { orderIdx: 2, filledDaysAgo: 8, sellCents: 4350, costCents: 2700, source: "brand_portal" },       // LDN 30ct — $43.50 / $27
    { orderIdx: 3, filledDaysAgo: 3, sellCents: 29900, costCents: 16500, source: "brand_portal" },     // Semaglutide — $299 / $165
    { orderIdx: 4, filledDaysAgo: 7, sellCents: 37900, costCents: 21060, source: "api" },              // Tirzepatide — $379 / $210.60
    { orderIdx: 5, filledDaysAgo: 15, sellCents: 27500, costCents: 20125, source: "api" },             // Sermorelin — $275 / $201.25
    { orderIdx: 6, filledDaysAgo: 12, sellCents: 25500, costCents: 13500, source: "brand_portal" },    // Semaglutide Sublingual 30ct — $255 / $135
    { orderIdx: 8, filledDaysAgo: 30, sellCents: 25500, costCents: 16800, source: "api" },             // BPC-157 60ct — $255 / $168
    { orderIdx: 7, filledDaysAgo: 20, sellCents: 7800, costCents: 5616, source: "brand_portal" },      // Estradiol cream — $78 / $56.16
    // Medium-confidence refill (missing cost — triggers DQ flag)
    { orderIdx: 9, filledDaysAgo: 10, sellCents: 2850, costCents: null, source: "brand_portal" },      // DHEA 30ct — $28.50 / no cost
    // Low-confidence refill (missing both — triggers DQ flags)
    { orderIdx: 10, filledDaysAgo: 25, sellCents: null, costCents: null, source: "api" },              // Sildenafil — no pricing data
  ];

  for (const r of refillData) {
    const order = completedOrderIds[r.orderIdx];
    if (!order) continue;
    await prisma.refillRequest.create({
      data: {
        orderId: order.id,
        brandId: order.brandId,
        patientId: order.patientId,
        pharmacyId: order.pharmacyId,
        medicationName: order.medicationName,
        quantity: order.quantity,
        status: "filled",
        source: r.source,
        sellPriceCents: r.sellCents,
        pharmacyCostCents: r.costCents,
        filledAt: daysAgo(r.filledDaysAgo),
        validatedAt: daysAgo(r.filledDaysAgo + 1),
        sentToPharmacyAt: daysAgo(r.filledDaysAgo + 1),
        pharmacyOrderId: `PH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        quantityDispensed: order.quantity,
      },
    });
  }

  // One in-flight refill (sent but not yet filled) for demo variety
  if (completedOrderIds[11]) {
    await prisma.refillRequest.create({
      data: {
        orderId: completedOrderIds[11].id,
        brandId: completedOrderIds[11].brandId,
        patientId: completedOrderIds[11].patientId,
        pharmacyId: completedOrderIds[11].pharmacyId,
        medicationName: completedOrderIds[11].medicationName,
        quantity: completedOrderIds[11].quantity,
        status: "sent_to_pharmacy",
        source: "brand_portal",
        validatedAt: daysAgo(2),
        sentToPharmacyAt: daysAgo(2),
      },
    });
  }

  console.log("Seed data created successfully");
  console.log("  3 brands, 3 pharmacies, 5 brand-pharmacy configs");
  console.log("  3 prescribers, 12 patients");
  console.log("  25 workflow orders + 17 completed orders = 42 total");
  console.log("  11 filled refills + 1 in-flight refill");
  console.log("  7 issues, transmissions, full status histories");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
