// The full transformation pipeline: RawIntake → NormalizedOrder → PharmacyPacket
// Also supports starting from a DB order (for existing records).

import type { Order, Patient, Prescriber, Pharmacy } from "@prisma/client";
import type { RawIntake } from "../intake/types";
import type { NormalizedOrder, PharmacyPacket } from "./types";
import { normalizeIntake, normalizeOrder } from "./normalize";
import { getFormatter } from "./formatters";

type OrderWithRelations = Order & {
  patient: Patient;
  prescriber: Prescriber;
  pharmacy: Pharmacy;
};

// Full pipeline from raw intake (pre-persistence)
export function transformIntake(
  intake: RawIntake,
  pharmacy: { id: string; name: string; fax?: string | null; email?: string | null; formatPreference: string },
  formatOverride?: string,
): { normalized: NormalizedOrder; packet: PharmacyPacket } {
  const normalized = normalizeIntake(intake, pharmacy);
  const formatter = getFormatter(formatOverride || pharmacy.formatPreference);
  const packet = formatter.format(normalized);
  return { normalized, packet };
}

// Pipeline from a persisted DB order (for detail/export pages)
export function transformOrder(
  order: OrderWithRelations,
  formatOverride?: string,
): { normalized: NormalizedOrder; packet: PharmacyPacket } {
  const normalized = normalizeOrder(order);
  const formatter = getFormatter(formatOverride || order.pharmacy.formatPreference);
  const packet = formatter.format(normalized);
  return { normalized, packet };
}
