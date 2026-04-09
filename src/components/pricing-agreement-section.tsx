"use client";

import { formatCurrency } from "@/lib/pricing";

interface AgreementLineData {
  id: string;
  medicationId: string;
  medicationName: string;
  agreedPrice: number;
  pharmacyId: string | null;
  pharmacyName: string | null;
  estimatedMonthlyQty: number | null;
}

interface AgreementData {
  id: string;
  status: string;
  effectiveFrom: string;
  effectiveThrough: string;
  notes: string | null;
  createdAt: string;
  lines: AgreementLineData[];
}

interface HistoryItem {
  id: string;
  status: string;
  effectiveFrom: string;
  effectiveThrough: string;
  notes: string | null;
  createdAt: string;
  lineCount: number;
}

interface Props {
  agreement: AgreementData | null;
  history: HistoryItem[];
  onActivate: () => void;
  onRenew: () => void;
}

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: "Active", bg: "bg-green-100", text: "text-green-700" },
  draft: { label: "Draft", bg: "bg-gray-100", text: "text-gray-600" },
  superseded: { label: "Superseded", bg: "bg-gray-100", text: "text-gray-500" },
  expired: { label: "Expired", bg: "bg-red-100", text: "text-red-700" },
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function isExpiringSoon(through: string): boolean {
  const days = (new Date(through).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days > 0 && days <= 60;
}

export function PricingAgreementSection({ agreement, history, onActivate, onRenew }: Props) {
  const expiring = agreement ? isExpiringSoon(agreement.effectiveThrough) : false;
  const expired = agreement ? new Date(agreement.effectiveThrough).getTime() < Date.now() : false;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-900">Pricing Agreement</h2>
            {agreement ? (
              <p className="text-xs text-gray-500 mt-0.5">
                {shortDate(agreement.effectiveFrom)} {"\u2013"} {shortDate(agreement.effectiveThrough)}
                {" \u00B7 "}{agreement.lines.length} medication{agreement.lines.length !== 1 ? "s" : ""}
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-0.5">No active agreement</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {agreement && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                expired ? "bg-red-100 text-red-700" : expiring ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
              }`}>
                {expired ? "Expired" : expiring ? "Expiring Soon" : "Active"}
              </span>
            )}
            {agreement && (expired || expiring) ? (
              <button onClick={onRenew}
                className="bg-indigo-600 text-white rounded-md px-3 py-1.5 text-[12px] font-medium hover:bg-indigo-700 transition-colors">
                Renew Agreement
              </button>
            ) : !agreement ? (
              <button onClick={onActivate}
                className="bg-indigo-600 text-white rounded-md px-3 py-1.5 text-[12px] font-medium hover:bg-indigo-700 transition-colors">
                Activate Agreement
              </button>
            ) : null}
          </div>
        </div>

        {!agreement ? (
          <div className="p-6 text-center">
            <p className="text-gray-400 text-sm">No active pricing agreement.</p>
            <p className="text-[11px] text-gray-400 mt-1">Build a proposal first, then activate it as an agreement.</p>
            <button onClick={onActivate} className="text-sm text-indigo-600 hover:underline mt-2">Activate Agreement from Proposal</button>
          </div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Medication</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Agreed Price</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Pharmacy</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Mo. Qty</th>
              </tr>
            </thead>
            <tbody>
              {agreement.lines.map((l) => (
                <tr key={l.id} className="border-b border-gray-50">
                  <td className="px-4 py-2.5 text-[13px] text-gray-900">{l.medicationName}</td>
                  <td className="px-4 py-2.5 text-right text-[13px] font-medium text-gray-900">{formatCurrency(l.agreedPrice)}</td>
                  <td className="px-4 py-2.5 text-[12px] text-gray-500">{l.pharmacyName ?? "\u2014"}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] text-gray-600">{l.estimatedMonthlyQty ?? "\u2014"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Agreement history */}
      {history.length > 1 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-medium text-gray-900">Agreement History</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {history.map((h) => {
              const style = STATUS_STYLES[h.status] ?? STATUS_STYLES.draft;
              return (
                <div key={h.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-gray-700">{h.lineCount} medication{h.lineCount !== 1 ? "s" : ""}</p>
                    <p className="text-[10px] text-gray-400">{shortDate(h.effectiveFrom)} {"\u2013"} {shortDate(h.effectiveThrough)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
