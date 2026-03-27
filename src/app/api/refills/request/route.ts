import { NextRequest, NextResponse } from "next/server";
import { refillRequestSchema } from "@/lib/refills/validators";
import { createRefillRequest, buildPharmacyPayload } from "@/lib/refills/service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = refillRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await createRefillRequest(parsed.data);

    // Idempotency: return existing record
    if (result.duplicate) {
      return NextResponse.json({
        refillRequestId: result.refillRequest.id,
        status: result.refillRequest.status,
        prescriptionId: result.refillRequest.orderId,
        patientId: result.refillRequest.patientId,
        medicationName: result.refillRequest.medicationName,
        duplicate: true,
        createdAt: result.refillRequest.createdAt,
      }, { status: 200 });
    }

    // Rejected
    if (result.rejected) {
      return NextResponse.json({
        refillRequestId: result.refillRequest.id,
        status: "rejected",
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        prescriptionId: result.refillRequest.orderId,
        createdAt: result.refillRequest.createdAt,
      }, { status: 422 });
    }

    // Validated — build pharmacy payload for downstream
    let pharmacyPayload = null;
    try {
      pharmacyPayload = await buildPharmacyPayload(result.refillRequest.id);
    } catch {
      // Non-fatal: payload build failure doesn't block the response
    }

    return NextResponse.json({
      refillRequestId: result.refillRequest.id,
      status: result.refillRequest.status,
      prescriptionId: result.refillRequest.orderId,
      patientId: result.refillRequest.patientId,
      pharmacyId: result.refillRequest.pharmacyId,
      medicationName: result.refillRequest.medicationName,
      quantity: result.refillRequest.quantity,
      validatedAt: result.refillRequest.validatedAt,
      createdAt: result.refillRequest.createdAt,
      pharmacyPayload,
    }, { status: 201 });

  } catch (err) {
    console.error("Refill request error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
