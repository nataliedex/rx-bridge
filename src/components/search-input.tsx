"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { searchSuggestions } from "@/lib/actions";

interface Suggestion {
  type: string;
  value: string;
}

const TYPE_ICONS: Record<string, string> = {
  Patient: "👤",
  Medication: "💊",
  Brand: "🏷",
  Pharmacy: "🏥",
};

export function SearchInput({ currentSearch, baseParams }: { currentSearch: string; baseParams: Record<string, string> }) {
  const router = useRouter();
  const [value, setValue] = useState(currentSearch);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced typeahead
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchSuggestions(value);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
        setSelectedIdx(-1);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function navigate(searchValue: string) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(baseParams)) {
      if (v) params.set(k, v);
    }
    if (searchValue.trim()) params.set("search", searchValue.trim());
    else params.delete("search");
    const qs = params.toString();
    router.push(`/orders${qs ? `?${qs}` : ""}`);
    setShowDropdown(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate(value);
  }

  function handleSelect(suggestion: Suggestion) {
    setValue(suggestion.value);
    navigate(suggestion.value);
  }

  function handleClear() {
    setValue("");
    navigate("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && selectedIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIdx]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  // Highlight matching text in suggestions
  function highlightMatch(text: string) {
    const idx = text.toLowerCase().indexOf(value.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-semibold text-gray-900">{text.slice(idx, idx + value.length)}</span>
        {text.slice(idx + value.length)}
      </>
    );
  }

  // Group suggestions by type
  const grouped = new Map<string, Suggestion[]>();
  for (const s of suggestions) {
    if (!grouped.has(s.type)) grouped.set(s.type, []);
    grouped.get(s.type)!.push(s);
  }

  let flatIdx = -1;

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit} className="flex items-center">
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
            onKeyDown={handleKeyDown}
            placeholder="Search patient, medication..."
            className="border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-sm w-80 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          {value ? (
            <button type="button" onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
              &#10005;
            </button>
          ) : loading ? (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-xs">...</span>
          ) : null}
        </div>
      </form>

      {/* Typeahead dropdown */}
      {showDropdown && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 w-80 max-h-72 overflow-auto">
          {Array.from(grouped.entries()).map(([type, items]) => (
            <div key={type}>
              <p className="px-3 py-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wide bg-gray-50 sticky top-0">
                {TYPE_ICONS[type] || ""} {type}
              </p>
              {items.map((s) => {
                flatIdx++;
                const idx = flatIdx;
                return (
                  <button
                    key={`${s.type}-${s.value}`}
                    type="button"
                    onClick={() => handleSelect(s)}
                    className={`block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-indigo-50 ${idx === selectedIdx ? "bg-indigo-50" : ""}`}
                  >
                    {highlightMatch(s.value)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
