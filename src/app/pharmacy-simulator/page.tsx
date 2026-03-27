import { prisma } from "@/lib/db";
import { PharmacySimulatorList } from "@/components/pharmacy-simulator-list";
import { PharmacySimulatorOrders } from "@/components/pharmacy-simulator-orders";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

export default async function PharmacySimulatorPage() {
  const [refills, orders] = await Promise.all([
    prisma.refillRequest.findMany({
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        pharmacy: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        order: { select: { id: true, medicationName: true, strength: true, quantity: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.order.findMany({
      where: { status: { in: ["sent_to_pharmacy", "completed"] } },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        pharmacy: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        transmissions: { select: { sentAt: true, method: true }, orderBy: { sentAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  const serializedRefills = refills.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    status: r.status,
    medicationName: r.medicationName,
    quantity: r.quantity,
    notes: r.notes,
    patient: r.patient,
    pharmacy: r.pharmacy,
    brand: r.brand,
    order: r.order,
    pharmacyOrderId: r.pharmacyOrderId,
    quantityDispensed: r.quantityDispensed,
    pharmacyCostCents: r.pharmacyCostCents,
    sellPriceCents: r.sellPriceCents,
    sentToPharmacyAt: r.sentToPharmacyAt?.toISOString() ?? null,
    filledAt: r.filledAt?.toISOString() ?? null,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  const serializedOrders = orders.map((o) => ({
    id: o.id,
    status: o.status,
    medicationName: o.medicationName,
    strength: o.strength,
    quantity: o.quantity,
    refills: o.refills,
    patient: `${o.patient.lastName}, ${o.patient.firstName}`,
    pharmacy: o.pharmacy,
    brand: o.brand,
    lastTransmission: o.transmissions[0] ? {
      sentAt: o.transmissions[0].sentAt.toISOString(),
      method: o.transmissions[0].method,
    } : null,
    createdAt: o.createdAt.toISOString(),
  }));

  const actionableRefills = serializedRefills.filter((r) => ["sent_to_pharmacy", "pharmacy_acknowledged"].includes(r.status));
  const otherRefills = serializedRefills.filter((r) => !["sent_to_pharmacy", "pharmacy_acknowledged"].includes(r.status));

  const pendingOrders = serializedOrders.filter((o) => o.status === "sent_to_pharmacy");
  const completedOrders = serializedOrders.filter((o) => o.status === "completed");

  const hasAnything = serializedRefills.length > 0 || serializedOrders.length > 0;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Pharmacy Simulator</h1>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-100 text-purple-700">Internal Testing</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Simulate pharmacy-side actions on orders and refills. Uses the real API under the hood.
        </p>
      </div>

      <AutoRefresh intervalMs={10000}>
      {!hasAnything ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-400">No orders or refill requests to process.</p>
          <p className="text-xs text-gray-400 mt-1">Send an order from the Queue page or request a refill to see it here.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Orders sent to pharmacy */}
          {pendingOrders.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-700 mb-3">Orders Awaiting Pharmacy ({pendingOrders.length})</h2>
              <PharmacySimulatorOrders orders={pendingOrders} />
            </div>
          )}

          {/* Refills awaiting action */}
          {actionableRefills.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-700 mb-3">Refills Awaiting Pharmacy ({actionableRefills.length})</h2>
              <PharmacySimulatorList refills={actionableRefills} />
            </div>
          )}

          {/* Completed orders */}
          {completedOrders.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-400 mb-3">Completed Orders ({completedOrders.length})</h2>
              <PharmacySimulatorOrders orders={completedOrders} />
            </div>
          )}

          {/* Other refills */}
          {otherRefills.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-400 mb-3">All Refills ({otherRefills.length})</h2>
              <PharmacySimulatorList refills={otherRefills} />
            </div>
          )}
        </div>
      )}
      </AutoRefresh>
    </div>
  );
}
