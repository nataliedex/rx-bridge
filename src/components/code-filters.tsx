"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { NetworkSearchInput } from "./network-search-input";

interface Props {
  currentSearch: string;
}

export function CodeFilters({ currentSearch }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (search !== currentSearch) {
        const sp = new URLSearchParams();
        if (search.trim()) sp.set("search", search.trim());
        const qs = sp.toString();
        router.push(`/codes${qs ? `?${qs}` : ""}`);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center gap-3 mb-4">
      <NetworkSearchInput value={search} onChange={setSearch} placeholder="Search codes, brands, medications..." />
      {search && (
        <button onClick={() => { setSearch(""); router.push("/codes"); }}
          className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
      )}
    </div>
  );
}
