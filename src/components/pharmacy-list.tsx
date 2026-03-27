"use client";

import { useState } from "react";
import Link from "next/link";

interface PharmacyRow {
  id: string;
  name: string;
  contactName: string | null;
  serviceStates: string | null;
  archivedAt: string | null;
  activePriceCount: number;
  orderCount: number;
}

interface Props {
  pharmacies: PharmacyRow[];
}

function formatServiceStates(raw: string | null): string {
  if (!raw) return "—";
  try {
    const states: string[] = JSON.parse(raw);
    if (states.length === 0) return "—";
    if (states.length === 50) return "All states";
    if (states.length <= 3) return states.join(", ");
    return `${states.slice(0, 2).join(", ")} +${states.length - 2}`;
  } catch { return "—"; }
}

export function PharmacyList({ pharmacies }: Props) {
  const [showArchived, setShowArchived] = useState(false);

  const active = pharmacies.filter((p) => !p.archivedAt);
  const archived = pharmacies.filter((p) => p.archivedAt);
  const displayed = showArchived ? pharmacies : active;

  return (
    <>
      <div className="shrink-0 flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">
          {active.length} active pharmac{active.length !== 1 ? "ies" : "y"}
          {archived.length > 0 && ` · ${archived.length} archived`}
        </p>
        {archived.length > 0 && (
          <button onClick={() => setShowArchived(!showArchived)}
            className="text-xs text-gray-500 hover:text-gray-700">
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
        )}
      </div>

      {displayed.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-400 text-sm">No pharmacies in the network yet.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="shrink-0 flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <div className="px-4 py-2.5 flex-[2]">Pharmacy</div>
            <div className="px-4 py-2.5 flex-[1.2]">Service States</div>
            <div className="px-4 py-2.5 flex-[0.8] text-center">Active Prices</div>
            <div className="px-4 py-2.5 flex-[0.7] text-center">Orders</div>
            <div className="px-4 py-2.5 flex-[0.7] text-center">Status</div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {displayed.map((p, idx) => {
              const isArchived = !!p.archivedAt;
              return (
                <Link
                  key={p.id}
                  href={`/partnerships/pharmacies/${p.id}`}
                  className={`flex items-center border-b border-gray-100 cursor-pointer transition-colors duration-100 hover:bg-indigo-50/50 ${isArchived ? "opacity-60" : ""} ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                >
                  <div className="px-4 py-2.5 flex-[2] min-w-0">
                    <span className="text-[13px] font-medium text-gray-900 truncate block">{p.name}</span>
                    {p.contactName && <span className="text-[10px] text-gray-400 block truncate">{p.contactName}</span>}
                  </div>
                  <div className="px-4 py-2.5 flex-[1.2] text-[12px] text-gray-500 truncate">{formatServiceStates(p.serviceStates)}</div>
                  <div className="px-4 py-2.5 flex-[0.8] text-center text-[13px]">
                    {p.activePriceCount > 0 ? (
                      <span className="text-indigo-600 font-medium tabular-nums">{p.activePriceCount}</span>
                    ) : (
                      <span className="text-gray-300">0</span>
                    )}
                  </div>
                  <div className="px-4 py-2.5 flex-[0.7] text-center text-[13px]">
                    {p.orderCount > 0 ? (
                      <span className="text-indigo-600 font-medium tabular-nums">{p.orderCount}</span>
                    ) : (
                      <span className="text-gray-300">0</span>
                    )}
                  </div>
                  <div className="px-4 py-2.5 flex-[0.7] text-center">
                    {isArchived ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-500">Archived</span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-green-100 text-green-700">Active</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
