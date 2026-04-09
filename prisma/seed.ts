import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // App config — default pricing strategy
  await prisma.appConfig.create({
    data: {
      key: "pricing_strategy",
      value: JSON.stringify({
        mode: "markup_based",
        defaultMarkupPct: 25,
        allowMedicationOverrides: true,
        allowMedSpaOverrides: true,
      }),
    },
  });

  // Brands
  const brand1 = await prisma.brand.create({
    data: { name: "Vitality Wellness Co.", active: true, notes: "Weight management + hormone therapy brand — GLP-1 and TRT focus", contactName: "Amanda Chen", email: "amanda@vitalitywellness.com", phone: "5125559001", website: "https://vitalitywellness.com" },
  });
  const brand2 = await prisma.brand.create({
    data: { name: "NovaDerm Health", active: true, notes: "Aesthetics + skin health brand — med spa channel", contactName: "Marcus Rivera", email: "marcus@novaderm.com", phone: "3105559002", website: "https://novadermhealth.com" },
  });
  const brand3 = await prisma.brand.create({
    data: { name: "PeakLife Rx", active: true, notes: "Peptide therapy + wellness optimization brand", contactName: "Dr. Sarah Kim", email: "sarah@peakliferx.com", phone: "6465559003" },
  });

  // Pharmacies
  const pharmacy1 = await prisma.pharmacy.create({
    data: { name: "CompoundRx Pharmacy", contactName: "Sarah Mitchell", phone: "5125551234", fax: "5125551235", email: "orders@compoundrx.example.com" },
  });
  const pharmacy2 = await prisma.pharmacy.create({
    data: { name: "PrecisionMed Compounding", contactName: "James Carter", phone: "2125559876", fax: "2125559877", email: "intake@precisionmed.example.com" },
  });
  const pharmacy3 = await prisma.pharmacy.create({
    data: { name: "BioFormula Pharmacy", contactName: "Linda Tran", phone: "3105557890", fax: "3105557891", email: "rx@bioformula.example.com" },
  });

  // Medications — med spa focused
  const medData = [
    { name: "Semaglutide", form: "Injectable Solution", strength: "5mg/2mL" },
    { name: "Tirzepatide", form: "Injectable Solution", strength: "10mg/2mL" },
    { name: "Semaglutide Sublingual", form: "Sublingual Tablet", strength: "2mg" },
    { name: "Tretinoin Cream", form: "Topical Cream", strength: "0.05%" },
    { name: "Glutathione", form: "Injectable Solution", strength: "200mg/mL" },
    { name: "NAD+ Nasal Spray", form: "Nasal Spray", strength: "100mg/mL" },
    { name: "Testosterone Cypionate", form: "Injectable Solution", strength: "200mg/mL" },
    { name: "Sermorelin", form: "Injectable Solution", strength: "9mg" },
  ];

  const basePrices: number[] = [
    165.00,  // Semaglutide
    195.00,  // Tirzepatide
    4.50,    // Semaglutide Sublingual
    35.00,   // Tretinoin Cream
    72.00,   // Glutathione
    95.00,   // NAD+ Nasal Spray
    85.00,   // Testosterone Cypionate
    175.00,  // Sermorelin
  ];

  const sellPrices: number[] = [
    299.00,  // Semaglutide
    379.00,  // Tirzepatide
    8.50,    // Semaglutide Sublingual
    55.00,   // Tretinoin Cream
    105.00,  // Glutathione
    150.00,  // NAD+ Nasal Spray
    125.00,  // Testosterone Cypionate
    275.00,  // Sermorelin
  ];

  const meds = await Promise.all(
    medData.map((d, i) => prisma.medication.create({ data: { ...d, sellPrice: sellPrices[i] } }))
  );

  // Program pricing — global Rx-Bridge price per medication
  const now = new Date();
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  for (let i = 0; i < meds.length; i++) {
    await prisma.programPricing.create({
      data: {
        medicationId: meds[i].id,
        price: sellPrices[i],
        effectiveFrom: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        effectiveThrough: oneYearFromNow,
        status: "active",
        notes: "Initial program pricing",
      },
    });
  }

  // Medication pricing per pharmacy
  const pharmacies = [pharmacy1, pharmacy2, pharmacy3];
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const sixWeeksAgo = new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  for (let i = 0; i < meds.length; i++) {
    for (let p = 0; p < pharmacies.length; p++) {
      const multiplier = [1.0, 1.08, 1.15][p];
      const price = Math.round(basePrices[i] * multiplier * 100) / 100;

      // First 4 meds (GLP-1s + Tretinoin) verified recently; rest aging/stale
      const verifiedAt = i < 4 ? twoWeeksAgo : i < 6 ? sixWeeksAgo : null;

      await prisma.medicationPriceEntry.create({
        data: {
          medicationId: meds[i].id, pharmacyId: pharmacies[p].id,
          price, effectiveDate: i < 4 ? oneMonthAgo : threeMonthsAgo,
          verifiedAt, verificationSource: verifiedAt ? (i < 4 ? "contract_import" : "pharmacy_confirmed") : undefined,
        },
      });
    }
  }

  // Programs — pricing contracts between brands and pharmacies
  const brands = [brand1, brand2, brand3];
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  const programData = [
    // Vitality Wellness — weight management + hormones
    { brand: 0, pharm: 0, med: 0, rate: 285.00, code: "VIT-CRX-SEM-I9J0", start: daysAgo(30) },    // Semaglutide @ CompoundRx
    { brand: 0, pharm: 1, med: 1, rate: 365.00, code: "VIT-PRE-TIR-A7B8", start: daysAgo(20) },    // Tirzepatide @ PrecisionMed
    { brand: 0, pharm: 0, med: 6, rate: 120.00, code: "VIT-CRX-TES-A1B2", start: daysAgo(90) },    // Testosterone @ CompoundRx
    // NovaDerm Health — aesthetics
    { brand: 1, pharm: 1, med: 3, rate: 50.00, code: "NOV-PRE-TRE-K1L2", start: daysAgo(75) },     // Tretinoin @ PrecisionMed
    { brand: 1, pharm: 0, med: 4, rate: 98.00, code: "NOV-CRX-GLU-M3N4", start: daysAgo(50) },     // Glutathione @ CompoundRx
    // PeakLife Rx — peptides + wellness
    { brand: 2, pharm: 1, med: 7, rate: 265.00, code: "PLR-PRE-SER-S9T0", start: daysAgo(55) },    // Sermorelin @ PrecisionMed
    { brand: 2, pharm: 0, med: 1, rate: 360.00, code: "PLR-CRX-TIR-W3X4", start: daysAgo(25) },    // Tirzepatide @ CompoundRx
    { brand: 2, pharm: 2, med: 5, rate: 140.00, code: "PLR-BIO-NAD-U1V2", start: daysAgo(40) },    // NAD+ @ BioFormula
  ];

  for (const p of programData) {
    await prisma.program.create({
      data: {
        brandId: brands[p.brand].id,
        pharmacyId: pharmacies[p.pharm].id,
        medicationId: meds[p.med].id,
        negotiatedRate: p.rate,
        effectiveStart: p.start,
        referenceCode: p.code,
        status: "active",
      },
    });
  }

  // Fill Records — for reconciliation demo
  const fillData = [
    // Matches (actual = expected)
    { code: "VIT-CRX-SEM-I9J0", med: 0, pharm: 0, brand: 0, qty: 1, actual: 285.00, expected: 285.00, days: 3 },
    { code: "VIT-CRX-TES-A1B2", med: 6, pharm: 0, brand: 0, qty: 1, actual: 120.00, expected: 120.00, days: 5 },
    { code: "NOV-PRE-TRE-K1L2", med: 3, pharm: 1, brand: 1, qty: 1, actual: 50.00, expected: 50.00, days: 15 },
    { code: "PLR-PRE-SER-S9T0", med: 7, pharm: 1, brand: 2, qty: 1, actual: 265.00, expected: 265.00, days: 18 },
    { code: "PLR-CRX-TIR-W3X4", med: 1, pharm: 0, brand: 2, qty: 1, actual: 360.00, expected: 360.00, days: 7 },
    // Mismatches (pharmacy charged different rate)
    { code: "VIT-PRE-TIR-A7B8", med: 1, pharm: 1, brand: 0, qty: 1, actual: 372.00, expected: 365.00, days: 6 },
    { code: "PLR-BIO-NAD-U1V2", med: 5, pharm: 2, brand: 2, qty: 1, actual: 148.00, expected: 140.00, days: 14 },
    // Missing (fill exists but no matching program rate)
    { code: "UNKNOWN-001", med: 4, pharm: 1, brand: 1, qty: 1, actual: 78.00, expected: 0.00, days: 28 },
  ];

  for (const f of fillData) {
    const variance = Math.round((f.actual - f.expected) * 100) / 100;
    const status = f.expected === 0 ? "missing" : Math.abs(variance) < 0.01 ? "match" : "mismatch";
    await prisma.fillRecord.create({
      data: {
        referenceCode: f.code,
        medicationId: meds[f.med].id,
        pharmacyId: pharmacies[f.pharm].id,
        brandId: brands[f.brand].id,
        quantity: f.qty,
        actualRate: f.actual,
        expectedRate: f.expected,
        variance,
        status,
        fillDate: daysAgo(f.days),
      },
    });
  }

  // =============================================
  // MED SPAS
  // =============================================

  const spa1 = await prisma.medSpa.create({
    data: {
      name: "Glow Aesthetics", city: "Austin", state: "TX",
      contactName: "Jessica Palmer", email: "jessica@glowaesthetics.com", phone: "5125551001",
      pipelineStage: "negotiating", currentVendor: "Direct from local compounding",
      estMonthlyVolume: "$8,000 - $12,000", nextStep: "Send final pricing proposal",
      lastContactedAt: daysAgo(2),
    },
  });
  const spa2 = await prisma.medSpa.create({
    data: {
      name: "Revive Med Spa", city: "Scottsdale", state: "AZ",
      contactName: "Dr. Rachel Torres", email: "rachel@revivemedspa.com", phone: "4805552001",
      pipelineStage: "pricing_sent", currentVendor: "Regional GPO",
      estMonthlyVolume: "$10,000 - $15,000", nextStep: "Follow up on proposal — decision expected this week",
      lastContactedAt: daysAgo(5),
    },
  });
  const spa3 = await prisma.medSpa.create({
    data: {
      name: "Radiance Clinic", city: "Nashville", state: "TN",
      contactName: "Mark Sullivan", email: "mark@radianceclinic.com", phone: "6155553001",
      pipelineStage: "contacted", currentVendor: "Buying direct, no GPO",
      estMonthlyVolume: "$3,000 - $5,000", nextStep: "Schedule pricing discovery call",
      lastContactedAt: daysAgo(8),
    },
  });

  // Med Spa orders — historical purchases at higher prices than Rx-Bridge network
  const spaOrderData = [
    // Glow Aesthetics — high-volume GLP-1 + aesthetics clinic
    { spa: spa1, med: 0, pharm: 0, qty: 1, cost: 220.00, days: 3 },   // Semaglutide
    { spa: spa1, med: 0, pharm: 0, qty: 1, cost: 220.00, days: 32 },
    { spa: spa1, med: 0, pharm: 0, qty: 1, cost: 225.00, days: 61 },
    { spa: spa1, med: 1, pharm: 1, qty: 1, cost: 275.00, days: 7 },   // Tirzepatide
    { spa: spa1, med: 1, pharm: 1, qty: 1, cost: 275.00, days: 35 },
    { spa: spa1, med: 4, pharm: 0, qty: 1, cost: 105.00, days: 10 },  // Glutathione
    { spa: spa1, med: 4, pharm: 0, qty: 1, cost: 105.00, days: 40 },
    { spa: spa1, med: 5, pharm: 1, qty: 1, cost: 135.00, days: 14 },  // NAD+ Spray
    { spa: spa1, med: 3, pharm: 0, qty: 1, cost: 52.00, days: 20 },   // Tretinoin
    { spa: spa1, med: 3, pharm: 0, qty: 1, cost: 52.00, days: 50 },
    // Revive Med Spa — weight management focused
    { spa: spa2, med: 0, pharm: 1, qty: 1, cost: 230.00, days: 5 },   // Semaglutide
    { spa: spa2, med: 0, pharm: 1, qty: 1, cost: 230.00, days: 33 },
    { spa: spa2, med: 1, pharm: 2, qty: 1, cost: 290.00, days: 8 },   // Tirzepatide
    { spa: spa2, med: 1, pharm: 2, qty: 1, cost: 285.00, days: 36 },
    { spa: spa2, med: 2, pharm: 1, qty: 30, cost: 6.50, days: 12 },   // Semaglutide Sublingual
    { spa: spa2, med: 6, pharm: 2, qty: 1, cost: 125.00, days: 15 },  // Testosterone
    { spa: spa2, med: 6, pharm: 2, qty: 1, cost: 125.00, days: 45 },
    { spa: spa2, med: 7, pharm: 1, qty: 1, cost: 250.00, days: 18 },  // Sermorelin
    { spa: spa2, med: 4, pharm: 2, qty: 1, cost: 110.00, days: 22 },  // Glutathione
    // Radiance Clinic — prospect (smaller volume)
    { spa: spa3, med: 0, pharm: 0, qty: 1, cost: 240.00, days: 10 },  // Semaglutide
    { spa: spa3, med: 1, pharm: 0, qty: 1, cost: 280.00, days: 15 },  // Tirzepatide
    { spa: spa3, med: 3, pharm: 1, qty: 1, cost: 55.00, days: 20 },   // Tretinoin
  ];

  for (const o of spaOrderData) {
    await prisma.medSpaOrder.create({
      data: {
        medSpaId: o.spa.id,
        medicationId: meds[o.med].id,
        pharmacyId: pharmacies[o.pharm].id,
        quantity: o.qty,
        unitCost: o.cost,
        createdAt: daysAgo(o.days),
      },
    });
  }

  // Pricing lines — user-entered current pricing for each med spa
  const pricingLineData = [
    // Glow Aesthetics
    { spa: spa1, name: "Semaglutide", cost: 220.00, unit: "vial", qty: 3, vendor: "Local compounding pharmacy", source: "Invoice" },
    { spa: spa1, name: "Tirzepatide", cost: 275.00, unit: "vial", qty: 2, vendor: "Local compounding pharmacy", source: "Invoice" },
    { spa: spa1, name: "Glutathione", cost: 105.00, unit: "vial", qty: 2, vendor: "CompoundRx Pharmacy", source: "Invoice" },
    { spa: spa1, name: "NAD+ Nasal Spray", cost: 135.00, unit: "bottle", qty: 1, vendor: "PrecisionMed Compounding", source: "Invoice" },
    { spa: spa1, name: "Tretinoin Cream", cost: 52.00, unit: "tube", qty: 2, vendor: "CompoundRx Pharmacy", source: "Verbal quote" },
    // Revive Med Spa
    { spa: spa2, name: "Semaglutide", cost: 230.00, unit: "vial", qty: 4, vendor: "Regional GPO", source: "Contract" },
    { spa: spa2, name: "Tirzepatide", cost: 290.00, unit: "vial", qty: 3, vendor: "Regional GPO", source: "Contract" },
    { spa: spa2, name: "Semaglutide Sublingual", cost: 6.50, unit: "tablet", qty: 30, vendor: "Regional GPO", source: "Contract" },
    { spa: spa2, name: "Testosterone Cypionate", cost: 125.00, unit: "vial", qty: 2, vendor: "BioFormula Pharmacy", source: "Invoice" },
    { spa: spa2, name: "Sermorelin", cost: 250.00, unit: "vial", qty: 1, vendor: "PrecisionMed Compounding", source: "Invoice" },
    { spa: spa2, name: "Glutathione", cost: 110.00, unit: "vial", qty: 1, vendor: "BioFormula Pharmacy", source: "Invoice" },
    // Radiance Clinic (prospect — less data)
    { spa: spa3, name: "Semaglutide", cost: 240.00, unit: "vial", qty: 2, vendor: "Direct pharmacy", source: "Website" },
    { spa: spa3, name: "Tirzepatide", cost: 280.00, unit: "vial", qty: 1, vendor: "Direct pharmacy", source: "Website" },
    { spa: spa3, name: "Tretinoin Cream", cost: 55.00, unit: "tube", qty: 1, vendor: "Direct pharmacy", source: "Verbal quote" },
  ];

  for (const l of pricingLineData) {
    await prisma.medSpaPricingLine.create({
      data: {
        medSpaId: l.spa.id, medicationName: l.name, currentCost: l.cost,
        unit: l.unit, monthlyQty: l.qty, currentVendor: l.vendor,
        pricingSource: l.source, confirmedAt: daysAgo(Math.floor(Math.random() * 30)),
      },
    });
  }

  // Notes — activity history
  const noteData = [
    { spa: spa1, note: "Initial discovery call — Jessica confirmed they buy Semaglutide and Tirzepatide from a local compounder at $220-275/vial. Very open to better pricing.", type: "call", days: 15 },
    { spa: spa1, note: "Sent pricing comparison showing 25-30% savings across all GLP-1s. Jessica forwarded to her business partner.", type: "pricing", days: 10 },
    { spa: spa1, note: "Follow-up call — partner reviewed pricing, wants to see proposal with preferred pharmacies included.", type: "call", days: 5 },
    { spa: spa1, note: "Sent formal proposal with CompoundRx as preferred pharmacy for GLP-1s. Awaiting decision.", type: "email", days: 2 },
    { spa: spa2, note: "Referral from Vitality Wellness. Rachel is currently with a regional GPO but not happy with service.", type: "note", days: 20 },
    { spa: spa2, note: "Pricing discovery — they pay $230/vial for Semaglutide through their current GPO. We can beat that significantly.", type: "call", days: 12 },
    { spa: spa2, note: "Sent comprehensive pricing sheet. Rachel reviewing with her practice manager.", type: "pricing", days: 5 },
    { spa: spa3, note: "Mark reached out via website inquiry. Small clinic, buying direct from pharmacy at full retail.", type: "note", days: 8 },
    { spa: spa3, note: "Left voicemail to schedule pricing discovery call.", type: "follow_up", days: 4 },
  ];

  for (const n of noteData) {
    await prisma.medSpaNote.create({
      data: { medSpaId: n.spa.id, note: n.note, type: n.type, createdAt: daysAgo(n.days) },
    });
  }

  // Fulfilled orders — actual post-close business for Glow Aesthetics
  const fulfilledData = [
    { spa: spa1, date: 2, med: "Semaglutide", qty: 1, pharm: "CompoundRx Pharmacy", paid: 200.00, cost: 165.00 },
    { spa: spa1, date: 4, med: "Tirzepatide", qty: 1, pharm: "CompoundRx Pharmacy", paid: 255.00, cost: 195.00 },
    { spa: spa1, date: 5, med: "Semaglutide", qty: 1, pharm: "CompoundRx Pharmacy", paid: 200.00, cost: 165.00 },
    { spa: spa1, date: 8, med: "Glutathione", qty: 1, pharm: "CompoundRx Pharmacy", paid: 95.00, cost: 72.00 },
    { spa: spa1, date: 10, med: "Semaglutide", qty: 1, pharm: "CompoundRx Pharmacy", paid: 200.00, cost: 165.00 },
    { spa: spa1, date: 12, med: "Tretinoin Cream", qty: 1, pharm: "CompoundRx Pharmacy", paid: 48.00, cost: 35.00 },
    { spa: spa1, date: 15, med: "Tirzepatide", qty: 1, pharm: "CompoundRx Pharmacy", paid: 255.00, cost: 195.00 },
    { spa: spa1, date: 20, med: "Semaglutide", qty: 1, pharm: "CompoundRx Pharmacy", paid: 200.00, cost: 165.00 },
    { spa: spa1, date: 22, med: "NAD+ Nasal Spray", qty: 1, pharm: "PrecisionMed Compounding", paid: 120.00, cost: 95.00 },
  ];

  for (const f of fulfilledData) {
    await prisma.medSpaFulfilledOrder.create({
      data: {
        medSpaId: f.spa.id, orderDate: daysAgo(f.date),
        medicationName: f.med, quantity: f.qty, pharmacyName: f.pharm,
        medSpaPaid: f.paid, pharmacyCost: f.cost,
      },
    });
  }

  console.log("Seed data created successfully");
  console.log("  3 brands, 3 pharmacies, 8 medications (med spa focused)");
  console.log("  8 programs, 8 fill records");
  console.log("  24 medication price entries");
  console.log("  3 med spas, 22 orders, 14 pricing lines, 9 notes, 9 fulfilled orders");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
