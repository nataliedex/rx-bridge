import { getLedgerData, getLedgerSummaryUnified, getLedgerFilterOptions, getAllMedSpaPricingLookup, getOrCreateStatement, getOverdueStatementsSummary } from "@/lib/actions";
import { formatCurrency } from "@/lib/pricing";
import { LedgerFilters } from "@/components/ledger-filters";
import { LedgerAddOrder } from "@/components/ledger-add-order";
import { LedgerRowClickable } from "@/components/ledger-detail-drawer";
import { ExportStatementButton } from "@/components/ledger-export-statement";
import { LedgerViewToggle } from "@/components/ledger-view-toggle";
import { StatementActions } from "@/components/statement-actions";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ medSpa?: string; pharmacy?: string; period?: string; status?: string; view?: string; new?: string }>;
}

const STATUS_STYLES: Record<string, { label: string; dot: string; text: string }> = {
  match: { label: "Match", dot: "bg-green-500", text: "text-green-700" },
  needs_review: { label: "Needs Review", dot: "bg-amber-400", text: "text-amber-700" },
  issue: { label: "Issue", dot: "bg-red-500", text: "text-red-600" },
};

export default async function LedgerPage({ searchParams }: Props) {
  const params = await searchParams;
  const medSpaFilter = params.medSpa || "";
  const pharmacyFilter = params.pharmacy || "";
  const period = params.period || "month";
  const statusFilter = params.status || "all";
  const view = params.view || "all";

  const [rows, summary, filterOptions, pricingLookup, overdue] = await Promise.all([
    getLedgerData({
      medSpaId: medSpaFilter || undefined,
      pharmacyName: pharmacyFilter || undefined,
      period,
      status: statusFilter || undefined,
    }),
    getLedgerSummaryUnified(period),
    getLedgerFilterOptions(),
    getAllMedSpaPricingLookup(),
    getOverdueStatementsSummary(),
  ]);

  const hasFilters = medSpaFilter || pharmacyFilter || statusFilter !== "all";

  // Group by med spa for grouped view + create statements
  const grouped = new Map<string, { name: string; rows: typeof rows; statement: Awaited<ReturnType<typeof getOrCreateStatement>> | null }>();
  if (view === "grouped" && rows.length > 0) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const medSpaIds = new Set(rows.map((r) => r.medSpaId));
    for (const spaId of medSpaIds) {
      const spaRows = rows.filter((r) => r.medSpaId === spaId);
      const name = spaRows[0]?.medSpaName ?? "";
      const statement = await getOrCreateStatement(spaId, period === "month" ? currentMonth : currentMonth);
      grouped.set(spaId, { name, rows: spaRows, statement });
    }
  } else {
    for (const r of rows) {
      if (!grouped.has(r.medSpaId)) grouped.set(r.medSpaId, { name: r.medSpaName, rows: [], statement: null });
      grouped.get(r.medSpaId)!.rows.push(r);
    }
  }

  // Totals — computed from persisted per-order values
  const totalPharmacyCost = Math.round(rows.reduce((s, r) => s + r.pharmacyCost, 0) * 100) / 100;
  const totalBiskFees = Math.round(rows.reduce((s, r) => s + r.biskFee, 0) * 100) / 100;
  const totalCost = Math.round((totalPharmacyCost + totalBiskFees) * 100) / 100;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 4rem)" }}>
      <div className="shrink-0">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h1 className="text-2xl font-semibold">Ledger</h1>
            <p className="text-sm text-gray-500 mt-1">Track pharmacy costs and validate against contract pricing</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportStatementButton rows={rows} period={period} />
            <LedgerAddOrder medSpas={pricingLookup.medSpas} lookup={pricingLookup.lookup} autoOpen={params.new === "1"} pricingStrategy={pricingLookup.pricingStrategy} />
          </div>
        </div>

        {/* Overdue banner */}
        {overdue.count > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-4">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            <span className="text-sm font-medium text-red-800">{overdue.count} statement{overdue.count !== 1 ? "s" : ""} overdue</span>
            <span className="text-sm text-red-600">{formatCurrency(overdue.totalAmount)}</span>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Total Scripts</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.count}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{period === "month" ? "this month" : "all time"}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Pharmacy Spend</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.cost)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Bisk Fees</p>
            <p className="text-2xl font-bold text-gray-500 mt-1">{formatCurrency(summary.totalBiskFees)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Total Cost</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.totalCost)}</p>
          </div>
        </div>

        {/* Reconciliation summary */}
        {(summary.reviewCount > 0 || summary.issueCount > 0) && (
          <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-4 text-[12px]">
            <span className="text-sm font-medium text-amber-900">Reconciliation</span>
            <span className="text-green-700">{summary.matchCount} match</span>
            {summary.reviewCount > 0 && (
              <a href={`/ledger?period=${period}&status=needs_review`} className="text-amber-700 font-medium underline underline-offset-2 hover:text-amber-900">
                {summary.reviewCount} needs review
              </a>
            )}
            {summary.issueCount > 0 && (
              <a href={`/ledger?period=${period}&status=issue`} className="text-red-600 font-medium underline underline-offset-2 hover:text-red-800">
                {summary.issueCount} issue{summary.issueCount !== 1 ? "s" : ""}
              </a>
            )}
          </div>
        )}

        {statusFilter !== "all" && (
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-xs text-gray-500">Showing:</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 pl-2 pr-1 py-0.5 rounded">
              {STATUS_STYLES[statusFilter]?.label ?? statusFilter}
              <a href={`/ledger?period=${period}${medSpaFilter ? `&medSpa=${medSpaFilter}` : ""}${pharmacyFilter ? `&pharmacy=${pharmacyFilter}` : ""}`}
                className="text-indigo-400 hover:text-indigo-700 ml-0.5 leading-none text-sm">&times;</a>
            </span>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <LedgerFilters
            currentMedSpa={medSpaFilter}
            currentPharmacy={pharmacyFilter}
            currentPeriod={period}
            medSpas={filterOptions.medSpas}
            pharmacies={filterOptions.pharmacies}
          />
          <LedgerViewToggle currentView={view} period={period} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-400 text-sm">{hasFilters ? "No records match these filters." : "No transactions yet."}</p>
        </div>
      ) : view === "grouped" ? (
        /* Grouped by Med Spa — with statement tracking */
        <div className="flex-1 overflow-y-auto space-y-4">
          {Array.from(grouped.entries()).map(([spaId, { name, rows: spaRows, statement }]) => {
            const spaSpend = Math.round(spaRows.reduce((s, r) => s + r.pharmacyCost, 0) * 100) / 100;
            const spaFees = Math.round(spaRows.length * 5 * 100) / 100;
            const spaTotal = Math.round((spaSpend + spaFees) * 100) / 100;
            return (
              <div key={spaId} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{name}</p>
                      <p className="text-[11px] text-gray-400">{spaRows.length} script{spaRows.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(spaTotal)}</p>
                      <p className="text-[10px] text-gray-400">total cost</p>
                    </div>
                  </div>
                  {statement && (
                    <div className="mt-2 pt-2 border-t border-gray-200/60">
                      <StatementActions
                        statementId={statement.id}
                        status={statement.status}
                        dueDate={statement.dueDate?.toISOString() ?? null}
                        totalCost={spaTotal}
                        onExport={() => {}}
                      />
                    </div>
                  )}
                </div>
                <div>
                  {spaRows.map((r, idx) => {
                    const st = STATUS_STYLES[r.status] ?? STATUS_STYLES.match;
                    const tc = r.totalCost;
                    return (
                      <LedgerRowClickable key={r.id} row={r}>
                        <div className={`flex items-center px-4 py-2 border-b border-gray-50 hover:bg-indigo-50/50 cursor-pointer transition-colors ${idx % 2 === 1 ? "bg-gray-50/30" : ""}`}>
                          <div className="flex-[0.5] text-[10px] font-mono text-gray-400">{r.orderNumber}</div>
                          <div className="flex-[0.5] text-[12px] text-gray-500">{new Date(r.orderDate).toLocaleDateString()}</div>
                          <div className="flex-[1.2] text-[13px] text-gray-900 truncate">{r.medicationName}</div>
                          <div className="flex-[0.3] text-right text-[12px] text-gray-600 tabular-nums">{r.quantity}</div>
                          <div className="flex-[0.8] text-[12px] text-gray-500 truncate">{r.pharmacyName}</div>
                          <div className="flex-[0.5] text-right text-[13px] font-medium text-gray-900 tabular-nums">{formatCurrency(tc)}</div>
                          <div className="flex-[0.4] text-center">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          </div>
                        </div>
                      </LedgerRowClickable>
                    );
                  })}
                  {/* Subtotals */}
                  <div className="flex items-center px-4 py-2 bg-gray-50 border-t border-gray-200 text-[12px]">
                    <div className="flex-[0.5]" />
                    <div className="flex-[0.5]" />
                    <div className="flex-[1.2] font-medium text-gray-700">Subtotal</div>
                    <div className="flex-[0.3]" />
                    <div className="flex-[0.8]" />
                    <div className="flex-[0.5] text-right font-semibold text-gray-900 tabular-nums">{formatCurrency(spaTotal)}</div>
                    <div className="flex-[0.4]" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* All transactions */
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="shrink-0 flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <div className="px-4 py-2.5 flex-[0.5]">Order</div>
            <div className="px-4 py-2.5 flex-[0.5]">Date</div>
            <div className="px-4 py-2.5 flex-[0.9]">Med Spa</div>
            <div className="px-4 py-2.5 flex-[1]">Medication</div>
            <div className="px-4 py-2.5 flex-[0.3] text-right">Qty</div>
            <div className="px-4 py-2.5 flex-[0.9]">Pharmacy</div>
            <div className="px-4 py-2.5 flex-[0.6] text-right">Cost</div>
            <div className="px-4 py-2.5 flex-[0.4] text-right">Fee</div>
            <div className="px-4 py-2.5 flex-[0.6] text-right">Total</div>
            <div className="px-4 py-2.5 flex-[0.5] text-center">Recon.</div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {rows.map((r, idx) => {
              const st = STATUS_STYLES[r.status] ?? STATUS_STYLES.match;
              const rowTotal = r.totalCost;
              return (
                <LedgerRowClickable key={r.id} row={r}>
                  <div className={`flex items-center border-b border-gray-100 hover:bg-indigo-50/50 transition-colors ${
                    r.status === "issue" ? "bg-red-50/20" : r.status === "needs_review" ? "bg-amber-50/10" : idx % 2 === 1 ? "bg-gray-50/40" : ""
                  }`}>
                    <div className="px-4 py-2 flex-[0.5] text-[10px] font-mono text-gray-400">{r.orderNumber}</div>
                    <div className="px-4 py-2 flex-[0.5] text-[12px] text-gray-500">{new Date(r.orderDate).toLocaleDateString()}</div>
                    <div className="px-4 py-2 flex-[0.9] text-[13px] text-gray-900 truncate">{r.medSpaName}</div>
                    <div className="px-4 py-2 flex-[1] text-[13px] text-gray-900 truncate">{r.medicationName}</div>
                    <div className="px-4 py-2 flex-[0.3] text-right text-[13px] text-gray-700 tabular-nums">{r.quantity}</div>
                    <div className="px-4 py-2 flex-[0.9] text-[13px] text-gray-600" title={r.pharmacyName}>{r.pharmacyName}</div>
                    <div className="px-4 py-2 flex-[0.6] text-right text-[13px] font-medium text-gray-900 tabular-nums">{formatCurrency(r.pharmacyCost)}</div>
                    <div className="px-4 py-2 flex-[0.4] text-right text-[12px] text-gray-400 tabular-nums">{formatCurrency(r.biskFee)}</div>
                    <div className="px-4 py-2 flex-[0.6] text-right text-[13px] font-medium text-gray-900 tabular-nums">{formatCurrency(rowTotal)}</div>
                    <div className="px-4 py-2 flex-[0.5] text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        <span className={`text-[10px] font-medium ${st.text}`}>{st.label}</span>
                      </div>
                    </div>
                  </div>
                </LedgerRowClickable>
              );
            })}
          </div>

          {/* Totals row */}
          <div className="shrink-0 flex items-center border-t-2 border-gray-200 bg-gray-50 text-[12px] font-semibold">
            <div className="px-4 py-2.5 flex-[0.5]" />
            <div className="px-4 py-2.5 flex-[0.5]" />
            <div className="px-4 py-2.5 flex-[0.9] text-gray-700">Totals</div>
            <div className="px-4 py-2.5 flex-[1]" />
            <div className="px-4 py-2.5 flex-[0.3] text-right text-gray-700 tabular-nums">{rows.reduce((s, r) => s + r.quantity, 0)}</div>
            <div className="px-4 py-2.5 flex-[0.9]" />
            <div className="px-4 py-2.5 flex-[0.6] text-right text-gray-900 tabular-nums">{formatCurrency(totalPharmacyCost)}</div>
            <div className="px-4 py-2.5 flex-[0.4] text-right text-gray-500 tabular-nums">{formatCurrency(totalBiskFees)}</div>
            <div className="px-4 py-2.5 flex-[0.6] text-right text-gray-900 tabular-nums">{formatCurrency(totalCost)}</div>
            <div className="px-4 py-2.5 flex-[0.5]" />
          </div>
        </div>
      )}
    </div>
  );
}
