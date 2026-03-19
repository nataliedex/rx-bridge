"use client";

import { useState } from "react";
import type { PharmacyPacket } from "@/lib/transformers/types";

export function JsonExportToggle({ packet }: { packet: PharmacyPacket }) {
  const [show, setShow] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(packet, null, 2));
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-medium">JSON Export</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShow(!show)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm hover:bg-gray-50"
          >
            {show ? "Hide" : "Show"} JSON
          </button>
          {show && (
            <button
              onClick={handleCopy}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm hover:bg-gray-50"
            >
              Copy
            </button>
          )}
        </div>
      </div>
      {show && (
        <pre className="bg-gray-900 text-green-400 rounded-md p-4 text-xs overflow-auto max-h-96">
          {JSON.stringify(packet, null, 2)}
        </pre>
      )}
    </div>
  );
}
