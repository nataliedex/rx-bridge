"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveIssue, dismissIssue, reopenIssue } from "@/lib/actions";
import { ISSUE_SOURCE_LABELS, type IssueSource } from "@/lib/types";
import { scrollToField } from "./section-edit-primitives";

interface IssueItem {
  id: string;
  type: string;
  severity: string;
  source: string;
  fieldPath: string | null;
  title: string;
  message: string;
  status: string;
  resolutionNote: string | null;
  resolvedAt: Date | null;
}

interface Props {
  issues: IssueItem[];
  sendReadiness: string;
}

function getSectionAnchor(fieldPath: string | null): string | null {
  if (!fieldPath) return null;
  if (fieldPath.startsWith("patient.")) return "section-patient";
  if (fieldPath.startsWith("prescriber.")) return "section-prescriber";
  if (fieldPath.startsWith("medication.")) return "section-prescription";
  return null;
}

function getSectionName(fieldPath: string | null): string {
  if (!fieldPath) return "order data";
  if (fieldPath.startsWith("patient.")) return "Patient";
  if (fieldPath.startsWith("prescriber.")) return "Prescriber";
  if (fieldPath.startsWith("medication.")) return "Prescription";
  return "order data";
}

const SEVERITY_STYLE: Record<string, { border: string; badge: string; badgeText: string }> = {
  blocking: { border: "border-red-200", badge: "bg-red-100 text-red-700", badgeText: "blocking" },
  warning: { border: "border-yellow-200", badge: "bg-yellow-100 text-yellow-700", badgeText: "warning" },
  info: { border: "border-gray-200", badge: "bg-gray-100 text-gray-600", badgeText: "info" },
};

// Dispatches a custom event to tell a section to open edit mode
function triggerEditMode(fieldPath: string) {
  const sectionId = getSectionAnchor(fieldPath);
  if (sectionId) {
    const section = document.getElementById(sectionId);
    section?.dispatchEvent(new CustomEvent("open-edit", { detail: { fieldPath } }));
  }
}

export function OpenIssues({ issues, sendReadiness }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const open = issues.filter((i) => i.status === "open");
  const closed = issues.filter((i) => i.status !== "open");
  const openBlocking = open.filter((i) => i.severity === "blocking");
  const openOther = open.filter((i) => i.severity !== "blocking");
  const total = issues.length;
  const closedCount = closed.length;
  const allDone = total > 0 && open.length === 0;

  async function handleResolve(id: string) {
    setLoading(id); setConfirmingId(null);
    try { await resolveIssue(id); router.refresh(); } finally { setLoading(null); }
  }

  async function handleDismiss(id: string) {
    setLoading(id); setConfirmingId(null);
    try { await dismissIssue(id); router.refresh(); } finally { setLoading(null); }
  }

  async function handleReopen(id: string) {
    setLoading(id);
    try { await reopenIssue(id); router.refresh(); } finally { setLoading(null); }
  }

  function handleGoToField(fieldPath: string) {
    triggerEditMode(fieldPath);
    // Small delay to let edit mode render before scrolling to the field
    setTimeout(() => scrollToField(fieldPath), 150);
  }

  if (total === 0) return null;

  function renderIssue(issue: IssueItem) {
    const sev = SEVERITY_STYLE[issue.severity] || SEVERITY_STYLE.info;
    const sectionName = getSectionName(issue.fieldPath);
    const isConfirming = confirmingId === issue.id;
    const sourceLabel = ISSUE_SOURCE_LABELS[issue.source as IssueSource] || issue.source;
    const hasField = !!issue.fieldPath;

    return (
      <div key={issue.id}>
        <div className={`flex items-start gap-3 px-3 py-2.5 rounded border bg-white ${sev.border}`}>
          <input type="checkbox" checked={false} disabled={loading === issue.id}
            onChange={() => setConfirmingId(issue.id)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{issue.title}</p>
            {issue.message !== issue.title && <p className="text-xs text-gray-600 mt-0.5">{issue.message}</p>}
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded ${sev.badge}`}>{sev.badgeText}</span>
              <span className="text-[10px] text-gray-400">{sourceLabel}</span>
              {hasField && (
                <button
                  onClick={() => handleGoToField(issue.fieldPath!)}
                  className="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline"
                >
                  Fix in {sectionName} &darr;
                </button>
              )}
            </div>
          </div>
        </div>

        {isConfirming && (
          <div className="ml-7 mt-1 mb-1 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs">
            <p className="text-amber-800 font-medium mb-2">
              {issue.source === "system" ? `Have you updated the ${sectionName} data?` : "Has this been addressed?"}
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleResolve(issue.id)} disabled={loading === issue.id}
                className="bg-indigo-600 text-white rounded px-3 py-1 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
                {loading === issue.id ? "Saving..." : "Resolve"}
              </button>
              {issue.severity !== "blocking" && (
                <button onClick={() => handleDismiss(issue.id)} disabled={loading === issue.id}
                  className="border border-gray-300 text-gray-600 rounded px-3 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-50">
                  Dismiss
                </button>
              )}
              {hasField && (
                <button onClick={() => { setConfirmingId(null); handleGoToField(issue.fieldPath!); }}
                  className="border border-gray-300 text-gray-700 rounded px-3 py-1 text-xs font-medium hover:bg-gray-50">
                  Edit {sectionName}
                </button>
              )}
              <button onClick={() => setConfirmingId(null)} className="text-gray-500 hover:text-gray-700 text-xs px-2">Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-5 ${
      allDone ? "bg-green-50/50 border-green-200"
        : sendReadiness === "missing_data" ? "bg-red-50/50 border-red-200"
        : "bg-yellow-50/50 border-yellow-200"
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            {allDone ? "All issues resolved" : `Open Issues (${open.length})`}
          </h2>
          {!allDone && <p className="text-xs text-gray-500 mt-0.5">Resolve each issue to proceed.</p>}
        </div>
        {total > 1 && (
          <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded border border-gray-200 tabular-nums">{closedCount}/{total}</span>
        )}
      </div>

      {total > 1 && (
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4">
          <div className={`h-1.5 rounded-full transition-all ${allDone ? "bg-green-500" : "bg-indigo-500"}`}
            style={{ width: `${total > 0 ? (closedCount / total) * 100 : 0}%` }} />
        </div>
      )}

      {openBlocking.length > 0 && <div className="space-y-1.5 mb-3">{openBlocking.map(renderIssue)}</div>}
      {openOther.length > 0 && <div className="space-y-1.5 mb-3">{openOther.map(renderIssue)}</div>}

      {closed.length > 0 && (
        <details className="group">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">{closed.length} resolved/dismissed</summary>
          <div className="space-y-1 mt-2">
            {closed.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-3 py-1.5 rounded bg-white/50">
                <input type="checkbox" checked={true} disabled={loading === i.id} onChange={() => handleReopen(i.id)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 shrink-0" />
                <span className="text-sm text-gray-400 line-through flex-1">{i.title}</span>
                <span className="text-[10px] text-gray-300">{i.status}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
