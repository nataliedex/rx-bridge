"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/pricing";
import { Drawer } from "./drawer";

interface LedgerRow {
  id: string;
  orderNumber: string;
  orderDate: string;
  medSpaName: string;
  medicationName: string;
  quantity: number;
  pharmacyName: string;
  pharmacyCost: number;
  biskFee: number;
  totalCost: number;
  expectedCost: number | null;
  billedCost: number;
  difference: number | null;
  status: string;
}

const STATUS_LABELS: Record<string, string> = {
  match: "Match — billed cost matches contract price",
  needs_review: "Needs Review — no contract rate or small discrepancy",
  issue: "Issue — large discrepancy (>10%)",
};

const STATUS_DOT: Record<string, string> = {
  match: "bg-green-500",
  needs_review: "bg-amber-400",
  issue: "bg-red-500",
};

export function LedgerDetailDrawer({ row, onClose }: { row: LedgerRow | null; onClose: () => void }) {
  if (!row) return null;

  const totalCost = row.totalCost;

  return (
    <Drawer open={true} onClose={onClose} title="Transaction Detail">
      <div className="space-y-4">
        {/* Order ID */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-gray-400">{row.orderNumber}</span>
        </div>

        {/* Key info */}
        <div className="bg-gray-50 rounded-md p-3 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Medication</p>
              <p className="text-sm font-medium text-gray-900">{row.medicationName}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Quantity</p>
              <p className="text-sm font-medium text-gray-900">{row.quantity}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Med Spa</p>
              <p className="text-sm text-gray-700">{row.medSpaName}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Date</p>
              <p className="text-sm text-gray-700">{new Date(row.orderDate).toLocaleDateString()}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Pharmacy</p>
            <p className="text-sm text-gray-700">{row.pharmacyName}</p>
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="border border-gray-200 rounded-md px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Pharmacy Cost</span>
            <span className="text-sm font-medium text-gray-900 tabular-nums">{formatCurrency(row.pharmacyCost)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Bisk Fee</span>
            <span className="text-sm text-gray-400 tabular-nums">{formatCurrency(row.biskFee)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-xs font-semibold text-gray-700">Total Cost</span>
            <span className="text-sm font-bold text-gray-900 tabular-nums">{formatCurrency(totalCost)}</span>
          </div>
        </div>

        {/* Reconciliation */}
        <div className="border border-gray-200 rounded-md px-4 py-3 space-y-2">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Reconciliation</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Expected Contract Cost</span>
            <span className="text-sm text-gray-700 tabular-nums">{row.expectedCost != null ? formatCurrency(row.expectedCost) : <span className="text-gray-300">No contract rate</span>}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Billed Cost</span>
            <span className="text-sm font-medium text-gray-900 tabular-nums">{formatCurrency(row.billedCost)}</span>
          </div>
          {row.difference != null && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Difference</span>
              <span className={`text-sm font-medium tabular-nums ${Math.abs(row.difference) < 0.01 ? "text-green-700" : "text-red-600"}`}>
                {Math.abs(row.difference) < 0.01 ? "$0.00" : `${row.difference > 0 ? "+" : ""}${formatCurrency(row.difference)}`}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
            <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[row.status] ?? "bg-gray-300"}`} />
            <span className="text-xs text-gray-600">{STATUS_LABELS[row.status] ?? row.status}</span>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

// Wrapper to make rows clickable with drawer state
export function LedgerRowClickable({ row, children }: { row: LedgerRow; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div onClick={() => setOpen(true)} className="cursor-pointer">
        {children}
      </div>
      {open && <LedgerDetailDrawer row={row} onClose={() => setOpen(false)} />}
    </>
  );
}
