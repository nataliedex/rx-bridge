"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptProposal } from "@/lib/actions";

export function ProposalAcceptButton({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  async function handleAccept() {
    setAccepting(true);
    try {
      await acceptProposal(proposalId);
      setAccepted(true);
      router.refresh();
    } catch { /* stay */ }
    finally { setAccepting(false); }
  }

  if (accepted) {
    return (
      <div className="text-gray-900 text-sm font-semibold">
        {"\u2713"} Pricing confirmed
      </div>
    );
  }

  return (
    <button onClick={handleAccept} disabled={accepting}
      className="bg-gray-900 text-white rounded-md px-5 py-2.5 text-[14px] font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors">
      {accepting ? "Confirming..." : "Confirm Pricing"}
    </button>
  );
}
