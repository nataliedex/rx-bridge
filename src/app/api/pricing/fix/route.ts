import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Fix missing pricing data for a medication + pharmacy combination.
// Updates the master pricing tables, not individual transactions.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { medicationId, pharmacyId, pharmacyCost, sellPrice } = body;

    if (!medicationId) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "medicationId is required" }, { status: 400 });
    }

    const results: string[] = [];

    // Update pharmacy cost if provided
    if (pharmacyCost != null && pharmacyId) {
      const cost = parseFloat(pharmacyCost);
      if (isNaN(cost) || cost <= 0) {
        return NextResponse.json({ error: "VALIDATION_ERROR", message: "pharmacyCost must be a positive number" }, { status: 400 });
      }

      // Close existing active entry
      await prisma.medicationPriceEntry.updateMany({
        where: { medicationId, pharmacyId, endDate: null },
        data: { endDate: new Date() },
      });

      // Create new active entry
      await prisma.medicationPriceEntry.create({
        data: {
          medicationId,
          pharmacyId,
          price: cost,
          effectiveDate: new Date(),
          notes: "Added via Revenue data quality fix",
          verifiedAt: new Date(),
          verificationSource: "manual_update",
        },
      });

      results.push("Pharmacy cost updated");
    }

    // Update sell price if provided
    if (sellPrice != null) {
      const sell = parseFloat(sellPrice);
      if (isNaN(sell) || sell <= 0) {
        return NextResponse.json({ error: "VALIDATION_ERROR", message: "sellPrice must be a positive number" }, { status: 400 });
      }

      await prisma.medication.update({
        where: { id: medicationId },
        data: { sellPrice: sell },
      });

      results.push("Sell price updated");
    }

    if (results.length === 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "No pricing data provided" }, { status: 400 });
    }

    return NextResponse.json({ success: true, updates: results });

  } catch (err) {
    console.error("Pricing fix error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
