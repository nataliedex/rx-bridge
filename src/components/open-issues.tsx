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
  isInbound?: boolean;
  onRequestCorrection?: (reason: string) => void;
}

function getSection(fieldPath: string | null): string {
  if (!fieldPath) return "General";
  if (fieldPath.startsWith("patient.")) return "Patient";
  if (fieldPath.startsWith("prescriber.")) return "Prescriber";
  if (fieldPath.startsWith("medication.")) return "Prescription";
  return "General";
}

function getSectionAnchor(fieldPath: string | null): string | null {
  if (!fieldPath) return null;
  if (fieldPath.startsWith("patient.")) return "section-patient";
  if (fieldPath.startsWith("prescriber.")) return "section-prescriber";
  if (fieldPath.startsWith("medication.")) return "section-prescription";
  return null;
}

function triggerEditMode(fieldPath: string) {
  const sectionId = getSectionAnchor(fieldPath);
  if (sectionId) {
    document.getElementById(sectionId)?.dispatchEvent(new CustomEvent("open-edit", { detail: { fieldPath } }));
  }
}

export function OpenIssues({ issues, sendReadiness, isInbound, onRequestCorrection }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const open = issues.filter((i) => i.status === "open");
  const closed = issues.filter((i) => i.status !== "open");
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
    setTimeout(() => scrollToField(fieldPath), 150);
  }

  if (total === 0) return null;

  // Group open issues by section, maintain severity order within each group
  const severityOrder: Record<string, number> = { blocking: 0, warning: 1, info: 2 };
  const sortedOpen = [...open].sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

  const sectionOrder = ["Prescription", "Patient", "Prescriber", "General"];
  const grouped = new Map<string, IssueItem[]>();
  for (const section of sectionOrder) grouped.set(section, []);
  for (const issue of sortedOpen) {
    const section = getSection(issue.fieldPath);
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section)!.push(issue);
  }

  function renderIssue(issue: IssueItem) {
    const isSystem = issue.source === "system";
    const isConfirming = confirmingId === issue.id;
    const hasField = !!issue.fieldPath;

    return (
      <div key={issue.id}>
        <div className={`flex items-start gap-3 px-3 py-2 rounded-md border bg-white ${
          issue.severity === "blocking" ? "border-red-200" : issue.severity === "warning" ? "border-amber-200" : "border-gray-200"
        }`}>
          {!isInbound && (
            <input type="checkbox" checked={false} disabled={loading === issue.id}
              onChange={() => isSystem && hasField ? handleGoToField(issue.fieldPath!) : setConfirmingId(issue.id)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-gray-900">{issue.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {isSystem ? (
                <span className="text-[10px] text-gray-400">{isInbound ? "Requires correction from source" : "Resolves after save"}</span>
              ) : (
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">
                  {ISSUE_SOURCE_LABELS[issue.source as IssueSource] || issue.source}
                </span>
              )}
              {!isInbound && hasField && (
                <button onClick={() => handleGoToField(issue.fieldPath!)}
                  className="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline">
                  Fix
                </button>
              )}
              {isInbound && onRequestCorrection && (
                <button onClick={() => onRequestCorrection(issue.title)}
                  className="text-[10px] text-purple-600 hover:text-purple-800 hover:underline font-medium">
                  Request Correction
                </button>
              )}
            </div>
          </div>
          <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
            issue.severity === "blocking" ? "bg-red-400" : issue.severity === "warning" ? "bg-amber-400" : "bg-gray-300"
          }`} />
        </div>

        {!isInbound && isConfirming && (
          <div className="ml-7 mt-1 mb-1 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs">
            <p className="text-amber-800 font-medium mb-2">Has this been addressed?</p>
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
        : "bg-amber-50/50 border-amber-200"
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            {allDone ? "All issues resolved" : "Open Issues"}
          </h2>
          {!allDone && (
            <p className="text-xs text-gray-500 mt-0.5">
              {open.length} remaining{closedCount > 0 ? ` · ${closedCount} resolved` : ""}
            </p>
          )}
        </div>
      </div>

      {total > 1 && (
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4">
          <div className={`h-1.5 rounded-full transition-all ${allDone ? "bg-green-500" : "bg-indigo-500"}`}
            style={{ width: `${total > 0 ? (closedCount / total) * 100 : 0}%` }} />
        </div>
      )}

      {/* Open issues grouped by section */}
      {Array.from(grouped.entries()).map(([section, items]) => {
        if (items.length === 0) return null;
        const showHeader = open.length > 2;
        return (
          <div key={section} className="mb-3">
            {showHeader && (
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                {section} ({items.length})
              </p>
            )}
            <div className="space-y-1.5">{items.map(renderIssue)}</div>
          </div>
        );
      })}

      {/* Resolved — collapsed */}
      {closed.length > 0 && (
        <details className="group">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">{closed.length} resolved</summary>
          <div className="space-y-1 mt-2">
            {closed.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-3 py-1.5 rounded bg-white/50">
                <input type="checkbox" checked={true} disabled={loading === i.id} onChange={() => handleReopen(i.id)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 shrink-0" />
                <span className="text-sm text-gray-400 line-through flex-1">{i.title}</span>
                {i.resolutionNote && <span className="text-[10px] text-gray-300">{i.resolutionNote}</span>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
