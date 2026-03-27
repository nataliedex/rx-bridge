import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getRefillHistory } from "@/lib/refills/service";
import { RefillTimeline } from "@/components/refill-timeline";
import { AutoRefresh } from "@/components/auto-refresh";
import { formatCurrency } from "@/lib/pricing";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderRefillsPage({ params }: Props) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { patient: true, pharmacy: true, brand: true },
  });
  if (!order) notFound();

  const history = await getRefillHistory(id);

  // Get full refill records with relations for the detail view
  const refillRecords = await prisma.refillRequest.findMany({
    where: { orderId: id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      pharmacy: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Serialize dates for client component
  const refills = refillRecords.map((r) => ({
    id: r.id,
    status: r.status,
    source: r.source,
    medicationName: r.medicationName,
    quantity: r.quantity,
    notes: r.notes,
    patient: r.patient,
    pharmacy: r.pharmacy,
    brand: r.brand,
    requestedBy: {
      userId: r.requestedByUserId,
      name: r.requestedByName,
      email: r.requestedByEmail,
    },
    rejection: r.rejectionCode ? { code: r.rejectionCode, reason: r.rejectionReason } : null,
    pharmacyFill: r.filledAt ? {
      pharmacyOrderId: r.pharmacyOrderId,
      quantityDispensed: r.quantityDispensed,
      pharmacyCostCents: r.pharmacyCostCents,
      sellPriceCents: r.sellPriceCents,
    } : null,
    createdAt: r.createdAt.toISOString(),
    validatedAt: r.validatedAt?.toISOString() ?? null,
    sentToPharmacyAt: r.sentToPharmacyAt?.toISOString() ?? null,
    filledAt: r.filledAt?.toISOString() ?? null,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <div className="mb-6">
        <Link href={`/orders/${id}`} className="text-sm text-indigo-600 hover:underline">&larr; Back to Order</Link>
        <h1 className="text-2xl font-semibold mt-2">Refill History</h1>
        <p className="text-sm text-gray-500 mt-1">
          {order.medicationName} {order.strength && `· ${order.strength}`} — {order.patient.lastName}, {order.patient.firstName}
        </p>
      </div>

      <AutoRefresh intervalMs={10000}>
      {/* Refill accounting summary */}
      {history && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Authorized</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{history.refillsAuthorized}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Filled</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{history.refillsFilled}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">In Flight</p>
            <p className={`text-2xl font-bold mt-1 ${history.refillsInFlight > 0 ? "text-indigo-600" : "text-gray-300"}`}>
              {history.refillsInFlight}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Remaining</p>
            <p className={`text-2xl font-bold mt-1 ${history.refillsRemaining === 0 ? "text-red-600" : "text-gray-900"}`}>
              {history.refillsRemaining}
            </p>
            {history.refillsRemaining === 0 && history.refillsAuthorized > 0 && (
              <p className="text-[10px] text-red-500 mt-0.5">No refills remaining</p>
            )}
          </div>
        </div>
      )}

      {/* No refills authorized */}
      {order.refills === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-700">This prescription has 0 refills authorized.</p>
        </div>
      )}

      {/* Prescription context */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-500">Prescription</p>
            <Link href={`/orders/${id}`} className="text-indigo-600 hover:underline font-mono text-xs">{id.slice(0, 12)}</Link>
          </div>
          <div>
            <p className="text-xs text-gray-500">Pharmacy</p>
            <p className="text-gray-900">{order.pharmacy.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Brand</p>
            <p className="text-gray-900">{order.brand?.name ?? <span className="text-gray-300">—</span>}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Order Status</p>
            <p className="text-gray-900">{order.status}</p>
          </div>
        </div>
      </div>

      {/* Refill list */}
      {refills.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-400">No refill requests for this prescription.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {refills.map((refill) => (
            <RefillTimeline key={refill.id} refill={refill} />
          ))}
        </div>
      )}
      </AutoRefresh>
    </div>
  );
}
