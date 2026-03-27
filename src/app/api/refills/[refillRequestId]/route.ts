import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ refillRequestId: string }> },
) {
  try {
    const { refillRequestId } = await params;

    const rr = await prisma.refillRequest.findUnique({
      where: { id: refillRequestId },
      include: {
        order: { select: { id: true, medicationName: true, strength: true, dosageForm: true, refills: true, status: true } },
        patient: { select: { id: true, firstName: true, lastName: true } },
        pharmacy: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });

    if (!rr) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Refill request not found" }, { status: 404 });
    }

    return NextResponse.json({
      refillRequestId: rr.id,
      status: rr.status,
      source: rr.source,
      prescriptionId: rr.orderId,
      medicationName: rr.medicationName,
      quantity: rr.quantity,
      notes: rr.notes,

      patient: rr.patient,
      pharmacy: rr.pharmacy,
      brand: rr.brand,
      prescription: rr.order,

      requestedBy: {
        userId: rr.requestedByUserId,
        name: rr.requestedByName,
        email: rr.requestedByEmail,
      },

      rejection: rr.rejectionCode ? {
        code: rr.rejectionCode,
        reason: rr.rejectionReason,
      } : null,

      pharmacyFill: rr.filledAt ? {
        pharmacyOrderId: rr.pharmacyOrderId,
        quantityDispensed: rr.quantityDispensed,
        pharmacyCostCents: rr.pharmacyCostCents,
        sellPriceCents: rr.sellPriceCents,
        filledAt: rr.filledAt,
      } : null,

      createdAt: rr.createdAt,
      validatedAt: rr.validatedAt,
      sentToPharmacyAt: rr.sentToPharmacyAt,
      filledAt: rr.filledAt,
      cancelledAt: rr.cancelledAt,
    });

  } catch (err) {
    console.error("Get refill request error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
