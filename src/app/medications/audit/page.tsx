import { getPricingAudit, getNetworkPharmacies } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { MedicationsTabs } from "@/components/medications-tabs";
import { PricingAuditTable } from "@/components/pricing-audit-table";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ filter?: string; search?: string; pharmacy?: string; medication?: string }>;
}

export default async function PricingAuditPage({ searchParams }: Props) {
  const params = await searchParams;
  const filterParam = params.filter || "all";
  // Server only handles all/stale/missing; negative_margin is handled client-side
  const serverFilter = (filterParam === "stale" || filterParam === "missing") ? filterParam : "all";
  const filter = filterParam;
  const search = params.search || "";
  const pharmacyId = params.pharmacy || "";
  const medicationId = params.medication || "";

  const [rows, pharmacies, medications] = await Promise.all([
    getPricingAudit({ filter: serverFilter, search: search || undefined, pharmacyId: pharmacyId || undefined, medicationId: medicationId || undefined }),
    getNetworkPharmacies(),
    prisma.medication.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 4rem)" }}>
      <div className="shrink-0">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">Medications</h1>
          <p className="text-sm text-gray-500 mt-1">Pricing audit and verification</p>
        </div>

        <MedicationsTabs />
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
