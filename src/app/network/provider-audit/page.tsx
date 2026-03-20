import { getProviderPricingAudit, getProviders } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { NetworkTabs } from "@/components/network-tabs";
import { ProviderAuditTable } from "@/components/provider-audit-table";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ filter?: string; search?: string; provider?: string; medication?: string }>;
}

export default async function ProviderAuditPage({ searchParams }: Props) {
  const params = await searchParams;
  const filter = (params.filter as "all" | "stale" | "missing") || "all";
  const search = params.search || "";
  const providerId = params.provider || "";
  const medicationId = params.medication || "";

  const [rows, providers, medications] = await Promise.all([
    getProviderPricingAudit({ filter, search: search || undefined, providerId: providerId || undefined, medicationId: medicationId || undefined }),
    getProviders(),
    prisma.medication.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 4rem)" }}>
      <div className="shrink-0">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">Network</h1>
          <p className="text-sm text-gray-500 mt-1">Provider pricing audit and verification</p>
        </div>
        <NetworkTabs />
      </div>

      <ProviderAuditTable
        rows={rows}
        currentFilter={filter}
        currentSearch={search}
        currentProvider={providerId}
        currentMedication={medicationId}
        providers={providers.map((p) => ({ id: p.id, name: p.name }))}
        medications={medications}
      />
    </div>
  );
}
