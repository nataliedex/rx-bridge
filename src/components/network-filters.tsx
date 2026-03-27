"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { NetworkSearchInput } from "./network-search-input";

interface Props {
  currentSearch: string;
  currentPharmacy: string;
  pharmacies: { id: string; name: string }[];
}

export function NetworkFilters({ currentSearch, currentPharmacy, pharmacies }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function navigate(s: string, p: string) {
    const params = new URLSearchParams();
    if (s.trim()) params.set("search", s.trim());
    if (p) params.set("pharmacy", p);
    const qs = params.toString();
    router.push(`/medications${qs ? `?${qs}` : ""}`);
  }

  // Debounced navigation on search change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate(search, currentPharmacy);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePharmacyChange(pharmacyId: string) {
    navigate(search, pharmacyId);
  }

  function handleClear() {
    setSearch("");
    router.push("/medications");
  }

  const hasFilters = search || currentPharmacy;

  return (
    <div className="flex items-center gap-3 mb-4">
      <NetworkSearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search medication..."
      />
      <select
        value={currentPharmacy}
        onChange={(e) => handlePharmacyChange(e.target.value)}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
      >
        <option value="">All pharmacies</option>
        {pharmacies.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      {hasFilters && (
        <button onClick={handleClear} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
      )}
    </div>
  );
}
