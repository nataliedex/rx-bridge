import { getReadyQueue } from "@/lib/actions";
import { timeAgo, getUrgencyTier } from "@/lib/format";
import { PharmacyQueueGroup } from "@/components/pharmacy-queue-group";

export const dynamic = "force-dynamic";

interface QueueOrder {
  id: string;
  brandId: string | null;
  status: string;
  priority: string;
  medicationName: string;
  createdAt: Date;
  brand: { name: string } | null;
  patient: { firstName: string; lastName: string };
  prescriber: { name: string };
  pharmacy: { id: string; name: string };
}

export default async function QueuePage() {
  const orders = await getReadyQueue() as QueueOrder[];

  const grouped = new Map<string, { pharmacyId: string; pharmacyName: string; orders: QueueOrder[] }>();
  for (const order of orders) {
    const key = order.pharmacy.id;
    if (!grouped.has(key)) {
      grouped.set(key, { pharmacyId: key, pharmacyName: order.pharmacy.name, orders: [] });
    }
    grouped.get(key)!.orders.push(order);
  }

  const groups = Array.from(grouped.values());
  const urgentCount = orders.filter((o) => o.priority === "urgent" || o.priority === "high").length;
  const staleCount = orders.filter((o) => getUrgencyTier(o.createdAt) === "stale").length;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Send Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            {orders.length} order{orders.length !== 1 ? "s" : ""} ready to send across {groups.length} pharmac{groups.length !== 1 ? "ies" : "y"}
            {urgentCount > 0 && <span className="text-red-600 font-medium ml-2">{urgentCount} high priority</span>}
            {staleCount > 0 && <span className="text-orange-600 font-medium ml-2">{staleCount} waiting 24h+</span>}
          </p>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500">No orders in the queue.</p>
          <p className="text-sm text-gray-400 mt-1">Orders appear here after being approved and added to the queue from the order detail page.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => {
            const hasUrgent = group.orders.some((o) => o.priority === "urgent" || o.priority === "high");
            const hasStale = group.orders.some((o) => getUrgencyTier(o.createdAt) === "stale");

            return (
              <PharmacyQueueGroup
                key={group.pharmacyId}
                pharmacyId={group.pharmacyId}
                pharmacyName={group.pharmacyName}
                hasUrgent={hasUrgent}
                hasStale={hasStale}
                orders={JSON.parse(JSON.stringify(group.orders.map((o) => {
                  return {
                    id: o.id,
                    patient: `${o.patient.firstName} ${o.patient.lastName}`,
                    medication: o.medicationName,
                    brand: o.brand?.name || null,
                    priority: o.priority,
                    age: timeAgo(o.createdAt),
                    urgency: getUrgencyTier(o.createdAt),
                    createdAt: o.createdAt.toISOString(),
                  };
                })))}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
