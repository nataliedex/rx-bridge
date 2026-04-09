"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { NetworkSearchInput } from "./network-search-input";

interface Props {
  currentSearch: string;
  currentStatus: string;
  currentPeriod: string;
}

function buildUrl(params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    if (k === "status" && v === "all") continue;
    sp.set(k, v);
  }
  const qs = sp.toString();
  return `/reconciliation${qs ? `?${qs}` : ""}`;
}

export function PayoutFilters({ currentSearch, currentStatus, currentPeriod }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (search !== currentSearch) {
        router.push(buildUrl({ search, status: currentStatus, period: currentPeriod }));
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  function navigate(overrides: Record<string, string>) {
    router.push(buildUrl({ search, status: currentStatus, period: currentPeriod, ...overrides }));
  }

  const hasFilters = search || currentStatus !== "all" || currentPeriod !== "month";

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
      <NetworkSearchInput value={search} onChange={setSearch} placeholder="Search med spa, medication, pharmacy..." />
      {hasFilters && (
        <button onClick={() => { setSearch(""); router.push("/reconciliation"); }}
          className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
      )}
    </div>
  );
}
