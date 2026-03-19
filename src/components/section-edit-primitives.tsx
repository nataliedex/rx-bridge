// Shared UI primitives for editable order sections.

export function EditField({ label, value, onChange, type = "text", hint, placeholder, fieldPath }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; hint?: string; placeholder?: string; fieldPath?: string;
}) {
  return (
    <div id={fieldPath ? `field-${fieldPath}` : undefined} className="scroll-mt-24">
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-indigo-300 rounded px-2.5 py-1.5 text-sm bg-indigo-50/30 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export function ViewRow({ label, value, fieldPath }: { label: string; value?: string | null; fieldPath?: string }) {
  return (
    <div id={fieldPath ? `field-${fieldPath}` : undefined} className="scroll-mt-24">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm">{value || <span className="text-gray-300">—</span>}</p>
    </div>
  );
}

export function SectionHeader({ title, editing, issueCount, onEdit }: {
  title: string; editing: boolean; issueCount: number; onEdit: () => void;
}) {
  return (
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-medium">{title}</h2>
        {issueCount > 0 && !editing && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {issueCount} issue{issueCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {!editing && (
        <button
          onClick={onEdit}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50"
        >
          Edit
        </button>
      )}
    </div>
  );
}

export function SaveBar({ saving, onSave, onCancel }: {
  saving: boolean; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex gap-2 pt-2 border-t border-gray-100">
      <button onClick={onSave} disabled={saving}
        className="bg-indigo-600 text-white rounded px-4 py-1.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
        {saving ? "Saving..." : "Save Changes"}
      </button>
      <button onClick={onCancel}
        className="border border-gray-300 text-gray-700 rounded px-4 py-1.5 text-sm hover:bg-gray-50">
        Cancel
      </button>
    </div>
  );
}

export function SavedBanner({ message }: { message: string }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-md p-2 mb-4">
      <p className="text-xs text-green-700">{message}</p>
    </div>
  );
}

export interface IssueRef {
  id: string;
  fieldPath: string | null;
  title: string;
  status: string;
}

export function PostSaveIssuePrompt({ sectionLabel, issues, resolvedIds, onResolve }: {
  sectionLabel: string; issues: IssueRef[]; resolvedIds: Set<string>; onResolve: (id: string) => void;
}) {
  const unresolved = issues.filter((i) => !resolvedIds.has(i.id));
  if (unresolved.length === 0) return null;
  return (
    <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
      <p className="text-xs font-medium text-green-800 mb-2">{sectionLabel} updated. Resolve related issues?</p>
      <div className="space-y-1.5">
        {unresolved.map((issue) => (
          <div key={issue.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-gray-700">{issue.title}</span>
            <button onClick={() => onResolve(issue.id)} className="text-green-700 font-medium hover:text-green-900 shrink-0">
              Mark resolved
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function sectionBorderClass(hasIssues: boolean): string {
  return hasIssues ? "border-red-200" : "border-gray-200";
}

// Scrolls to a field and triggers a highlight animation
export function scrollToField(fieldPath: string) {
  const el = document.getElementById(`field-${fieldPath}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("field-highlight-active");
    setTimeout(() => el.classList.remove("field-highlight-active"), 2500);
  }
}
