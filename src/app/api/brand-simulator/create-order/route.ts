import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Simplified order creation for brand simulator.
// Skips the full intake pipeline — creates a completed order directly.
// Uses an existing prescriber from the DB (or creates a default one).

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { patientId, medicationName, strength, dosageForm, quantity, refills, pharmacyId, brandId } = body;

    if (!patientId || !medicationName || !pharmacyId) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "patientId, medicationName, and pharmacyId are required" }, { status: 400 });
    }

    // Get or create a default prescriber for the simulator
    const prescriber = await prisma.prescriber.upsert({
      where: { npi: "9999999999" },
      update: {},
      create: {
        name: "Simulator Prescriber",
        npi: "9999999999",
        clinicName: "Brand Simulator Clinic",
      },
    });

    const order = await prisma.order.create({
      data: {
        patientId,
        prescriberId: prescriber.id,
        pharmacyId,
        brandId: brandId || undefined,
        medicationName,
        strength: strength || undefined,
        dosageForm: dosageForm || undefined,
        quantity: quantity ? parseInt(quantity) : 30,
        refills: refills ? parseInt(refills) : 0,
        directions: "As directed by prescriber",
        orderSource: "api",
        status: "completed",
        completedAt: new Date(),
        sendReadiness: "ready",
      },
    });

    await prisma.orderStatusHistory.create({
      data: { orderId: order.id, status: "completed", note: "Created via Brand Simulator" },
    });

    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      medicationName: order.medicationName,
      refills: order.refills,
    }, { status: 201 });

  } catch (err) {
    console.error("Brand simulator create order error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
