"use client";

import { useState } from "react";
import { AddMedicationDrawer } from "./add-medication-drawer";
import { AddPharmacyDrawer } from "./add-pharmacy-drawer";

export function NetworkActions() {
  const [medDrawerOpen, setMedDrawerOpen] = useState(false);
  const [pharmDrawerOpen, setPharmDrawerOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={() => setPharmDrawerOpen(true)}
          className="border border-gray-300 text-gray-700 rounded-md px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors">
          + Add Pharmacy
        </button>
        <button onClick={() => setMedDrawerOpen(true)}
          className="bg-indigo-600 text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 transition-colors">
          + Add Medication
        </button>
      </div>

      <AddMedicationDrawer open={medDrawerOpen} onClose={() => setMedDrawerOpen(false)} />
      <AddPharmacyDrawer open={pharmDrawerOpen} onClose={() => setPharmDrawerOpen(false)} />
    </>
  );
}
