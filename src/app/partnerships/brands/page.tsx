import { getAllBrandsForAdmin } from "@/lib/actions";
import { PartnershipsTabs } from "@/components/partnerships-tabs";
import { BrandList } from "@/components/brand-list";
import { BrandActions } from "@/components/network-actions";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const brands = await getAllBrandsForAdmin();

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 4rem)" }}>
      <div className="shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Partnerships</h1>
            <p className="text-sm text-gray-500 mt-1">Brand management</p>
          </div>
          <BrandActions />
        </div>

        <PartnershipsTabs />
      </div>

      <BrandList brands={brands} />
    </div>
  );
}
