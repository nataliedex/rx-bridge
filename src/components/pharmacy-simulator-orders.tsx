"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface OrderRow {
  id: string;
  status: string;
  medicationName: string;
  strength: string | null;
  quantity: number | null;
  refills: number;
  patient: string;
  pharmacy: { id: string; name: string };
  brand: { id: string; name: string } | null;
  lastTransmission: { sentAt: string; method: string } | null;
  createdAt: string;
}

interface Props {
  orders: OrderRow[];
}

export function PharmacySimulatorOrders({ orders }: Props) {
  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} />
      ))}
    </div>
  );
}

function OrderCard({ order }: { order: OrderRow }) {
  const router = useRouter();
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");

  const isPending = order.status === "sent_to_pharmacy";
  const isCompleted = order.status === "completed";

  async function handleComplete() {
    setActing(true);
    setError("");
    try {
      const res = await fetch("/api/pharmacy-simulator/complete-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className={`bg-white border rounded-lg overflow-hidden ${
      isCompleted ? "border-gray-200 opacity-70" : "border-purple-200"
    }`}>
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
            isPending ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"
          }`}>
            {isPending ? "Sent to Pharmacy" : "Completed"}
          </span>
          <span className="text-[13px] font-medium text-gray-900 truncate">{order.medicationName}</span>
          {order.strength && <span className="text-[11px] text-gray-400">{order.strength}</span>}
          {order.quantity && <span className="text-[11px] text-gray-400">qty {order.quantity}</span>}
        </div>
        <Link href={`/orders/${order.id}`} className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium shrink-0">
          View in Rx-Bridge
        </Link>
      </div>

      <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div>
          <span className="text-gray-400">Patient</span>
          <p className="text-gray-700">{order.patient}</p>
        </div>
        <div>
          <span className="text-gray-400">Pharmacy</span>
          <p className="text-gray-700">{order.pharmacy.name}</p>
        </div>
        <div>
          <span className="text-gray-400">Brand</span>
          <p className="text-gray-700">{order.brand?.name ?? <span className="text-gray-300">—</span>}</p>
        </div>
        <div>
          <span className="text-gray-400">Refills</span>
          <p className="text-gray-700">{order.refills}</p>
        </div>
        {order.lastTransmission && (
          <div>
            <span className="text-gray-400">Last Sent</span>
            <p className="text-gray-700">{new Date(order.lastTransmission.sentAt).toLocaleString()}</p>
          </div>
        )}
        <div>
          <span className="text-gray-400">Order ID</span>
          <p className="text-gray-500 font-mono text-[10px]">{order.id.slice(0, 16)}</p>
        </div>
      </div>

      {error && <p className="px-4 pb-2 text-red-600 text-xs">{error}</p>}

      {isPending && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center gap-2">
          <button onClick={handleComplete} disabled={acting}
            className="bg-green-600 text-white rounded-md px-3 py-1.5 text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
            {acting ? "Processing..." : "Mark Completed"}
          </button>
          <span className="text-[10px] text-gray-400">Simulates pharmacy confirming the order was filled</span>
        </div>
      )}
    </div>
  );
}
