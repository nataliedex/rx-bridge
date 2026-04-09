"use client";

import { formatCurrency } from "@/lib/pricing";

interface LedgerRow {
  orderNumber: string;
  orderDate: string;
  medSpaId: string;
  medSpaName: string;
  medicationName: string;
  quantity: number;
  pharmacyName: string;
  pharmacyCost: number;
  biskFee: number;
  totalCost: number;
}

export function ExportStatementButton({ rows, period }: { rows: LedgerRow[]; period: string }) {
  function handleExport() {
    // Group by med spa
    const byMedSpa = new Map<string, { name: string; rows: LedgerRow[] }>();
    for (const r of rows) {
      if (!byMedSpa.has(r.medSpaId)) byMedSpa.set(r.medSpaId, { name: r.medSpaName, rows: [] });
      byMedSpa.get(r.medSpaId)!.rows.push(r);
    }

    const monthLabel = period === "month"
      ? new Date().toLocaleString("en-US", { month: "long", year: "numeric" })
      : "All Time";

    // Build HTML document
    const sections = Array.from(byMedSpa.entries()).map(([, { name, rows: spaRows }]) => {
      const totalScripts = spaRows.length;
      const pharmacySpend = spaRows.reduce((s, r) => s + r.pharmacyCost, 0);
      const biskFees = totalScripts * 5;
      const totalCost = pharmacySpend + biskFees;

      const lineRows = spaRows.map((r) => {
        const tc = r.totalCost;
        return `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280">${r.orderNumber}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151">${new Date(r.orderDate).toLocaleDateString()}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#111">${r.medicationName}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151;text-align:right">${r.quantity}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151">${r.pharmacyName}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#111;text-align:right">${formatCurrency(r.pharmacyCost)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#9ca3af;text-align:right">${formatCurrency(r.biskFee)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#111;text-align:right;font-weight:500">${formatCurrency(tc)}</td>
        </tr>`;
      }).join("");

      return `
        <div style="margin-bottom:32px">
          <h2 style="font-size:16px;font-weight:600;color:#111;margin-bottom:4px">${name}</h2>
          <div style="display:flex;gap:24px;margin-bottom:12px;font-size:12px;color:#6b7280">
            <span>${totalScripts} scripts</span>
            <span>Pharmacy: ${formatCurrency(pharmacySpend)}</span>
            <span>Bisk fees: ${formatCurrency(biskFees)}</span>
            <span style="font-weight:600;color:#111">Total: ${formatCurrency(totalCost)}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
            <thead>
              <tr style="background:#f9fafb">
                <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Order</th>
                <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Date</th>
                <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Medication</th>
                <th style="padding:6px 10px;text-align:right;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Qty</th>
                <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Pharmacy</th>
                <th style="padding:6px 10px;text-align:right;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Cost</th>
                <th style="padding:6px 10px;text-align:right;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Bisk Fee</th>
                <th style="padding:6px 10px;text-align:right;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Total</th>
              </tr>
            </thead>
            <tbody>${lineRows}</tbody>
          </table>
        </div>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bisk Monthly Statement — ${monthLabel}</title></head>
<body style="margin:0;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;font-size:13px;line-height:1.5">
  <div style="max-width:800px;margin:0 auto">
    <div style="padding-bottom:16px;border-bottom:2px solid #111;margin-bottom:24px;display:flex;justify-content:space-between;align-items:baseline">
      <span style="font-size:20px;font-weight:700;letter-spacing:-0.5px">Bisk</span>
      <span style="font-size:13px;color:#6b7280">Monthly Statement &middot; ${monthLabel}</span>
    </div>
    ${sections}
    <div style="padding-top:16px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af">
      Generated by Bisk &middot; ${new Date().toLocaleDateString()}
    </div>
  </div>
</body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  }

  return (
    <button onClick={handleExport}
      className="border border-gray-200 text-gray-700 rounded-md px-3 py-1.5 text-[12px] font-medium hover:bg-gray-50 transition-colors">
      Export Statement
    </button>
  );
}
