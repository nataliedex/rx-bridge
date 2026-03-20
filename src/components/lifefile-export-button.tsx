"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { exportLifefileCSV } from "@/lib/actions";

interface OrderSummary {
  id: string;
  patient: string;
  medication: string;
}

interface ExportBatchRecord {
  id: string;
  fileName: string;
  orderCount: number;
  createdAt: string;
}

interface Props {
  orderIds: string[];
  pharmacyId: string;
  pharmacyName: string;
  orders: OrderSummary[];
  recentExports: ExportBatchRecord[];
}

export function LifefileExportButton({ orderIds, pharmacyId, pharmacyName, orders, recentExports }: Props) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ orderId: string; missingFields: string[] }[] | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ count: number; fileName: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  function handleClick() {
    setError(null);
    setValidationErrors(null);
    setSuccessInfo(null);
    setShowConfirm(true);
  }

  async function handleConfirmExport() {
    setExporting(true);
    setError(null);
    setValidationErrors(null);

    try {
      const result = await exportLifefileCSV(orderIds, pharmacyId);

      if (!result.success) {
        setValidationErrors(result.errors);
        setShowConfirm(false);
        return;
      }

      // Trigger CSV download
      const blob = new Blob([result.csv!], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName!;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessInfo({ count: orderIds.length, fileName: result.fileName! });
      setShowConfirm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      setShowConfirm(false);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={exporting || orderIds.length === 0}
        className="border border-green-300 text-green-700 rounded-md px-4 py-2 text-sm font-medium hover:bg-green-50 disabled:opacity-50 transition-colors"
      >
        Export Lifefile CSV
      </button>

      {/* Success feedback */}
      {successInfo && (
        <div className="mt-2 bg-green-50 border border-green-200 rounded-md p-2.5 text-xs text-green-700 flex items-center gap-2">
          <span>&#10003;</span>
          <span>Exported {successInfo.count} order{successInfo.count !== 1 ? "s" : ""} — <span className="font-mono">{successInfo.fileName}</span></span>
        </div>
      )}

      {/* Validation errors */}
      {validationErrors && validationErrors.length > 0 && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-md p-3 text-xs">
          <p className="text-red-800 font-medium mb-1">Missing Lifefile-required data:</p>
          {validationErrors.map((v) => (
            <p key={v.orderId} className="text-red-700">{v.orderId.slice(-8)}: {v.missingFields.join(", ")}</p>
          ))}
        </div>
      )}

      {error && <p className="text-red-600 text-xs mt-2">{error}</p>}

      {/* Batch history */}
      {recentExports.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowHistory(!showHistory)} className="text-[10px] text-gray-400 hover:text-gray-600">
            {showHistory ? "Hide" : "Show"} export history ({recentExports.length})
          </button>
          {showHistory && (
            <div className="mt-1 space-y-1">
              {recentExports.map((b) => (
                <div key={b.id} className="text-[11px] text-gray-500 flex items-center gap-2">
                  <span className="text-gray-300">&#8226;</span>
                  <span className="font-mono text-gray-400">{b.fileName}</span>
                  <span>{b.orderCount} order{b.orderCount !== 1 ? "s" : ""}</span>
                  <span className="text-gray-300">{new Date(b.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Export Lifefile CSV</h3>
              <p className="text-xs text-gray-500 mt-0.5">{pharmacyName}</p>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-gray-700 mb-3">
                <span className="font-medium">{orderIds.length}</span> order{orderIds.length !== 1 ? "s" : ""} will be exported as a Lifefile-compatible CSV file.
              </p>

              <div className="bg-gray-50 rounded-md border border-gray-100 max-h-48 overflow-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Patient</th>
                      <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Medication</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b border-gray-50">
                        <td className="px-3 py-1.5 text-gray-700">{o.patient}</td>
                        <td className="px-3 py-1.5 text-gray-600">{o.medication}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                <span>Format:</span>
                <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">Lifefile CSV</span>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button
                onClick={handleConfirmExport}
                disabled={exporting}
                className="bg-green-700 text-white rounded-md px-4 py-1.5 text-sm font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
              >
                {exporting ? "Exporting..." : "Confirm Export"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
