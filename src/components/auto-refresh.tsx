"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  intervalMs?: number;
  children: React.ReactNode;
}

export function AutoRefresh({ intervalMs = 12000, children }: Props) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      router.refresh();
      setLastRefresh(Date.now());
    }, intervalMs);
    return () => clearInterval(timer);
  }, [paused, intervalMs, router]);

  function handleManualRefresh() {
    router.refresh();
    setLastRefresh(Date.now());
  }

  const secondsAgo = Math.round((Date.now() - lastRefresh) / 1000);

  return (
    <div>
      <div className="flex items-center justify-end gap-3 mb-2">
        <span className="text-[10px] text-gray-400">
          {paused ? "Auto-refresh paused" : `Auto-refreshing every ${intervalMs / 1000}s`}
        </span>
        <button onClick={handleManualRefresh}
          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium">
          Refresh now
        </button>
        <button onClick={() => setPaused(!paused)}
          className="text-[10px] text-gray-400 hover:text-gray-600 font-medium">
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
      {children}
    </div>
  );
}
