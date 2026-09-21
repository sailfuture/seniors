/**
 * Short-lived, in-memory GET cache for the Xano tables that change on human
 * timescales: sections, templates, custom groups, question types, and the
 * student roster. The sidebar, the page, and the status cards all read these
 * same whole tables, and Xano slows down sharply under concurrent load, so
 * this collapses them into one request per table per TTL and lets components
 * that mount together share a single in-flight request.
 *
 * Every caller gets its own freshly parsed copy, so sorting or mutating the
 * result never leaks into other readers. Don't route per-student data the
 * user edits (responses, comments, locks) through here — that must stay live.
 */

const TTL_MS = 60_000

interface CachedBody {
  ok: boolean
  status: number
  text: string
}

/** The slice of `Response` the call sites use. */
export interface CachedResponse {
  ok: boolean
  status: number
  json: Response["json"]
}

const cache = new Map<string, { at: number; body: Promise<CachedBody> }>()

export function cachedFetch(url: string): Promise<CachedResponse> {
  let entry = cache.get(url)
  if (!entry || Date.now() - entry.at > TTL_MS) {
    const body = fetch(url).then(async (res) => ({
      ok: res.ok,
      status: res.status,
      text: await res.text(),
    }))
    const created = { at: Date.now(), body }
    cache.set(url, created)
    // Never pin a failure: the next reader retries.
    const evict = () => {
      if (cache.get(url) === created) cache.delete(url)
    }
    body.then((b) => {
      if (!b.ok) evict()
    }, evict)
    entry = created
  }
  return entry.body.then((b) => ({
    ok: b.ok,
    status: b.status,
    json: async () => JSON.parse(b.text),
  }))
}

/** Drop one cached URL, or every cached table when none is given, so the next
    read refetches — after template edits, or when the user asks to refresh. */
export function invalidateCachedFetch(url?: string): void {
  if (url) cache.delete(url)
  else cache.clear()
}
