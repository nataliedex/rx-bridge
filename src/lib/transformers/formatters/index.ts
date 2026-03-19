// Formatter registry. Maps format IDs to formatter implementations.
// To add a pharmacy-specific format, import it and add to the registry.

import type { PharmacyFormatter } from "./base";
import { standardFormatter } from "./standard";

const registry = new Map<string, PharmacyFormatter>();

function register(formatter: PharmacyFormatter) {
  registry.set(formatter.formatId, formatter);
}

register(standardFormatter);

export function getFormatter(formatId: string): PharmacyFormatter {
  return registry.get(formatId) || standardFormatter;
}

export function getAvailableFormats(): { id: string; label: string }[] {
  return Array.from(registry.values()).map((f) => ({
    id: f.formatId,
    label: f.label,
  }));
}

export { registry as formatterRegistry };
