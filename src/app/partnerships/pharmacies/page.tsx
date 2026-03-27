import { getAllPharmaciesForAdmin } from "@/lib/actions";
import { PartnershipsTabs } from "@/components/partnerships-tabs";
import { PharmacyList } from "@/components/pharmacy-list";
import { PharmacyActions } from "@/components/network-actions";

export const dynamic = "force-dynamic";

export default async function PharmaciesPage() {
  const pharmacies = await getAllPharmaciesForAdmin();

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 4rem)" }}>
      <div className="shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Partnerships</h1>
            <p className="text-sm text-gray-500 mt-1">Pharmacy management</p>
          </div>
          <PharmacyActions />
        </div>

        <PartnershipsTabs />
      </div>

      <PharmacyList pharmacies={pharmacies} />
    </div>
  );
}
