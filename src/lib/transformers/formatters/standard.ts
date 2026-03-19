import type { PharmacyFormatter } from "./base";
import type { NormalizedOrder, PharmacyPacket } from "../types";

export const standardFormatter: PharmacyFormatter = {
  formatId: "standard",
  label: "Standard Format",

  format(order: NormalizedOrder): PharmacyPacket {
    return {
      format: "standard",
      generatedAt: new Date().toISOString(),
      orderId: order.orderId,
      patient: order.patient,
      prescriber: order.prescriber,
      prescription: order.prescription,
      pharmacy: order.pharmacy,
      compliance: order.compliance,
      sendReadiness: order.sendReadiness,
    };
  },
};
