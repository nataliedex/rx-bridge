// Routing policy configuration — tunable parameters for pharmacy auto-selection.
// Stored in the database as a single JSON record. Falls back to defaults if not set.

import { prisma } from "./db";

export interface RoutingPolicy {
  // Scoring penalties (added to base price — lower score = better)
  agingPenalty: number;       // penalty for prices verified 30–60 days ago
  stalePenalty: number;       // penalty for prices verified >60 days ago
  unverifiedPenalty: number;  // penalty for prices never verified

  // Bonuses (subtracted from score)
  brandDefaultBonus: number;  // bonus for brand-preferred pharmacy

  // Freshness thresholds (days)
  freshDays: number;          // price is "fresh" if verified within this many days
  agingDays: number;          // price is "aging" between freshDays and agingDays
  veryStaledays: number;      // price is very stale / low confidence beyond this

  // Eligibility rules
  allowUnverifiedPricing: boolean; // if false, never-verified prices are excluded entirely

  // Guardrails
  maxPriceDelta: number | null;    // max acceptable $ above lowest price (null = no cap)
}

export const DEFAULT_ROUTING_POLICY: RoutingPolicy = {
  agingPenalty: 5.00,
  stalePenalty: 15.00,
  unverifiedPenalty: 22.50,
  brandDefaultBonus: 1.50,
  freshDays: 30,
  agingDays: 60,
  veryStaledays: 120,
  allowUnverifiedPricing: true,
  maxPriceDelta: null,
};

// In-memory cache with 60s TTL to avoid DB reads on every routing call
let cached: { policy: RoutingPolicy; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getRoutingPolicy(): Promise<RoutingPolicy> {
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.policy;
  }

  const record = await prisma.systemConfig.findUnique({
    where: { key: "routing_policy" },
  }).catch(() => null); // table might not exist yet

  let policy: RoutingPolicy;
  if (record?.value) {
    try {
      const parsed = JSON.parse(record.value);
      policy = { ...DEFAULT_ROUTING_POLICY, ...parsed };
    } catch {
      policy = { ...DEFAULT_ROUTING_POLICY };
    }
  } else {
    policy = { ...DEFAULT_ROUTING_POLICY };
  }

  cached = { policy, loadedAt: Date.now() };
  return policy;
}

export async function updateRoutingPolicy(updates: Partial<RoutingPolicy>): Promise<RoutingPolicy> {
  const current = await getRoutingPolicy();
  const merged = { ...current, ...updates };

  await prisma.systemConfig.upsert({
    where: { key: "routing_policy" },
    update: { value: JSON.stringify(merged) },
    create: { key: "routing_policy", value: JSON.stringify(merged) },
  });

  // Bust cache
  cached = { policy: merged, loadedAt: Date.now() };
  return merged;
}

export function invalidateRoutingPolicyCache() {
  cached = null;
}
