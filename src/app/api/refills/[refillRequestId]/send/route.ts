import { NextRequest, NextResponse } from "next/server";
import { sendRefillToPharmacy } from "@/lib/refills/service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ refillRequestId: string }> },
) {
  try {
    const { refillRequestId } = await params;
    const result = await sendRefillToPharmacy(refillRequestId);

    if (!result.success) {
      return NextResponse.json(
        { error: "SEND_FAILED", message: result.error },
        { status: 422 },
      );
    }

    return NextResponse.json({
      refillRequestId: result.refillRequest!.id,
      status: result.refillRequest!.status,
      sentToPharmacyAt: result.refillRequest!.sentToPharmacyAt,
      idempotent: result.idempotent ?? false,
      pharmacyPayload: result.pharmacyPayload ?? null,
    });

  } catch (err) {
    console.error("Send refill to pharmacy error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
