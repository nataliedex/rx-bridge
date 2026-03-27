import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Simulates a pharmacy marking an order as completed (filled).
// Uses direct DB update since the existing updateOrderStatus server action
// is a "use server" function and can't be called from an API route.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "orderId is required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Order not found" }, { status: 404 });
    }

    if (order.status === "completed") {
      return NextResponse.json({ orderId: order.id, status: "completed", idempotent: true });
    }

    if (order.status !== "sent_to_pharmacy") {
      return NextResponse.json(
        { error: "INVALID_STATUS", message: `Cannot complete order in status '${order.status}'` },
        { status: 422 },
      );
    }

    await Promise.all([
      prisma.order.update({ where: { id: orderId }, data: { status: "completed", completedAt: new Date() } }),
      prisma.orderStatusHistory.create({
        data: { orderId, status: "completed", note: "Completed via Pharmacy Simulator" },
      }),
    ]);

    return NextResponse.json({ orderId, status: "completed" });

  } catch (err) {
    console.error("Pharmacy simulator complete order error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
