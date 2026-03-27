import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { RefillQueueBulkSend, RefillQueueSendOne } from "@/components/refill-queue-actions";

export const dynamic = "force-dynamic";

export default async function RefillsQueuePage() {
  const refills = await prisma.refillRequest.findMany({
    where: { status: { in: ["validated", "queued_for_pharmacy"] } },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      pharmacy: { select: { name: true } },
      brand: { select: { name: true } },
      order: { select: { strength: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const serialized = refills.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    status: r.status,
    medicationName: r.medicationName,
    strength: r.order.strength,
    patient: `${r.patient.lastName}, ${r.patient.firstName}`,
    pharmacy: r.pharmacy.name,
    brand: r.brand?.name ?? null,
    age: timeAgo(r.createdAt),
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Refills Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            {refills.length} refill{refills.length !== 1 ? "s" : ""} ready to send to pharmacy
          </p>
        </div>
        <RefillQueueBulkSend refills={serialized} />
      </div>

      {refills.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500">No refills waiting to be sent.</p>
          <p className="text-sm text-gray-400 mt-1">Refills appear here after a brand requests a refill and it passes validation.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="text-xs text-gray-400 uppercase bg-gray-50">
                <th className="px-4 py-2.5 text-left">Patient</th>
                <th className="px-4 py-2.5 text-left">Medication</th>
                <th className="px-4 py-2.5 text-left">Pharmacy</th>
                <th className="px-4 py-2.5 text-left">Brand</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-right">Waiting</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {serialized.map((r, idx) => (
                <tr key={r.id} className={`hover:bg-indigo-50/30 transition-colors ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                  <td className="px-4 py-2.5 text-[13px] font-medium text-gray-900">{r.patient}</td>
                  <td className="px-4 py-2.5 text-[13px] text-gray-600">
                    {r.medicationName}{r.strength && <span className="text-gray-400 ml-1">{r.strength}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-gray-500">{r.pharmacy}</td>
                  <td className="px-4 py-2.5 text-[13px] text-gray-500">{r.brand || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                      {r.status === "validated" ? "Ready to Send" : "Queued"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-[11px] text-gray-400 tabular-nums">{r.age}</td>
                  <td className="px-4 py-2.5 text-right">
                    <RefillQueueSendOne refillId={r.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
