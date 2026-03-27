import { prisma } from "@/lib/db";
import { BrandSimulatorOrders } from "@/components/brand-simulator-orders";
import { BrandSimulatorCreateOrder } from "@/components/brand-simulator-create-order";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

export default async function BrandSimulatorPage() {
  const [patients, pharmacies, brands, medications, orders] = await Promise.all([
    prisma.patient.findMany({ select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }),
    prisma.pharmacy.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.brand.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.medication.findMany({ select: { id: true, name: true, strength: true, form: true }, orderBy: { name: "asc" } }),
    prisma.order.findMany({
      where: { status: { in: ["completed", "sent_to_pharmacy"] } },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        pharmacy: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        refillRequests: {
          select: { id: true, status: true, createdAt: true, filledAt: true, sentToPharmacyAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const serializedOrders = orders.map((o) => {
    const filledCount = o.refillRequests.filter((r) => r.status === "filled").length;
    const inFlightStatuses = ["pending_validation", "validated", "queued_for_pharmacy", "sent_to_pharmacy", "pharmacy_acknowledged"];
    const inFlightCount = o.refillRequests.filter((r) => inFlightStatuses.includes(r.status)).length;
    return {
      id: o.id,
      medicationName: o.medicationName,
      strength: o.strength,
      quantity: o.quantity,
      refills: o.refills,
      status: o.status,
      patient: `${o.patient.lastName}, ${o.patient.firstName}`,
      patientId: o.patientId,
      pharmacy: o.pharmacy.name,
      pharmacyId: o.pharmacy.id,
      brand: o.brand?.name ?? null,
      brandId: o.brandId,
      filledCount,
      inFlightCount,
      remaining: Math.max(0, o.refills - filledCount - inFlightCount),
      refillRequests: o.refillRequests.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        filledAt: r.filledAt?.toISOString() ?? null,
        sentToPharmacyAt: r.sentToPharmacyAt?.toISOString() ?? null,
      })),
      createdAt: o.createdAt.toISOString(),
    };
  });

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Brand Simulator</h1>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">Internal Testing</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Simulate the brand side: create prescriptions and request refills. Uses the real Rx-Bridge API.
        </p>
      </div>

      <AutoRefresh intervalMs={12000}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create order form */}
          <div className="lg:col-span-1">
            <BrandSimulatorCreateOrder
              patients={patients}
              pharmacies={pharmacies}
              brands={brands}
              medications={medications}
            />
          </div>

          {/* Orders list with refill actions */}
          <div className="lg:col-span-2">
            <BrandSimulatorOrders orders={serializedOrders} />
          </div>
        </div>
      </AutoRefresh>
    </div>
  );
}
