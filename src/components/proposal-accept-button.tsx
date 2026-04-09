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
      <div className="text-green-700 text-sm font-medium">
        {"\u2713"} Pricing confirmed
      </div>
    );
  }

  return (
    <button onClick={handleAccept} disabled={accepting}
      className="bg-indigo-600 text-white rounded-lg px-8 py-3.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
      {accepting ? "Confirming..." : "Accept Pricing"}
    </button>
  );
}
