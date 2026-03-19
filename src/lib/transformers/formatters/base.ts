// Every pharmacy formatter implements this interface.
// Given a NormalizedOrder, it produces a PharmacyPacket in its own format.
//
// To add a new pharmacy-specific format:
// 1. Create a new file in this directory (e.g. compoundrx.ts)
// 2. Export a formatter implementing PharmacyFormatter
// 3. Register it in the formatter registry (index.ts)

import type { NormalizedOrder, PharmacyPacket } from "../types";

export interface PharmacyFormatter {
  formatId: string;
  label: string;
  format(order: NormalizedOrder): PharmacyPacket;
}
