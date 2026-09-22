/**
 * Fetch helpers for Xano reads.
 *
 * Xano handles only a few requests at a time, so a page that fires a dozen
 * calls at once waits in a queue even though each query takes milliseconds.
 * Call sites keep fetching the same per-table URLs they always have; these
 * helpers answer them from one combined call per product:
 *
 * - `cachedFetch`: the setup tables (sections, questions, groups, question
 *   types) come from `<product>_config`, read through Vercel's cached copy
 *   (`/api/config/<product>`) and kept in memory for a minute, shared by
 *   every component that asks, including requests still in flight. Any other
 *   URL is cached on its own.
 * - `studentFetch`: one student's responses, comments, and lock status come
 *   from `<product>_student_state`. That data is live, so calls made together
 *   (a page and the sidebar mounting at once) share one request, but a
 *   finished result is never reused. Any other URL passes straight through.
 *
 * Every caller gets its own freshly parsed copy, so mutating a result never
 * leaks into other readers.
 */
import { BUSINESSTHESIS_API_CONFIG, LIFEMAP_API_CONFIG } from "@/lib/form-api-config"

const TTL_MS = 60_000
/** Student-state requests started this close together share one call. */
const SHARE_MS = 1_000

interface Body {
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

const LM = LIFEMAP_API_CONFIG
const BT = BUSINESSTHESIS_API_CONFIG

type Product = "lifemap" | "businessthesis"

/** Setup-table endpoint name → [product, key in its combined response]. */
const CONFIG_PARTS: Record<string, [Product, string]> = {
  lifemap_sections: ["lifemap", "sections"],
  lifeplan_template: ["lifemap", "template"],
  lifemap_custom_group: ["lifemap", "groups"],
  question_types: ["lifemap", "question_types"],
  businessthesis_sections: ["businessthesis", "sections"],
  businessthesis_template: ["businessthesis", "template"],
  businessthesis_custom_group: ["businessthesis", "groups"],
}

/** Each product's combined setup data: Vercel's cached copy, and Xano itself
    as the fallback. */
const CONFIG_SOURCES: Record<Product, { cached: string; origin: string }> = {
  lifemap: { cached: "/api/config/lifemap", origin: LM.configEndpoint },
  businessthesis: { cached: "/api/config/businessthesis", origin: BT.configEndpoint },
}

/** Per-student endpoint name → [combined endpoint, key in its response]. */
const STATE_PARTS: Record<string, [string, string]> = {
  lifemap_responses_by_student: [LM.studentStateEndpoint, "responses"],
  lifemap_comments: [LM.studentStateEndpoint, "comments"],
  lifemap_lock_status: [LM.studentStateEndpoint, "locks"],
  businessthesis_responses_by_student: [BT.studentStateEndpoint, "responses"],
  businessthesis_comments: [BT.studentStateEndpoint, "comments"],
  businessthesis_lock_status: [BT.studentStateEndpoint, "locks"],
}

interface ConfigRoute {
  product: Product
  key: string
}

interface StateRoute {
  bundleUrl: string
  key: string
}

/** `https://…/api:<group>/<name>?…` → name and query; null for other URLs. */
function parse(url: string): { name: string; params: URLSearchParams } | null {
  try {
    const u = new URL(url)
    const m = u.pathname.match(/^\/api:[^/]+\/([^/]+)$/)
    return m ? { name: m[1], params: u.searchParams } : null
  } catch {
    return null
  }
}

function configRoute(url: string): ConfigRoute | null {
  const p = parse(url)
  const part = p && p.params.toString() === "" ? CONFIG_PARTS[p.name] : undefined
  return part ? { product: part[0], key: part[1] } : null
}

function stateRoute(url: string): StateRoute | null {
  const p = parse(url)
  const part = p ? STATE_PARTS[p.name] : undefined
  const studentId = p?.params.get("students_id")
  if (!part || !studentId) return null
  // Other params (e.g. a section id) were never applied by Xano; callers
  // already filter the student's rows themselves.
  return { bundleUrl: `${part[0]}?students_id=${encodeURIComponent(studentId)}`, key: part[1] }
}

const readBody = async (res: Response): Promise<Body> => ({
  ok: res.ok,
  status: res.status,
  text: await res.text(),
})

function whole(b: Body): CachedResponse {
  return { ok: b.ok, status: b.status, json: async () => JSON.parse(b.text) }
}

/** One key of a combined response, shaped like the individual endpoint's. */
function part(b: Body, key: string): CachedResponse {
  if (!b.ok) return whole(b)
  return { ok: true, status: b.status, json: async () => JSON.parse(b.text)[key] }
}

const cache = new Map<string, { at: number; body: Promise<Body> }>()

function load(url: string): Promise<Body> {
  let entry = cache.get(url)
  if (!entry || Date.now() - entry.at > TTL_MS) {
    const body = fetch(url).then(readBody)
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
  return entry.body
}

/** Until this time, this tab reads setup data from Xano directly. Set after
    template edits or a refresh, so nobody sees the cached copy of something
    they just changed while Vercel's copy is rebuilt. */
let originUntil = 0

async function loadConfig(product: Product): Promise<Body> {
  const { cached, origin } = CONFIG_SOURCES[product]
  // The cached copy is a same-origin route, so only the browser can use it.
  if (typeof window !== "undefined" && Date.now() >= originUntil) {
    const b = await load(cached).catch(() => null)
    if (b?.ok) return b
  }
  return load(origin)
}

export function cachedFetch(url: string): Promise<CachedResponse> {
  const route = configRoute(url)
  if (!route) return load(url).then(whole)
  // If the combined endpoint ever goes missing, read the table itself.
  return loadConfig(route.product).then((b) =>
    b.status === 404 ? load(url).then(whole) : part(b, route.key)
  )
}

const inflight = new Map<string, { at: number; body: Promise<Body> }>()

export function studentFetch(url: string): Promise<CachedResponse> {
  const route = stateRoute(url)
  if (!route) return fetch(url).then(readBody).then(whole)
  let entry = inflight.get(route.bundleUrl)
  if (!entry || Date.now() - entry.at > SHARE_MS) {
    const body = fetch(route.bundleUrl).then(readBody)
    const created = { at: Date.now(), body }
    inflight.set(route.bundleUrl, created)
    const settle = () => {
      if (inflight.get(route.bundleUrl) === created) inflight.delete(route.bundleUrl)
    }
    body.then(settle, settle)
    entry = created
  }
  return entry.body.then((b) =>
    b.status === 404 ? fetch(url).then(readBody).then(whole) : part(b, route.key)
  )
}

/** Drop one cached URL, or every cached table when none is given, so the next
    read refetches — after template edits, or when the user asks to refresh. */
export function invalidateCachedFetch(url?: string): void {
  originUntil = Date.now() + TTL_MS
  if (!url) {
    cache.clear()
    return
  }
  cache.delete(url)
  const route = configRoute(url)
  if (route) {
    cache.delete(CONFIG_SOURCES[route.product].cached)
    cache.delete(CONFIG_SOURCES[route.product].origin)
  }
}

let revalidateTimer: ReturnType<typeof setTimeout> | undefined

/** After a template edit: this tab reads fresh setup data right away, and
    Vercel's cached copy is rebuilt for everyone else — once per burst of
    edits. */
export function refreshSetupData(): void {
  invalidateCachedFetch()
  clearTimeout(revalidateTimer)
  revalidateTimer = setTimeout(() => {
    fetch("/api/config/revalidate", { method: "POST" }).catch(() => {})
  }, 1_000)
}

/** `fetch` for the template editors: every successful write refreshes the
    shared setup data. Reads pass straight through. */
export async function editorFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (res.ok && (init?.method ?? "GET").toUpperCase() !== "GET") refreshSetupData()
  return res
}
