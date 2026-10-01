/**
 * A Source question holds a list of citations. They're stored as JSON in
 * `student_response` ({"sources": [...]}), the same way line items are, so
 * they travel through every endpoint that carries a response. Rows written
 * before lists existed kept one citation in four columns on the response;
 * those still read as a one-item list, and the first citation of a list is
 * mirrored back into those columns when saving.
 */

export const SOURCE_TYPE_ID = 12
export const MAX_SOURCES = 10

/** One citation. The field names are the legacy response columns. */
export interface SourceEntry {
  source_link: string
  title_of_source: string
  author_name_or_publisher: string
  date_of_publication: string
}

export const SOURCE_FIELDS: (keyof SourceEntry)[] = [
  "source_link",
  "title_of_source",
  "author_name_or_publisher",
  "date_of_publication",
]

export function emptySource(): SourceEntry {
  return { source_link: "", title_of_source: "", author_name_or_publisher: "", date_of_publication: "" }
}

/** A citation counts once it names something: a link, a title, or an author. */
export function hasSourceEntry(e: Partial<SourceEntry> | null | undefined): boolean {
  return !!(e && (e.source_link?.trim() || e.title_of_source?.trim() || e.author_name_or_publisher?.trim()))
}

interface SourceLike {
  student_response?: string | null
  source_link?: string | null
  title_of_source?: string | null
  author_name_or_publisher?: string | null
  date_of_publication?: string | null
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v))

function entryOf(raw: unknown): SourceEntry {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  return {
    source_link: str(o.source_link).trim(),
    title_of_source: str(o.title_of_source).trim(),
    author_name_or_publisher: str(o.author_name_or_publisher).trim(),
    date_of_publication: str(o.date_of_publication).trim(),
  }
}

export function looksLikeSourcesDoc(raw: string | null | undefined): boolean {
  return !!raw && /^\s*\{\s*"sources"\s*:/.test(raw)
}

/** The citations a response holds, from its list or its legacy columns. */
export function parseSources(r: SourceLike | null | undefined): SourceEntry[] {
  if (!r) return []
  const raw = r.student_response ?? ""
  if (looksLikeSourcesDoc(raw)) {
    try {
      const parsed = JSON.parse(raw) as { sources?: unknown }
      if (Array.isArray(parsed.sources)) {
        return parsed.sources.map(entryOf).filter(hasSourceEntry).slice(0, MAX_SOURCES)
      }
    } catch {
      // fall through to the columns
    }
  }
  const legacy = entryOf(r)
  return hasSourceEntry(legacy) ? [legacy] : []
}

/** The stored form of a list; "" when nothing in it is a citation yet. */
export function serializeSources(entries: SourceEntry[]): string {
  const kept = entries.map(entryOf).filter(hasSourceEntry).slice(0, MAX_SOURCES)
  return kept.length > 0 ? JSON.stringify({ sources: kept }) : ""
}

/** One line naming each citation, for previews and activity streams. */
export function sourceSummary(entries: SourceEntry[]): string {
  return entries
    .map((e) => e.title_of_source || e.author_name_or_publisher || e.source_link)
    .filter(Boolean)
    .join("; ")
}
