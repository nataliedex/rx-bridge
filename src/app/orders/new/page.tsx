import { getPharmacies, getBrands } from "@/lib/actions";
import { OrderForm } from "@/components/order-form";

export default async function NewOrderPage() {
  const [pharmacies, brands] = await Promise.all([
    getPharmacies(),
    getBrands(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Manual Order</h1>
        <p className="text-sm text-gray-500 mt-1">Manual Order Entry — use this form when order data is not available via EHR or API</p>
      </div>
      <OrderForm pharmacies={pharmacies} brands={brands} />
    </div>
  );
}
