import { getPricingStrategy } from "@/lib/actions";
import { PricingStrategyEditor } from "@/components/pricing-strategy-editor";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const strategy = await getPricingStrategy();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Platform configuration</p>
      </div>

      <PricingStrategyEditor initial={strategy} />
    </div>
  );
}
