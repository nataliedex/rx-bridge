import { getPricingAudit, getNetworkPharmacies } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { NetworkTabs } from "@/components/network-tabs";
import { PricingAuditTable } from "@/components/pricing-audit-table";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ filter?: string; search?: string; pharmacy?: string; medication?: string }>;
}

export default async function PricingAuditPage({ searchParams }: Props) {
  const params = await searchParams;
  const filter = (params.filter as "all" | "stale" | "missing") || "all";
  const search = params.search || "";
  const pharmacyId = params.pharmacy || "";
  const medicationId = params.medication || "";

  const [rows, pharmacies, medications] = await Promise.all([
    getPricingAudit({ filter, search: search || undefined, pharmacyId: pharmacyId || undefined, medicationId: medicationId || undefined }),
    getNetworkPharmacies(),
    prisma.medication.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 4rem)" }}>
      <div className="shrink-0">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">Network</h1>
          <p className="text-sm text-gray-500 mt-1">Pricing audit and verification</p>
        </div>

        <NetworkTabs />
      </div>

      <PricingAuditTable
        rows={rows}
        currentFilter={filter}
        currentSearch={search}
        currentPharmacy={pharmacyId}
        currentMedication={medicationId}
        pharmacies={pharmacies}
        medications={medications}
      />
    </div>
  );
}
