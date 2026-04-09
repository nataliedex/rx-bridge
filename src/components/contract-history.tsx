"use client";

import { useState } from "react";

interface AuditLog {
  id: string;
  actionType: string;
  notes: string | null;
  performedBy: string | null;
  performedAt: string;
  changedFields: string | null;
}

interface Props {
  logs: AuditLog[];
  pharmacyId: string;
}

const ACTION_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  created: { label: "Created", bg: "bg-blue-100", text: "text-blue-700" },
  updated: { label: "Updated", bg: "bg-indigo-100", text: "text-indigo-700" },
  renewed: { label: "Renewed", bg: "bg-purple-100", text: "text-purple-700" },
  verified: { label: "Verified", bg: "bg-green-100", text: "text-green-700" },
  deleted: { label: "Removed", bg: "bg-red-100", text: "text-red-700" },
};

const CLICKABLE_ACTIONS = new Set(["renewed", "updated", "verified", "created"]);

function relativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function ContractHistory({ logs, pharmacyId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const displayed = expanded ? logs : logs.slice(0, 5);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-sm font-medium text-gray-900">Contract History</h2>
        <p className="text-xs text-gray-500 mt-0.5">{logs.length} event{logs.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="divide-y divide-gray-50">
        {displayed.map((log) => {
          const style = ACTION_STYLES[log.actionType] ?? ACTION_STYLES.updated;
          const isClickable = CLICKABLE_ACTIONS.has(log.actionType);
          const href = `/partnerships/pharmacies/${pharmacyId}/contracts/${log.id}`;

          const inner = (
            <>
              <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded shrink-0 mt-0.5 ${style.bg} ${style.text}`}>
                {style.label}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-gray-700">{log.notes || `Contract ${log.actionType}`}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {relativeTime(log.performedAt)}
                  {log.performedBy && <> &middot; {log.performedBy}</>}
                </p>
              </div>
              {isClickable && (
                <span className="text-gray-300 text-[11px] shrink-0 mt-0.5">&rsaquo;</span>
              )}
            </>
          );

          if (isClickable) {
            return (
              <a key={log.id} href={href} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2.5 flex items-start gap-3 cursor-pointer hover:bg-gray-50 transition-colors">
                {inner}
              </a>
            );
          }

          return (
            <div key={log.id} className="px-4 py-2.5 flex items-start gap-3">
              {inner}
            </div>
          );
        })}
      </div>

      {logs.length > 5 && (
        <div className="px-4 py-2 border-t border-gray-100">
          <button onClick={() => setExpanded(!expanded)} className="text-[11px] text-indigo-600 hover:text-indigo-800">
            {expanded ? "Show less" : `Show all ${logs.length} events`}
          </button>
        </div>
      )}
    </div>
  );
}
