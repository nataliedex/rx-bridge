// Formats a date into a relative time string like "2h ago", "3d ago"
export function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// Returns an urgency tier based on how old something is.
// recent: < 4 hours, moderate: 4h–24h, stale: > 24h
export type UrgencyTier = "recent" | "moderate" | "stale";

export function getUrgencyTier(date: Date | string): UrgencyTier {
  const now = Date.now();
  const then = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const hours = (now - then) / (1000 * 60 * 60);

  if (hours < 4) return "recent";
  if (hours < 24) return "moderate";
  return "stale";
}
