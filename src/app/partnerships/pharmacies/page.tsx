import { getAllPharmaciesForAdmin } from "@/lib/actions";
import { PharmacyList } from "@/components/pharmacy-list";
import { PharmacyActions } from "@/components/network-actions";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ new?: string }>;
}

export default async function PharmaciesPage({ searchParams }: Props) {
  const params = await searchParams;
  const pharmacies = await getAllPharmaciesForAdmin();

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 4rem)" }}>
      <div className="shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Pharmacies</h1>
            <p className="text-sm text-gray-500 mt-1">{pharmacies.length} partner{pharmacies.length !== 1 ? "s" : ""}</p>
          </div>
          <PharmacyActions autoOpen={params.new === "1"} />
        </div>

      </div>

      <PharmacyList pharmacies={pharmacies} />
    </div>
  );
}
