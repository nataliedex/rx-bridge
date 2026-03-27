import { NextRequest, NextResponse } from "next/server";
import { getRefillHistory } from "@/lib/refills/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ prescriptionId: string }> },
) {
  try {
    const { prescriptionId } = await params;
    const result = await getRefillHistory(prescriptionId);

    if (!result) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Prescription not found" }, { status: 404 });
    }

    return NextResponse.json(result);

  } catch (err) {
    console.error("Get refill history error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
