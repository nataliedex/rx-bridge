"use client";

interface Props {
  message: string;
  detail?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmAction({ message, detail, confirmLabel = "Confirm", onConfirm, onCancel, loading }: Props) {
  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-md px-4 py-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-red-800">{message}</p>
        {detail && <p className="text-xs text-red-600 mt-0.5">{detail}</p>}
      </div>
      <button onClick={onConfirm} disabled={loading}
        className="bg-red-600 text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
        {loading ? "..." : confirmLabel}
      </button>
      <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
    </div>
  );
}
