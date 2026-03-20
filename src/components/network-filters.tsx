"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

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
    router.push(`/network${qs ? `?${qs}` : ""}`);
  }

  // Debounced search — navigates 300ms after user stops typing
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
    router.push("/network");
  }

  const hasFilters = search || currentPharmacy;

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search medication..."
          className="border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-sm w-64 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
            &#10005;
          </button>
        )}
      </div>
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
