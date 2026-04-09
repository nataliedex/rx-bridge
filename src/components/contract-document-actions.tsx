"use client";

export function ContractDocumentActions() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-md px-3 py-1.5 text-[12px] font-medium hover:bg-indigo-700 transition-colors"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Export PDF
    </button>
  );
}
