import { getProviderPricingTable, getProviders } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { NetworkTabs } from "@/components/network-tabs";
import { ProviderPricingTable } from "@/components/provider-pricing-table";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ provider?: string }>;
}

export default async function ProviderPricingPage({ searchParams }: Props) {
  const params = await searchParams;
  const providerFilter = params.provider || "";

  const [prices, providers, medications] = await Promise.all([
    getProviderPricingTable(providerFilter || undefined),
    getProviders(),
    prisma.medication.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 4rem)" }}>
      <div className="shrink-0">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">Network</h1>
          <p className="text-sm text-gray-500 mt-1">Provider pricing — what providers pay for medications</p>
        </div>
        <NetworkTabs />
      </div>

      <ProviderPricingTable
        prices={prices}
        providers={providers.map((p) => ({ id: p.id, name: p.name }))}
        medications={medications}
        currentProvider={providerFilter}
      />
    </div>
  );
}
