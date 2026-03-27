import { NextRequest, NextResponse } from "next/server";
import { cancelRefillRequest } from "@/lib/refills/service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ refillRequestId: string }> },
) {
  try {
    const { refillRequestId } = await params;
    const result = await cancelRefillRequest(refillRequestId);

    if (!result.success) {
      return NextResponse.json(
        { error: "CANCEL_FAILED", message: result.error },
        { status: 422 },
      );
    }

    return NextResponse.json({
      refillRequestId: result.refillRequest!.id,
      status: result.refillRequest!.status,
      cancelledAt: result.refillRequest!.cancelledAt,
      idempotent: result.idempotent ?? false,
    });

  } catch (err) {
    console.error("Cancel refill request error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
