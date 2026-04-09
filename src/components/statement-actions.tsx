"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendStatement, markStatementPaid } from "@/lib/actions";

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "bg-gray-100", text: "text-gray-600" },
  sent: { label: "Sent", bg: "bg-blue-100", text: "text-blue-700" },
  paid: { label: "Paid", bg: "bg-green-100", text: "text-green-700" },
  overdue: { label: "Overdue", bg: "bg-red-100", text: "text-red-700" },
};

interface Props {
  statementId: string;
  status: string;
  dueDate: string | null;
  totalCost: number;
  onExport: () => void;
}

export function StatementActions({ statementId, status, dueDate, onExport }: Props) {
  const router = useRouter();
  const [acting, setActing] = useState(false);
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.draft;

  async function handleSend() {
    setActing(true);
    try {
      await sendStatement(statementId);
      onExport(); // Generate the PDF
      router.refresh();
    } catch { /* stay */ }
    finally { setActing(false); }
  }

  async function handleMarkPaid() {
    setActing(true);
    try {
      await markStatementPaid(statementId);
      router.refresh();
    } catch { /* stay */ }
    finally { setActing(false); }
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>{badge.label}</span>
      {dueDate && status !== "paid" && (
        <span className="text-[10px] text-gray-400">Due {new Date(dueDate).toLocaleDateString()}</span>
      )}
      {status === "draft" && (
        <button onClick={handleSend} disabled={acting}
          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50">
          {acting ? "..." : "Send Statement"}
        </button>
      )}
      {(status === "sent" || status === "overdue") && (
        <button onClick={handleMarkPaid} disabled={acting}
          className="text-[11px] text-green-600 hover:text-green-800 font-medium disabled:opacity-50">
          {acting ? "..." : "Mark Paid"}
        </button>
      )}
    </div>
  );
}
