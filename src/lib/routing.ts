// Pharmacy routing engine — deterministic, rules-based recommendation.
// Finds the lowest-cost eligible pharmacy for a given medication + patient state.
// All scoring tuned by RoutingPolicy config — no hardcoded values.

import type { RoutingPolicy } from "./routing-config";

export interface PharmacyCandidate {
  pharmacyId: string;
  pharmacyName: string;
  medicationId: string | null;
  price: number;
  effectiveDate: Date;
  verifiedAt: Date | null;
  serviceStates: string[];
  isBrandDefault: boolean;
  brandRoutingPriority: number;
}

export type RoutingStatus = "recommended" | "needs_review" | "no_eligible_pharmacy";

export interface RoutingResult {
  status: RoutingStatus;
  recommended: ScoredPharmacy | null;
  alternatives: ScoredPharmacy[];
  ineligible: IneligiblePharmacy[];
  reason: string;
  computedAt: string;
}

export interface ScoredPharmacy {
  pharmacyId: string;
  pharmacyName: string;
  price: number;
  score: number;
  freshness: Freshness;
  isBrandDefault: boolean;
  flags: string[];
}

export interface IneligiblePharmacy {
  pharmacyId: string;
  pharmacyName: string;
  price: number;
  reason: string;
}

export type Freshness = "fresh" | "aging" | "stale" | "unverified";

function getFreshness(verifiedAt: Date | null, policy: RoutingPolicy): Freshness {
  if (!verifiedAt) return "unverified";
  const days = (Date.now() - verifiedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= policy.freshDays) return "fresh";
  if (days <= policy.agingDays) return "aging";
  return "stale";
}

function isVeryStale(verifiedAt: Date | null, policy: RoutingPolicy): boolean {
  if (!verifiedAt) return true;
  const days = (Date.now() - verifiedAt.getTime()) / (1000 * 60 * 60 * 24);
  return days > policy.veryStaledays;
}

export function computePharmacyRouting(
  candidates: PharmacyCandidate[],
  patientState: string | null,
  policy: RoutingPolicy,
): RoutingResult {
  const now = new Date().toISOString();

  if (candidates.length === 0) {
    return {
      status: "no_eligible_pharmacy",
      recommended: null,
      alternatives: [],
      ineligible: [],
      reason: "No pharmacies have active pricing for this medication.",
      computedAt: now,
    };
  }

  // Partition by service area + eligibility rules
  const ineligible: IneligiblePharmacy[] = [];
  const serviceEligible: PharmacyCandidate[] = [];

  for (const c of candidates) {
    // Service area check
    if (patientState && c.serviceStates.length > 0 && !c.serviceStates.includes(patientState.toUpperCase())) {
      ineligible.push({
        pharmacyId: c.pharmacyId,
        pharmacyName: c.pharmacyName,
        price: c.price,
        reason: `Does not serve ${patientState.toUpperCase()}`,
      });
      continue;
    }

    // Unverified eligibility check
    if (!policy.allowUnverifiedPricing && !c.verifiedAt) {
      ineligible.push({
        pharmacyId: c.pharmacyId,
        pharmacyName: c.pharmacyName,
        price: c.price,
        reason: "Price never verified",
      });
      continue;
    }

    serviceEligible.push(c);
  }

  if (serviceEligible.length === 0) {
    return {
      status: "no_eligible_pharmacy",
      recommended: null,
      alternatives: [],
      ineligible,
      reason: patientState
        ? `No pharmacies serve ${patientState.toUpperCase()} with active pricing for this medication.`
        : "No eligible pharmacies found.",
      computedAt: now,
    };
  }

  const hasVerifiedCandidate = serviceEligible.some((c) => !isVeryStale(c.verifiedAt, policy));

  // Score each candidate using policy values
  const scored: ScoredPharmacy[] = serviceEligible.map((c) => {
    const freshness = getFreshness(c.verifiedAt, policy);
    const flags: string[] = [];
    let score = c.price;

    if (freshness === "aging") {
      score += policy.agingPenalty;
      flags.push("Price aging — verify soon");
    } else if (freshness === "stale") {
      score += policy.stalePenalty;
      flags.push("Price stale — needs verification");
    } else if (freshness === "unverified") {
      score += policy.unverifiedPenalty;
      flags.push("Price never verified — low confidence");
    }

    if (c.isBrandDefault) {
      score -= policy.brandDefaultBonus;
      flags.push("Brand preferred pharmacy");
    }

    return {
      pharmacyId: c.pharmacyId,
      pharmacyName: c.pharmacyName,
      price: c.price,
      score: Math.round(score * 100) / 100,
      freshness,
      isBrandDefault: c.isBrandDefault,
      flags,
    };
  });

  // Sort by score (lower is better)
  scored.sort((a, b) => a.score - b.score);

  // Apply maxPriceDelta guardrail — filter alternatives that are too far from best
  const best = scored[0];
  let validScored = scored;
  if (policy.maxPriceDelta !== null) {
    validScored = scored.filter((s) => s.price - best.price <= policy.maxPriceDelta!);
    // Always keep best even if it's the only one
    if (validScored.length === 0) validScored = [best];
  }

  const alternatives = validScored.slice(1);

  // Determine status
  const bestIsLowConfidence = best.freshness === "stale" || best.freshness === "unverified";
  const status: RoutingStatus = !hasVerifiedCandidate || bestIsLowConfidence ? "needs_review" : "recommended";

  // Build human-readable reason
  const reasons: string[] = [];
  reasons.push(`Lowest effective price at $${best.price.toFixed(2)}`);
  if (patientState) reasons.push(`serves ${patientState.toUpperCase()}`);
  if (best.isBrandDefault) reasons.push("brand preferred");
  if (best.freshness === "fresh") reasons.push("price recently verified");
  else if (best.freshness === "aging") reasons.push("price aging — verify soon");
  else if (best.freshness === "stale") reasons.push("price stale — verify before sending");
  else if (best.freshness === "unverified") reasons.push("price never verified — verify before sending");

  return {
    status,
    recommended: best,
    alternatives,
    ineligible,
    reason: reasons.join(" · "),
    computedAt: now,
  };
}
