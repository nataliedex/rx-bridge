"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrency, getPricingUnit } from "@/lib/pricing";
import { verifyContract } from "@/lib/actions";
import { UpdateContractDrawer } from "./update-contract-drawer";

interface ContractMedication {
  id: string;
  medicationId: string;
  medicationName: string;
  medicationForm: string;
  currentPrice: number;
  effectiveDate: string;
}

interface CatalogMedication {
  id: string;
  name: string;
  form: string;
}

interface Props {
  pharmacyId: string;
  pharmacyName: string;
  medications: ContractMedication[];
  catalog: CatalogMedication[];
  contractVerifiedAt: string | null;
  contractVerifiedBy: string | null;
  contractEffectiveFrom: string | null;
  contractEffectiveThrough: string | null;
  freshnessMonths: number;
  defaultContractTermMonths: number;
}

function relativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

export function PharmacyContractSection({ pharmacyId, pharmacyName, medications, catalog, contractVerifiedAt, contractVerifiedBy, contractEffectiveFrom, contractEffectiveThrough, freshnessMonths, defaultContractTermMonths }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [highlightMedId, setHighlightMedId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    const h = searchParams.get("highlight");
    if (h) {
      setHighlightMedId(h);
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      // Clear highlight after a few seconds
      const timer = setTimeout(() => setHighlightMedId(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const needsVerification = (() => {
    if (!contractVerifiedAt) return true;
    const days = (Date.now() - new Date(contractVerifiedAt).getTime()) / (1000 * 60 * 60 * 24);
    return days > freshnessMonths * 30;
  })();

  async function handleVerify() {
    setVerifying(true);
    try {
      await verifyContract(pharmacyId, "current-user", "confirmed");
      router.refresh();
    } catch { /* stay */ }
    finally { setVerifying(false); }
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-900">Active Contract Pricing</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {medications.length} medication{medications.length !== 1 ? "s" : ""} under contract
              {contractEffectiveFrom && contractEffectiveThrough && (
                <span className="text-gray-400"> &middot; {new Date(contractEffectiveFrom).toLocaleDateString()} &ndash; {new Date(contractEffectiveThrough).toLocaleDateString()}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleVerify} disabled={verifying}
              className="text-[11px] text-green-700 hover:text-green-900 font-medium border border-green-200 rounded-md px-2 py-1 hover:bg-green-50 disabled:opacity-50 transition-colors">
              {verifying ? "..." : "\u2714 Verify"}
            </button>
            <button onClick={() => setDrawerOpen(true)}
              className="bg-indigo-600 text-white rounded-md px-3 py-1.5 text-[12px] font-medium hover:bg-indigo-700 transition-colors">
              {needsVerification ? "Renew Contract" : "Update Contract"}
            </button>
          </div>
        </div>

        {/* Contract status bar */}
        {medications.length > 0 && (
          <div className={`px-4 py-2.5 border-b flex items-center justify-between ${needsVerification ? "bg-amber-50/50 border-amber-100" : "bg-green-50/30 border-green-100"}`}>
            <div className="flex items-center gap-2">
              {contractVerifiedAt ? (
                <>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${needsVerification ? "bg-amber-400" : "bg-green-500"}`} />
                  <span className="text-[12px] text-gray-600">
                    Verified {relativeTime(contractVerifiedAt)}
                    {contractVerifiedBy && <span className="text-gray-400"> by {contractVerifiedBy}</span>}
                  </span>
                  {needsVerification && <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Needs Renewal</span>}
                </>
              ) : (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-[12px] text-amber-700">Not verified</span>
                </>
              )}
            </div>
          </div>
        )}

        {medications.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-400 text-sm">No contract pricing set.</p>
            <button onClick={() => setDrawerOpen(true)} className="text-sm text-indigo-600 hover:underline mt-1">Add contract pricing</button>
          </div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Medication</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Contract Price</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Effective</th>
              </tr>
            </thead>
            <tbody>
              {medications.map((m) => {
                const isHighlighted = highlightMedId === m.medicationId;
                return (
                <tr key={m.id} ref={isHighlighted ? highlightRef : undefined}
                  className={`border-b border-gray-50 transition-colors duration-700 ${isHighlighted ? "bg-indigo-50 ring-1 ring-indigo-200" : ""}`}>
                  <td className="px-4 py-2.5 text-[13px] text-gray-900">{m.medicationName}</td>
                  <td className="px-4 py-2.5 text-right text-[13px] font-medium text-gray-900">
                    {formatCurrency(m.currentPrice)} <span className="text-[10px] font-normal text-gray-400">/ {getPricingUnit(m.medicationForm)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-[11px] text-gray-400">
                    {new Date(m.effectiveDate).toLocaleDateString()}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <UpdateContractDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        pharmacyId={pharmacyId}
        pharmacyName={pharmacyName}
        medications={medications}
        catalog={catalog}
        contractEffectiveFrom={contractEffectiveFrom}
        contractEffectiveThrough={contractEffectiveThrough}
        contractVerifiedAt={contractVerifiedAt}
        defaultContractTermMonths={defaultContractTermMonths}
      />
    </>
  );
}
