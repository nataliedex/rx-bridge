"use client";

import { useRouter } from "next/navigation";

interface Props {
  currentMedSpa: string;
  currentPharmacy: string;
  currentPeriod: string;
  medSpas: { id: string; name: string }[];
  pharmacies: string[];
}

function buildUrl(params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "all" && v !== "month") sp.set(k, v);
    if (k === "period" && v === "all") sp.set(k, v);
  }
  const qs = sp.toString();
  return `/ledger${qs ? `?${qs}` : ""}`;
}

export function LedgerFilters({ currentMedSpa, currentPharmacy, currentPeriod, medSpas, pharmacies }: Props) {
  const router = useRouter();

  function navigate(overrides: Record<string, string>) {
    router.push(buildUrl({ medSpa: currentMedSpa, pharmacy: currentPharmacy, period: currentPeriod, ...overrides }));
  }

  const hasFilters = currentMedSpa || currentPharmacy || currentPeriod === "all";

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="flex gap-1">
        <button onClick={() => navigate({ period: "month" })}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            currentPeriod === "month" ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}>This Month</button>
        <button onClick={() => navigate({ period: "all" })}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            currentPeriod === "all" ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}>All Time</button>
      </div>
      <select value={currentMedSpa} onChange={(e) => navigate({ medSpa: e.target.value })}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
        <option value="">All med spas</option>
        {medSpas.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select value={currentPharmacy} onChange={(e) => navigate({ pharmacy: e.target.value })}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
        <option value="">All pharmacies</option>
        {pharmacies.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      {hasFilters && (
        <button onClick={() => router.push("/ledger")} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
      )}
    </div>
  );
}
