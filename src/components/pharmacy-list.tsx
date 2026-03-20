"use client";

import { useState } from "react";
import Link from "next/link";
import { EditPharmacyDrawer, type EditablePharmacy } from "./edit-pharmacy-drawer";

interface PharmacyRow {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  serviceStates: string | null;
  archivedAt: string | null;
  activePriceCount: number;
  orderCount: number;
}

interface Props {
  pharmacies: PharmacyRow[];
}

export function PharmacyList({ pharmacies }: Props) {
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<EditablePharmacy | null>(null);

  const active = pharmacies.filter((p) => !p.archivedAt);
  const archived = pharmacies.filter((p) => p.archivedAt);
  const displayed = showArchived ? pharmacies : active;

  return (
    <>
      {/* Fixed controls */}
      <div className="shrink-0 flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">
          {active.length} active pharmac{active.length !== 1 ? "ies" : "y"}
          {archived.length > 0 && ` · ${archived.length} archived`}
        </p>
        {archived.length > 0 && (
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
        )}
      </div>

      {/* Data grid */}
      {displayed.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-400 text-sm">No pharmacies in the network yet.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Column headers */}
          <div className="shrink-0 flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <div className="px-4 py-2.5 flex-[2]">Pharmacy</div>
            <div className="px-4 py-2.5 flex-[1.5]">Contact</div>
            <div className="px-4 py-2.5 flex-[0.7]">State</div>
            <div className="px-4 py-2.5 flex-[0.8] text-center">Active Prices</div>
            <div className="px-4 py-2.5 flex-[0.7] text-center">Orders</div>
            <div className="px-4 py-2.5 flex-[0.7] text-center">Status</div>
          </div>

          {/* Scrollable rows */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {displayed.map((p, idx) => {
              const isArchived = !!p.archivedAt;
              return (
                <div
                  key={p.id}
                  onClick={() => setEditing(p)}
                  className={`flex items-center border-b border-gray-100 cursor-pointer transition-colors duration-100 hover:bg-indigo-50/50 ${isArchived ? "opacity-60" : ""} ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                >
                  <div className="px-4 py-2.5 flex-[2] text-[13px] font-medium text-gray-900 truncate">{p.name}</div>
                  <div className="px-4 py-2.5 flex-[1.5] text-[13px] text-gray-500 truncate">{p.contactName || <span className="text-gray-300">—</span>}</div>
                  <div className="px-4 py-2.5 flex-[0.7] text-[13px] text-gray-500">{p.state || <span className="text-gray-300">—</span>}</div>
                  <div className="px-4 py-2.5 flex-[0.8] text-center text-[13px]" onClick={(e) => e.stopPropagation()}>
                    {p.activePriceCount > 0 ? (
                      <Link href={`/network/audit?pharmacy=${p.id}`}
                        className="text-indigo-600 hover:text-indigo-800 font-medium tabular-nums">
                        {p.activePriceCount}
                      </Link>
                    ) : (
                      <span className="text-gray-300">0</span>
                    )}
                  </div>
                  <div className="px-4 py-2.5 flex-[0.7] text-center text-[13px]" onClick={(e) => e.stopPropagation()}>
                    {p.orderCount > 0 ? (
                      <Link href={`/orders?pharmacy=${p.id}`}
                        className="text-indigo-600 hover:text-indigo-800 font-medium tabular-nums">
                        {p.orderCount}
                      </Link>
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editing && (
        <EditPharmacyDrawer
          open={true}
          onClose={() => setEditing(null)}
          pharmacy={editing}
        />
      )}
    </>
  );
}
