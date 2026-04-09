"use client";

import { useState } from "react";
import Link from "next/link";

interface BrandRow {
  id: string;
  name: string;
  active: boolean;
  notes: string | null;
  programCount: number;
}

interface Props {
  brands: BrandRow[];
}

export function BrandList({ brands }: Props) {
  const [showInactive, setShowInactive] = useState(false);

  const active = brands.filter((b) => b.active);
  const inactive = brands.filter((b) => !b.active);
  const displayed = showInactive ? brands : active;

  return (
    <>
      <div className="shrink-0 flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">
          {active.length} active brand{active.length !== 1 ? "s" : ""}
          {inactive.length > 0 && ` · ${inactive.length} inactive`}
        </p>
        {inactive.length > 0 && (
          <button onClick={() => setShowInactive(!showInactive)}
            className="text-xs text-gray-500 hover:text-gray-700">
            {showInactive ? "Hide inactive" : "Show inactive"}
          </button>
        )}
      </div>

      {displayed.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-400 text-sm">No brands yet.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="shrink-0 flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <div className="px-4 py-2.5 flex-[2]">Brand</div>
            <div className="px-4 py-2.5 flex-[2]">Notes</div>
            <div className="px-4 py-2.5 flex-[0.7] text-center">Programs</div>
            <div className="px-4 py-2.5 flex-[0.7] text-center">Status</div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {displayed.map((b, idx) => (
              <Link
                key={b.id}
                href={`/partnerships/brands/${b.id}`}
                className={`flex items-center border-b border-gray-100 cursor-pointer transition-colors duration-100 hover:bg-indigo-50/50 ${!b.active ? "opacity-60" : ""} ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
              >
                <div className="px-4 py-2.5 flex-[2] text-[13px] font-medium text-gray-900 truncate">{b.name}</div>
                <div className="px-4 py-2.5 flex-[2] text-[12px] text-gray-500 truncate">{b.notes || <span className="text-gray-300">—</span>}</div>
                <div className="px-4 py-2.5 flex-[0.7] text-center text-[13px]">
                  {b.programCount > 0 ? (
                    <span className="text-indigo-600 font-medium tabular-nums">{b.programCount}</span>
                  ) : (
                    <span className="text-gray-300">0</span>
                  )}
                </div>
                <div className="px-4 py-2.5 flex-[0.7] text-center">
                  {b.active ? (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-green-100 text-green-700">Active</span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-500">Inactive</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
