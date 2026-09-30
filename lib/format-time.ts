/** Milliseconds from a stored timestamp (Xano sends ms numbers or ISO strings). */
export function toMillis(ts: string | number | null | undefined): number | null {
  if (ts == null || ts === "") return null
  const ms = typeof ts === "number" ? ts : Date.parse(ts)
  return Number.isFinite(ms) ? ms : null
}

/** "just now", "5m ago", "3h ago", "2d ago", "3w ago", "4mo ago", "2y ago". */
export function relativeTime(ms: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - ms) / 1000))
  if (seconds < 45) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30.44)}mo ago`
  return `${Math.floor(days / 365.25)}y ago`
}

/** "Sep 28, 3:15 PM" — with the year when it isn't this year. */
export function dateTime(ms: number): string {
  const date = new Date(ms)
  const thisYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(thisYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * When something was submitted or last edited, relative and exact:
 * "3d ago · Sep 28, 3:15 PM". Null when there's no usable timestamp.
 */
export function formatWhen(ts: string | number | null | undefined): string | null {
  const ms = toMillis(ts)
  return ms == null ? null : `${relativeTime(ms)} · ${dateTime(ms)}`
}
