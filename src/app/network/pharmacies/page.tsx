import { getAllPharmaciesForAdmin } from "@/lib/actions";
import { NetworkTabs } from "@/components/network-tabs";
import { PharmacyList } from "@/components/pharmacy-list";
import { NetworkActions } from "@/components/network-actions";

export const dynamic = "force-dynamic";

export default async function PharmaciesPage() {
  const pharmacies = await getAllPharmaciesForAdmin();

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 4rem)" }}>
      <div className="shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Network</h1>
            <p className="text-sm text-gray-500 mt-1">Pharmacy management</p>
          </div>
          <NetworkActions />
        </div>

        <NetworkTabs />
      </div>

      <PharmacyList pharmacies={pharmacies} />
    </div>
  );
}
