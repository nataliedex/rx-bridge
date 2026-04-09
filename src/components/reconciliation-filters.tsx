"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { NetworkSearchInput } from "./network-search-input";

interface Props {
  currentSearch: string;
  currentStatus: string;
}

function buildUrl(params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "all") sp.set(k, v);
  }
  const qs = sp.toString();
  return `/reconciliation${qs ? `?${qs}` : ""}`;
}

export function ReconciliationFilters({ currentSearch, currentStatus }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (search !== currentSearch) {
        router.push(buildUrl({ search, status: currentStatus }));
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilters = search || currentStatus !== "all";

  return (
    <div className="flex items-center gap-3 mb-4">
      <NetworkSearchInput value={search} onChange={setSearch} placeholder="Search codes, brands, medications..." />
      {hasFilters && (
        <button onClick={() => { setSearch(""); router.push("/reconciliation"); }}
          className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
      )}
    </div>
  );
}
