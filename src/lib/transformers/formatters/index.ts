import type { PharmacyFormatter } from "./base";
import { standardFormatter } from "./standard";
import { lifefileFormatter } from "./lifefile";

const registry = new Map<string, PharmacyFormatter>();

function register(formatter: PharmacyFormatter) {
  registry.set(formatter.formatId, formatter);
}

register(standardFormatter);
register(lifefileFormatter);

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
