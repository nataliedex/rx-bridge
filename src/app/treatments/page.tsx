import { getProgramPricingOverview, getPricingStrategy } from "@/lib/actions";
import { ProgramPricingTable } from "@/components/program-pricing-table";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ search?: string; status?: string }>;
}

export default async function PricingPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.search || "";
  const status = params.status || "all";

  const [rows, strategy] = await Promise.all([
    getProgramPricingOverview({
      search: search || undefined,
      status: status || undefined,
    }),
    getPricingStrategy(),
  ]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 4rem)" }}>
      <div className="shrink-0">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">Pricing</h1>
          <p className="text-sm text-gray-500 mt-1">Program pricing and margin management</p>
        </div>
      </div>

      <ProgramPricingTable
        rows={rows}
        currentSearch={search}
        currentStatus={status}
        defaultContractTermMonths={strategy.defaultContractTermMonths}
        guardrails={{
          pricingMode: strategy.mode,
          enableMarkupGuidance: strategy.enableMarkupGuidance,
          defaultMarkupPct: strategy.defaultMarkupPct,
          preventNegativeMargin: strategy.preventNegativeMargin,
          highlightLowMargin: strategy.highlightLowMargin,
          minimumTargetFeePerScript: strategy.minimumTargetFeePerScript,
        }}
      />
    </div>
  );
}
