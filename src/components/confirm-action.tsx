"use client";

interface Props {
  message: string;
  detail?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmAction({ message, detail, confirmLabel, onConfirm, onCancel, loading }: Props) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2.5">
      <p className="text-xs font-medium text-red-700">{message}</p>
      {detail && <p className="text-[11px] text-red-600 mt-0.5">{detail}</p>}
      <div className="flex gap-2 mt-2">
        <button onClick={onConfirm} disabled={loading}
          className="text-xs text-white bg-red-600 hover:bg-red-700 rounded px-3 py-1.5 font-medium disabled:opacity-50 transition-colors">
          {loading ? "Processing..." : confirmLabel}
        </button>
        <button onClick={onCancel}
          className="text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded px-3 py-1.5 font-medium">
          Cancel
        </button>
      </div>
    </div>
  );
}
