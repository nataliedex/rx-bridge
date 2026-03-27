import { NextRequest, NextResponse } from "next/server";
import { pharmacyFillStatusSchema } from "@/lib/refills/validators";
import { processPharmacyFillStatus } from "@/lib/refills/service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = pharmacyFillStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await processPharmacyFillStatus(parsed.data);

    if (!result.success) {
      return NextResponse.json(
        { error: "PROCESSING_ERROR", message: result.error },
        { status: 422 },
      );
    }

    return NextResponse.json({
      refillRequestId: result.refillRequest!.id,
      status: result.refillRequest!.status,
      updatedAt: result.refillRequest!.filledAt ?? result.refillRequest!.cancelledAt ?? new Date(),
    });

  } catch (err) {
    console.error("Pharmacy fill status webhook error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
