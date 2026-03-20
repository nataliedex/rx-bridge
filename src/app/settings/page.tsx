import { getRoutingPolicyAction } from "@/lib/actions";
import { RoutingPolicyEditor } from "@/components/routing-policy-editor";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { policy, defaults } = await getRoutingPolicyAction();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Internal configuration for Rx-Bridge routing and operations</p>
      </div>

      <RoutingPolicyEditor policy={policy} defaults={defaults} />
    </div>
  );
}
