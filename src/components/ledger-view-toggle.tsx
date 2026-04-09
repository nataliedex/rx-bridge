"use client";

import { useRouter } from "next/navigation";

export function LedgerViewToggle({ currentView, period }: { currentView: string; period: string }) {
  const router = useRouter();

  function toggle(view: string) {
    const params = new URLSearchParams(window.location.search);
    if (view === "all") params.delete("view");
    else params.set("view", view);
    router.push(`/ledger?${params.toString()}`);
  }

  return (
    <div className="flex items-center bg-gray-100 rounded-md p-0.5">
      <button onClick={() => toggle("all")}
        className={`px-3 py-1 text-[11px] font-medium rounded transition-colors ${currentView !== "grouped" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
        All Transactions
      </button>
      <button onClick={() => toggle("grouped")}
        className={`px-3 py-1 text-[11px] font-medium rounded transition-colors ${currentView === "grouped" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
        By Med Spa
      </button>
    </div>
  );
}
