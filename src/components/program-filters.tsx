"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { NetworkSearchInput } from "./network-search-input";

interface Props {
  currentSearch: string;
  currentBrand: string;
  currentPharmacy: string;
  currentStatus: string;
  brands: { id: string; name: string }[];
  pharmacies: { id: string; name: string }[];
}

function buildUrl(params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "all") sp.set(k, v);
  }
  const qs = sp.toString();
  return `/programs${qs ? `?${qs}` : ""}`;
}

export function ProgramFilters({ currentSearch, currentBrand, currentPharmacy, currentStatus, brands, pharmacies }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (search !== currentSearch) {
        router.push(buildUrl({ search, brand: currentBrand, pharmacy: currentPharmacy, status: currentStatus }));
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  function navigate(overrides: Record<string, string>) {
    router.push(buildUrl({ search, brand: currentBrand, pharmacy: currentPharmacy, status: currentStatus, ...overrides }));
  }

  const hasFilters = search || currentBrand || currentPharmacy || currentStatus !== "all";

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <NetworkSearchInput value={search} onChange={setSearch} placeholder="Search programs..." />
      <select value={currentBrand} onChange={(e) => navigate({ brand: e.target.value })}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
        <option value="">All brands</option>
        {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <select value={currentPharmacy} onChange={(e) => navigate({ pharmacy: e.target.value })}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
        <option value="">All pharmacies</option>
        {pharmacies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select value={currentStatus} onChange={(e) => navigate({ status: e.target.value })}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="expired">Expired</option>
      </select>
      {hasFilters && (
        <button onClick={() => { setSearch(""); router.push("/programs"); }}
          className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
      )}
    </div>
  );
}
