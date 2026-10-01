import { parseSources } from "@/lib/sources"
/**
 * "March 4, 2026". A bare YYYY-MM-DD is a calendar day, so it's read in local
 * time: parsed as UTC midnight it showed a day early everywhere west of UTC.
 */
export function formatDate(value: string): string {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

/** The amount in a currency answer ("$12,500", "12500.5"), or null. */
export function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, "")
  if (!cleaned) return null
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

/** "$12,500", or "$12,500.50" when there are cents. */
export function formatAmount(n: number, cents = !Number.isInteger(n)): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(n)
}

export function hrefOf(raw: string): string {
  const url = raw.trim()
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

/**
 * Compact label for a URL: host and path, without the query string and hash
 * that tracking links drag along. The full URL stays in the href.
 */
export function prettyUrl(raw: string): string {
  try {
    const u = new URL(hrefOf(raw))
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "")
    return u.hostname.replace(/^www\./, "") + path
  } catch {
    return raw
  }
}

export interface SourceFields {
  source_link?: string
  title_of_source?: string
  author_name_or_publisher?: string
  date_of_publication?: string
}

export function hasSource(r: SourceFields | undefined): boolean {
  return !!(r && (r.source_link?.trim() || r.title_of_source?.trim() || r.author_name_or_publisher?.trim()))
}

/** Every citation an approved Source answer holds (its list, or its legacy columns). */
export function sourcesOf(r: Parameters<typeof parseSources>[0]): SourceFields[] {
  return parseSources(r)
}

/**
 * A source as an MLA-style citation: Author. "Title." Date, link. The text
 * before the link comes back separately so the link can be an anchor, and the
 * citation always ends in one period, with or without a link or a date.
 */
export function citation(r: SourceFields): { lead: string; link: string } {
  const author = r.author_name_or_publisher?.trim()
  const title = r.title_of_source?.trim()
  const date = r.date_of_publication?.trim()
  const link = r.source_link?.trim() ?? ""
  const parts: string[] = []
  if (author) parts.push(/[.!?]$/.test(author) ? author : `${author}.`)
  if (title) parts.push(`“${title.replace(/[.]$/, "")}.”`)
  let lead = parts.join(" ")
  if (date) lead += `${lead ? " " : ""}${formatDate(date)}${link ? "," : "."}`
  else if (!link && !lead.endsWith(".") && !lead.endsWith(".”")) lead += "."
  return { lead, link }
}

/** Whether two titles say the same thing ("Executive Summary" vs "executive summary:"). */
export function sameTitle(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "")
  return norm(a) === norm(b)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}
