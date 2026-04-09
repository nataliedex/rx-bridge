"use client";

import { useState } from "react";
import { AddMedicationDrawer } from "./add-medication-drawer";
import { AddPharmacyDrawer } from "./add-pharmacy-drawer";
import { AddBrandDrawer } from "./add-brand-drawer";

export function MedicationActions() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="bg-indigo-600 text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 transition-colors">
        + Add Medication
      </button>
      <AddMedicationDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function PharmacyActions({ autoOpen }: { autoOpen?: boolean } = {}) {
  const [open, setOpen] = useState(autoOpen ?? false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="bg-indigo-600 text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 transition-colors">
        + Add Pharmacy
      </button>
      <AddPharmacyDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function BrandActions() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="bg-indigo-600 text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 transition-colors">
        + Add Brand
      </button>
      <AddBrandDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
