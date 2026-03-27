"use client";

import { useRouter } from "next/navigation";

const PERIODS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

interface Props {
  currentPeriod: string;
}

export function AnalyticsTimeFilter({ currentPeriod }: Props) {
  const router = useRouter();

  function handleChange(period: string) {
    const params = new URLSearchParams();
    if (period !== "all") params.set("period", period);
    const qs = params.toString();
    router.push(`/analytics${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex gap-1">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => handleChange(p.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            currentPeriod === p.value
              ? "bg-indigo-600 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
