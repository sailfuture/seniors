"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft02Icon, PrinterIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import {
  BrandThemeProvider,
  deriveBrandTheme,
  parseBrandColor,
  parseExactHex,
  extractFontFamily,
  useGoogleFont,
  type BrandTheme,
} from "@/components/brand-display"
import {
  GroupDisplayRenderer,
  DISPLAY_TYPE,
  getCompetitorMapData,
  CompetitorMapPlot,
  buildGallerySlides,
} from "@/components/group-display-types"
import { LineItemsTable, ProductLineItemsTable } from "@/components/line-items-table"
import { isLineItemsQuestion, parseLineItemProducts, LINE_ITEMS_TYPE_ID } from "@/lib/line-items"
import { RichTextDisplay } from "@/components/form/rich-text-display"
import { RICH_TEXT_TYPE_ID, extractPlainText, looksLikeRichTextDoc, parseRichText } from "@/lib/rich-text"
import type { FormApiConfig } from "@/lib/form-api-config"
import { aspectRatioCss } from "@/lib/image-ratio"
import { formatYearGroup } from "@/lib/year-group"
import { fetchProjectLock } from "@/lib/project-lock"

const STUDENTS_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/get_active_students_email"

interface TemplateQuestion {
  id: number
  field_label: string
  field_name: string
  isArchived: boolean
  isPublished: boolean
  sortOrder: number
  question_types_id?: number | null
  public_display_title?: string
  public_display_description?: string
  image_aspect_ratio?: string | null
  _question_types?: { id: number; type: string; noInput?: boolean }
  [key: string]: unknown
}

interface StudentResponse {
  id: number
  student_response: string
  date_response?: string | null
  image_response: { path?: string; url?: string } | null
  students_id: string
  isArchived?: boolean
  isComplete?: boolean
  source_link?: string
  title_of_source?: string
  author_name_or_publisher?: string
  date_of_publication?: string
  last_edited?: number | string | null
  created_at?: number
  [key: string]: unknown
}

interface SectionInfo {
  id: number
  section_title: string
  description?: string
  section_description?: string
  isLocked?: boolean
  order?: number
}

interface CustomGroup {
  id: number
  group_name: string
  group_description: string
  order?: number
  icon_name?: string | null
  [key: string]: unknown
}

const QUESTION_TYPE = {
  LONG_RESPONSE: 1,
  SHORT_RESPONSE: 2,
  CURRENCY: 3,
  IMAGE_UPLOAD: 4,
  DROPDOWN: 5,
  URL: 6,
  DATE: 7,
  SOURCE: 12,
} as const

function typeIdOf(q: TemplateQuestion): number | null {
  return q.question_types_id ?? q._question_types?.id ?? null
}

function isShortType(typeId: number | null): boolean {
  return (
    typeId === QUESTION_TYPE.SHORT_RESPONSE ||
    typeId === QUESTION_TYPE.CURRENCY ||
    typeId === QUESTION_TYPE.DROPDOWN ||
    typeId === QUESTION_TYPE.URL ||
    typeId === QUESTION_TYPE.DATE
  )
}

function resolveImageUrl(path: string | undefined): string {
  if (!path) return ""
  if (path.startsWith("http")) return path
  return `https://xsc3-mvx7-r86m.n7e.xano.io${path}`
}

function formatCurrency(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num)
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  } catch {
    return value
  }
}

/** Raw grid rows, including the sheet's own header row and single blank
    separator rows (used to split multi-table tabs). */
interface SheetTable {
  rows: string[][]
}

interface SheetTab {
  name: string
  table: SheetTable
}

const isBlankRow = (r: string[]) => r.every((v) => v === "")

// Budget-table row shades, kept in the document's own gray palette: light
// gray section bands, near-black header/totals rows.
const SHEET_BAND_BG = "#F3F4F6" // gray-100
const SHEET_DEEP_BG = "#1F2937" // gray-800

// Tabs that hold several independent tables (service list, weekly calendar,
// earnings report, weekly totals) — each prints as its own header-led table.
const SHEET_TAB_SPLIT = new Set(["weekly budget"])

// ── Life Map resume (Google Doc) ─────────────────────────────────────────
// The "resume" URL question links a Google Doc; its HTML export renders as
// the document's opening pages. Synthetic section id for the pagination run.
const RESUME_SECTION_ID = -100
const RESUME_FIELD = "resume"

/** Preferred: page images rendered from the doc's PDF export (faithful
    snapshot of the real layout). Fallback: sanitized HTML flow. */
type ResumeDoc =
  | { kind: "pages"; pages: string[] }
  | { kind: "flow"; css: string; blocks: string[] }

/** Parse a Google-Doc HTML export into print blocks: styles scoped under
    .gdoc-resume (the export uses bare element selectors that would leak),
    markup sanitized, and content chunked at headings so the paginator can
    flow the resume across pages. */
function parseGoogleDocHtml(html: string): ResumeDoc | null {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html")
    if (!doc.body) return null
    const rawCss = [...doc.querySelectorAll("style")].map((s) => s.textContent ?? "").join("\n")
    const scopedCss = rawCss
      .replace(/@import[^;]+;/g, "")
      .split("}")
      .map((rule) => {
        const [sel, body] = rule.split("{")
        if (!sel || !body || sel.trim().startsWith("@")) return ""
        const scoped = sel
          .split(",")
          .map((s) => `.gdoc-resume ${s.trim()}`)
          .join(", ")
        return `${scoped}{${body}}`
      })
      .filter(Boolean)
      .join("\n")
    const css = `${scopedCss}\n.gdoc-resume{font-family:Arial,sans-serif;}\n.gdoc-resume img{max-width:100%;height:auto;}`

    // Sanitize the whole body once: no scripts, handlers, or javascript: urls.
    doc.body.querySelectorAll("script,style,iframe,object,embed").forEach((n) => n.remove())
    for (const n of doc.body.querySelectorAll("*")) {
      for (const attr of [...n.attributes]) {
        if (/^on/i.test(attr.name)) n.removeAttribute(attr.name)
        if ((attr.name === "href" || attr.name === "src") && /^\s*javascript:/i.test(attr.value)) {
          n.removeAttribute(attr.name)
        }
      }
    }
    // Docs lay multi-column resumes out as a big table — one unsplittable
    // block that can't paginate. Explode wrappers and narrow layout tables
    // into their cells' contents (reading order) so everything flows; real
    // data tables (3+ columns) stay whole.
    const explode = (el: HTMLElement): HTMLElement[] => {
      if (el.tagName === "DIV") {
        return (Array.from(el.children) as HTMLElement[]).flatMap(explode)
      }
      if (el.tagName === "TABLE") {
        const rows = Array.from(el.querySelectorAll(":scope > tbody > tr, :scope > tr"))
        const isLayout = rows.length <= 3 && rows.every((r) => r.children.length <= 2)
        if (isLayout) {
          return rows.flatMap((r) =>
            (Array.from(r.children) as HTMLElement[]).flatMap((cell) =>
              (Array.from(cell.children) as HTMLElement[]).flatMap(explode)
            )
          )
        }
      }
      return [el]
    }
    const children = (Array.from(doc.body.children) as HTMLElement[])
      .flatMap(explode)
      .filter((el) => (el.textContent ?? "").trim() !== "" || el.querySelector("img,hr"))
    // Chunk at headings (resume sections) with a size cap, so the 24px
    // block gap lands at natural boundaries instead of between lines.
    const blocks: string[] = []
    let cur: string[] = []
    const flush = () => {
      if (cur.length > 0) {
        blocks.push(cur.join(""))
        cur = []
      }
    }
    for (const el of children) {
      if (/^H[12]$/.test(el.tagName) || cur.length >= 12) flush()
      cur.push(el.outerHTML)
    }
    flush()
    return blocks.length > 0 ? { kind: "flow", css, blocks } : null
  } catch {
    return null
  }
}

/** Render the doc's PDF export to one PNG per page (~192dpi) — a faithful
    snapshot of the resume exactly as the student designed it. */
async function snapshotGoogleDocPdf(docId: string): Promise<ResumeDoc | null> {
  const res = await fetch(`https://docs.google.com/document/d/${docId}/export?format=pdf`)
  if (!res.ok) return null
  const data = await res.arrayBuffer()
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString()
  const pdf = await pdfjs.getDocument({ data }).promise
  const pages: string[] = []
  const count = Math.min(pdf.numPages, 8)
  for (let p = 1; p <= count; p++) {
    const page = await pdf.getPage(p)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(3, 1632 / base.width) })
    const canvas = document.createElement("canvas")
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    // intent "print": print-quality op list, and no requestAnimationFrame
    // pacing (which never fires in occluded/background tabs).
    await page.render({ canvasContext: ctx, viewport, canvas, intent: "print" }).promise
    pages.push(canvas.toDataURL("image/png"))
  }
  return pages.length > 0 ? { kind: "pages", pages } : null
}

// ── Life Map post-graduation budget ──────────────────────────────────────
// The template lays two streams side by side (expenses in A/B, income &
// saving in C/D), stacked in sections that each end with a subtotal. It
// prints as independent per-section tables plus one bottom summary.
const LM_BUDGET_TAB_RE = /monthly budget plan/i
const LM_SECTION_RE =
  /^(housing|transportation|health & insurance|debt & loans|food & dining|entertainment|personal care( & lifestyle)?|income|saving & investing)$/i
const LM_SKIP_RE = /^(expenses|essential expenses|discretionary expenses|income & saving|why)$/i
const LM_ORDER = [
  "housing",
  "transportation",
  "health & insurance",
  "debt & loans",
  "income",
  "saving & investing",
  "food & dining",
  "entertainment",
  "personal care",
]

function splitLmBudget(rows: string[][]): { title: string; rows: string[][] }[] {
  const blocks: { title: string; rows: string[][] }[] = []
  const totals: string[][] = []
  for (const [li, vi] of [
    [0, 1],
    [2, 3],
  ] as const) {
    let cur: { title: string; rows: string[][] } | null = null
    for (const r of rows) {
      const label = (r[li] ?? "").trim()
      const value = (r[vi] ?? "").trim()
      if (!label && !value) continue
      if (/^(total monthly (expenses|income)|net surplus)/i.test(label)) {
        if (label && value) totals.push([label, value])
        cur = null
        continue
      }
      if (LM_SKIP_RE.test(label) || label.startsWith("(") || /^positive =/i.test(label)) continue
      if (LM_SECTION_RE.test(label)) {
        cur = { title: label, rows: [] }
        blocks.push(cur)
        continue
      }
      if (cur && label) cur.rows.push([label, value])
    }
  }
  const rank = (t: string) => {
    const i = LM_ORDER.findIndex((k) => t.toLowerCase().startsWith(k))
    return i < 0 ? LM_ORDER.length : i
  }
  const ordered = blocks.filter((b) => b.rows.length > 0).sort((a, b) => rank(a.title) - rank(b.title))
  if (totals.length > 0) {
    // Expenses, then income, then the net — regardless of stream order.
    const totalRank = (l: string) => (/expenses/i.test(l) ? 0 : /income/i.test(l) ? 1 : 2)
    totals.sort((a, b) => totalRank(a[0]) - totalRank(b[0]))
    ordered.push({ title: "Monthly Summary", rows: totals })
  }
  return ordered
}

// Template header rows that begin a new sub-table inside a split tab.
const SHEET_SUBTABLE_STARTS = [/^time$/i, /^days of week$/i, /^weekly$/i]

function splitTabRows(rows: string[][]): string[][][] {
  const blocks: string[][][] = []
  let cur: string[][] = []
  for (const r of rows) {
    if (isBlankRow(r)) {
      if (cur.length > 0) blocks.push(cur)
      cur = []
      continue
    }
    const a = (r[0] ?? "").trim()
    if (cur.length > 0 && SHEET_SUBTABLE_STARTS.some((re) => re.test(a))) {
      blocks.push(cur)
      cur = []
    }
    cur.push(r)
  }
  if (cur.length > 0) blocks.push(cur)
  return blocks
}

/** Explicit column picks per budget-sheet tab (sheet letters, A = first).
    Tabs not listed keep every column that survives the generic link/empty
    cleanup. Keys are compared case-insensitively. */
const SHEET_TAB_COLUMNS: Record<string, string[]> = {
  "start up costs": ["A", "B", "C"],
  "monthly business expenses": ["A", "B", "C"],
  "service income": ["A", "B", "C"],
  "weekly budget": ["A", "B", "C", "D", "E", "F"],
  "monthly/annual budget": ["A", "B"],
}

// Tabs that never print (tolerant of the template's "Forecaast" typo).
const SHEET_TAB_SKIP = /4[-\s]?year\s+forec/i

/** Tab list (name + gid) scraped from the sheet's public htmlview page. */
async function listSheetTabs(id: string): Promise<{ name: string; gid: string }[]> {
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/htmlview`)
    if (!res.ok) return []
    const html = await res.text()
    return [...html.matchAll(/items\.push\(\{name:\s*"((?:[^"\\]|\\.)*)",\s*pageUrl:\s*"[^"]*gid=(\d+)/g)].map(
      (m) => ({ name: m[1].replace(/\\(.)/g, "$1"), gid: m[2] })
    )
  } catch {
    return []
  }
}

/** Print-safe table: link-dominant columns (incl. literal "URL" headers)
    drop entirely, and any URL inside a remaining cell collapses to its bare
    hostname so no multi-line address ever reaches the page. Blank separator
    rows survive (they mark sub-table boundaries). */
function sanitizeSheetTable(t: SheetTable): SheetTable | null {
  const isUrl = (v: string) => /https?:\/\/\S+/i.test(v)
  const stripUrls = (v: string) =>
    v
      .replace(/https?:\/\/\S+/gi, (m) => {
        try {
          return new URL(m).hostname.replace(/^www\./, "")
        } catch {
          return ""
        }
      })
      // Custom negative-currency formats leak quotes: ("$"1,268.00) → ($1,268.00)
      .replace(/\(\s*"\$"\s*([\d.,]+)\s*\)/g, (_, n: string) => `($${n})`)
      .replace(/\s{2,}/g, " ")
      .trim()
  const width = Math.max(0, ...t.rows.map((r) => r.length))
  const keep: boolean[] = []
  for (let i = 0; i < width; i++) {
    const header = (t.rows[0]?.[i] ?? "").trim()
    const vals = t.rows.map((r) => r[i] ?? "").filter((v) => v !== "")
    keep.push(!/^url$/i.test(header) && !(vals.length > 0 && vals.filter(isUrl).length / vals.length >= 0.5))
  }
  let rows = t.rows.map((r) => r.filter((_, i) => keep[i]).map(stripUrls))
  while (rows.length > 0 && isBlankRow(rows[0])) rows.shift()
  while (rows.length > 0 && isBlankRow(rows[rows.length - 1])) rows.pop()
  rows = rows.filter((r, i, arr) => !(isBlankRow(r) && i > 0 && isBlankRow(arr[i - 1])))
  if (rows.length === 0 || rows.every(isBlankRow) || rows[0].length === 0) return null
  return { rows }
}

function sheetRefFromUrl(url: string): { id: string; gid: string } | null {
  const id = (url.match(/\/d\/([a-zA-Z0-9-_]+)/) || [])[1]
  if (!id) return null
  const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1] ?? "0"
  return { id, gid }
}

/** Parse Google's gviz JSONP payload into a plain table. Formatted cell
    values (currency, dates) win over raw ones; when the sheet has no column
    labels the first row serves as the header; empty columns/rows drop. */
function parseGvizTable(raw: string, pickIds?: string[]): SheetTable | null {
  const start = raw.indexOf("(")
  const end = raw.lastIndexOf(")")
  if (start < 0 || end <= start) return null
  try {
    const json = JSON.parse(raw.slice(start + 1, end)) as {
      table?: { cols?: { id?: string; label?: string }[]; rows?: { c: ({ v?: unknown; f?: string } | null)[] }[] }
    }
    const cell = (c: { v?: unknown; f?: string } | null) => String(c?.f ?? (c?.v == null ? "" : c.v)).trim()
    const cols = json.table?.cols ?? []
    // gviz column ids are the sheet letters — an explicit pick selects those.
    let idxs = cols.map((_, i) => i)
    if (pickIds && pickIds.length > 0) {
      const wanted = new Set(pickIds.map((s) => s.trim().toUpperCase()))
      const picked = idxs.filter((i) => wanted.has(String(cols[i].id ?? "").toUpperCase()))
      if (picked.length > 0) idxs = picked
    }
    const labels = idxs.map((i) => (cols[i].label ?? "").trim())
    let rows = (json.table?.rows ?? []).map((r) => idxs.map((i) => cell((r.c ?? [])[i] ?? null)))
    // gviz promotes the sheet's header row to column labels — restore it as
    // the first row so it prints (styled) like any other row.
    if (labels.some((l) => l !== "")) rows = [labels, ...rows]
    // Drop columns that are empty everywhere; keep blank rows (separators).
    const keptIdx = idxs.map((_, k) => k).filter((k) => rows.some((r) => (r[k] ?? "") !== ""))
    rows = rows.map((r) => keptIdx.map((k) => r[k] ?? ""))
    if (rows.length === 0 || keptIdx.length === 0) return null
    return { rows }
  } catch {
    return null
  }
}

/** Fewest columns whose grid still fits one page — fewer columns = bigger
    images, so a full-page image set fills its sheet instead of huddling in
    the top third. (7in content = 672px; ~760px usable under the heading.) */
function bestGridCols(count: number, ratioNum: number, caption: boolean): number {
  const GAP = 16
  for (let cols = 1; cols <= 4; cols++) {
    const rows = Math.ceil(count / cols)
    const cellW = (672 - GAP * (cols - 1)) / cols
    const cellH = cellW / ratioNum + (caption ? 38 : 0)
    if (rows * cellH + GAP * (rows - 1) <= 760) return cols
  }
  return 4
}

/** The question's configured crop as CSS aspect-ratio, and its width/height
    quotient (for sizing). Null when the crop is "free" — those uploads were
    already cropped to the student's chosen shape at upload time. */
function questionRatio(q: TemplateQuestion): { css: string; num: number } | null {
  const css = aspectRatioCss(q.image_aspect_ratio)
  if (!css) return null
  const m = css.match(/^([\d.]+) \/ ([\d.]+)$/)
  const num = m ? parseFloat(m[1]) / parseFloat(m[2]) : 4 / 3
  return { css, num }
}

// Backgrounds feed the screen page's hero/cover imagery, never document content.
function isDecorationQuestion(q: TemplateQuestion): boolean {
  return typeIdOf(q) === QUESTION_TYPE.IMAGE_UPLOAD && /(section|cover)\s*background/i.test(q.field_label)
}

/** Does this response carry printable, approved content? */
function hasContent(q: TemplateQuestion, r: StudentResponse | undefined): boolean {
  if (!r?.isComplete) return false
  const typeId = typeIdOf(q)
  if (typeId === QUESTION_TYPE.IMAGE_UPLOAD) {
    return !!(r.image_response?.path || r.image_response?.url)
  }
  if (typeId === QUESTION_TYPE.SOURCE) {
    return !!(r.source_link || r.title_of_source || r.author_name_or_publisher)
  }
  if (typeId === QUESTION_TYPE.DATE) {
    return !!(r.date_response || (r.student_response ?? "").trim())
  }
  return (r.student_response ?? "").trim().length > 0
}

function formatCitation(r: StudentResponse): string {
  const parts: string[] = []
  if (r.author_name_or_publisher) parts.push(r.author_name_or_publisher + ".")
  if (r.title_of_source) parts.push(`“${r.title_of_source}.”`)
  if (r.date_of_publication) parts.push(formatDate(r.date_of_publication) + ",")
  return parts.join(" ")
}

/** Full citation line with the link folded in and punctuation tidied, so a
    missing link never leaves a dangling “, .” in the printed sources. */
function citationLine(r: StudentResponse): string {
  let line = [formatCitation(r).trim(), (r.source_link ?? "").trim()].filter(Boolean).join(" ")
  line = line.replace(/,$/, "")
  if (!/[.!?”]$/.test(line)) line += "."
  return line
}

/** Questions worth printing in a generic grid: everything except SOURCE
    entries (those become citations); unanswered questions print as labeled
    placeholders. */
function printableGridQuestions(questions: TemplateQuestion[]): TemplateQuestion[] {
  return questions.filter((q) => typeIdOf(q) !== QUESTION_TYPE.SOURCE)
}

/**
 * Print-first rendering of a full Life Map / Business Thesis as a US-Letter
 * document: a typographic cover with a table of contents, then one page run
 * per section. On screen it previews as white 8.5in sheets; in print the
 * @page rule (globals.css) takes over and the browser paginates. Only
 * teacher-approved content appears, matching the public page.
 */
export function PrintDocument({
  studentId,
  apiConfig,
  product,
  backHref,
}: {
  studentId: string
  apiConfig: FormApiConfig
  product: "life-map" | "business-thesis"
  backHref: string
}) {
  const cfg = apiConfig
  const F = cfg.fields

  const [sections, setSections] = useState<SectionInfo[]>([])
  const [templates, setTemplates] = useState<TemplateQuestion[]>([])
  const [responses, setResponses] = useState<StudentResponse[]>([])
  const [groups, setGroups] = useState<CustomGroup[]>([])
  const [studentName, setStudentName] = useState("")
  const [studentImage, setStudentImage] = useState("")
  const [yearGroup, setYearGroup] = useState("")
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      // A locked project renders from its frozen snapshot, so template edits
      // never reach it. Only the student's identity row stays live.
      const lock = cfg.locksEndpoint ? await fetchProjectLock(cfg.locksEndpoint, studentId) : null
      if (lock) {
        const snap = lock.snapshot
        setSections(
          (snap.sections as SectionInfo[]).filter((s) => !s.isLocked).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        )
        setTemplates((snap.questions as TemplateQuestion[]).filter((q) => !q.isArchived && q.isPublished))
        setResponses(
          (snap.responses as StudentResponse[]).filter(
            (r) => !r.isArchived && String(r.students_id ?? "") === String(studentId)
          )
        )
        setGroups(snap.groups as CustomGroup[])
      }
      const [sectionsRes, templateRes, responsesRes, groupsRes, studentsRes] = await Promise.all([
        lock ? null : fetch(cfg.sectionsEndpoint),
        lock ? null : fetch(cfg.templateEndpoint),
        lock ? null : fetch(`${cfg.responsesEndpoint}?students_id=${studentId}`),
        lock ? null : fetch(cfg.customGroupEndpoint),
        fetch(STUDENTS_ENDPOINT),
      ])
      if (sectionsRes?.ok) {
        const data: SectionInfo[] = await sectionsRes.json()
        setSections(data.filter((s) => !s.isLocked).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      }
      if (templateRes?.ok) {
        const data: TemplateQuestion[] = await templateRes.json()
        setTemplates(data.filter((q) => !q.isArchived && q.isPublished))
      }
      if (responsesRes?.ok) {
        const data: StudentResponse[] = await responsesRes.json()
        // Belt-and-suspenders: re-filter by student even if the endpoint does.
        setResponses(data.filter((r) => !r.isArchived && String(r.students_id ?? "") === String(studentId)))
      }
      if (groupsRes?.ok) setGroups(await groupsRes.json())
      if (studentsRes?.ok) {
        const students: { id: string; firstName: string; lastName: string; yearGroup?: string; profileImage?: string }[] =
          await studentsRes.json()
        const match = students.find((s) => String(s.id) === String(studentId))
        if (match) {
          setStudentName(`${match.firstName} ${match.lastName}`)
          if (match.yearGroup) setYearGroup(match.yearGroup)
          if (match.profileImage) setStudentImage(match.profileImage)
        }
      }
    } catch {
      /* leave empty */
    } finally {
      setLoading(false)
    }
  }, [cfg, studentId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const responseMap = useMemo(() => {
    const map = new Map<number, StudentResponse>()
    for (const r of responses) map.set(Number(r[F.templateId]), r)
    return map
  }, [responses, F.templateId])

  // The linked Google-Sheet budget prints as real tables — one page per
  // sheet tab. Tab names come from the sheet's htmlview page, each tab's
  // data from the public gviz endpoint (link-viewable sheets allow both
  // cross-origin). Failures just leave the link card on its own.
  const [budgetTables, setBudgetTables] = useState<Map<number, SheetTab[]>>(new Map())
  useEffect(() => {
    const urlQs = templates.filter((q) => q.field_name === "google_sheet_url")
    if (urlQs.length === 0) return
    let cancelled = false
    ;(async () => {
      const entries: [number, SheetTab[]][] = []
      for (const q of urlQs) {
        const r = responseMap.get(q.id)
        const url = (r?.isComplete ? (r.student_response ?? "") : "").trim()
        const ref = url ? sheetRefFromUrl(url) : null
        if (!ref) continue
        const tabRefs = (await listSheetTabs(ref.id)).filter((t) => !SHEET_TAB_SKIP.test(t.name)).slice(0, 10)
        if (tabRefs.length === 0) tabRefs.push({ name: "", gid: ref.gid })
        const tabs: SheetTab[] = []
        for (const t of tabRefs) {
          try {
            const res = await fetch(
              `https://docs.google.com/spreadsheets/d/${ref.id}/gviz/tq?tqx=out:json&gid=${t.gid}`
            )
            if (!res.ok) continue
            const picks = SHEET_TAB_COLUMNS[t.name.trim().toLowerCase()]
            const parsed = parseGvizTable(await res.text(), picks)
            const table = parsed ? sanitizeSheetTable(parsed) : null
            if (table) tabs.push({ name: t.name, table })
          } catch {
            /* private or offline sheet — the link card still prints */
          }
        }
        if (tabs.length > 0) entries.push([q.id, tabs])
      }
      if (!cancelled && entries.length > 0) setBudgetTables(new Map(entries))
    })()
    return () => {
      cancelled = true
    }
  }, [templates, responseMap])

  const brand = useMemo(() => deriveBrandTheme(templates, responseMap), [templates, responseMap])
  useGoogleFont(brand.primaryFont)
  useGoogleFont(brand.secondaryFont)

  const lastEdited = useMemo(() => {
    let max = 0
    for (const r of responses) {
      const le = r.last_edited
      const t = Math.max(typeof le === "number" ? le : Date.parse(String(le ?? "")) || 0, Number(r.created_at) || 0)
      if (t > max) max = t
    }
    return max > 0 ? new Date(max) : null
  }, [responses])

  // The linked Google-Doc resume opens the Life Map document: fetch its
  // HTML export (link-viewable docs allow it cross-origin) and turn it into
  // print blocks. Private or non-Doc links just skip the page — the URL row
  // in its own section still prints.
  const [resumeDoc, setResumeDoc] = useState<ResumeDoc | null>(null)
  useEffect(() => {
    if (product !== "life-map") return
    const q = templates.find((t) => t.field_name === RESUME_FIELD)
    if (!q) return
    const r = responseMap.get(q.id)
    const url = (r?.isComplete ? (r.student_response ?? "") : "").trim()
    const docId = (url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/) || [])[1]
    if (!docId) return
    let cancelled = false
    ;(async () => {
      // Snapshot the PDF export first (true page images); fall back to the
      // sanitized HTML flow when the PDF can't be fetched or rendered.
      try {
        const snap = await snapshotGoogleDocPdf(docId)
        if (snap) {
          if (!cancelled) setResumeDoc(snap)
          return
        }
      } catch {
        /* fall through to the HTML flow */
      }
      try {
        const res = await fetch(`https://docs.google.com/document/d/${docId}/export?format=html`)
        if (!res.ok) return
        const parsed = parseGoogleDocHtml(await res.text())
        if (!cancelled && parsed) setResumeDoc(parsed)
      } catch {
        /* leave the resume out */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [product, templates, responseMap])

  // Per-section content model, dropping anything that would print blank.
  const printSections = useMemo(() => {
    return sections
      .map((section) => {
        const sectionQuestions = templates
          .filter((q) => Number(q[F.sectionId]) === section.id && !isDecorationQuestion(q))
          .sort((a, b) => a.sortOrder - b.sortOrder)
        const sectionGroups = groups
          .filter((g) => Number(g[F.sectionId]) === section.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

        const ungrouped = sectionQuestions.filter(
          (q) => !q[F.customGroupId] && typeIdOf(q) !== QUESTION_TYPE.SOURCE
        )
        const byGroup = new Map<number, TemplateQuestion[]>()
        for (const q of sectionQuestions) {
          const gid = Number(q[F.customGroupId]) || 0
          if (!gid) continue
          byGroup.set(gid, [...(byGroup.get(gid) ?? []), q])
        }

        // Every question prints — unanswered ones show a labeled placeholder
        // (gray box for images) so the document previews its final layout.
        const groupBlocks = sectionGroups
          .map((g) => {
            const qs = byGroup.get(g.id) ?? []
            return qs.length > 0 ? { group: g, questions: qs } : null
          })
          .filter((g): g is { group: CustomGroup; questions: TemplateQuestion[] } => !!g)

        return { section, ungrouped, groupBlocks }
      })
  }, [sections, templates, groups, F.sectionId, F.customGroupId])

  // The resume leads the document — first Contents entry, first pages.
  const printSectionsAll = useMemo(() => {
    if (!resumeDoc) return printSections
    return [
      {
        section: { id: RESUME_SECTION_ID, section_title: "Resume" } as SectionInfo,
        ungrouped: [] as TemplateQuestion[],
        groupBlocks: [] as { group: CustomGroup; questions: TemplateQuestion[] }[],
      },
      ...printSections,
    ]
  }, [printSections, resumeDoc])

  const isBusiness = product === "business-thesis"
  const docLabel = isBusiness ? "Senior Business Thesis" : "Personal Life Map"
  const title = isBusiness ? brand.companyName || "Business Thesis" : studentName || "Life Map"
  const titleFont = brand.primaryFont ? { fontFamily: `"${brand.primaryFont}", inherit` } : undefined
  const accent = brand.hasBrand ? brand.primaryInk : "#111827"

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-muted-foreground text-sm">Preparing document…</p>
      </div>
    )
  }

  return (
    <BrandThemeProvider theme={brand}>
    <div className="print-doc min-h-screen bg-gray-200/70 print:bg-white">
      {/* Letter sizing and fragmentation rules live here, not in globals.css:
          the @page rule only exists while a print route is mounted (so other
          app pages keep the browser's default paper), and Lightning CSS
          strips both @page rules and these break-inside declarations from the
          compiled stylesheet. Headers and page numbers are real in-sheet
          elements — content is measured and packed into one-page sheets — so
          they work in every browser, unlike @page margin boxes. */}
      <style>{`
        @page {
          size: letter;
          margin: 0.75in;
        }
        @media print {
          .print-doc [data-slot="card"],
          .print-doc img,
          .print-doc tr {
            break-inside: avoid;
          }
        }
      `}</style>
      {/* Screen-only toolbar */}
      <div className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex w-[8.5in] max-w-full items-center justify-between px-4 py-2.5">
          <Button variant="outline" size="sm" asChild className="gap-2 bg-white">
            <a href={backHref}>
              <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
              Back
            </a>
          </Button>
          <p className="text-muted-foreground hidden text-xs sm:block">
            US Letter · use your browser&apos;s dialog to print or save as PDF
          </p>
          <Button size="sm" className="gap-2" onClick={() => window.print()}>
            <HugeiconsIcon icon={PrinterIcon} strokeWidth={2} className="size-4" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {/* print:block — WebKit ignores forced page breaks on flex items, so the
          sheet wrapper must lay out as normal blocks when printing. */}
      <div className="mx-auto flex w-[8.5in] max-w-full flex-col gap-6 py-8 text-gray-900 print:block print:w-auto print:max-w-none print:py-0">
        {/* ── Cover ── */}
        <section className="flex min-h-[11in] flex-col bg-white p-[0.75in] shadow-md ring-1 ring-black/5 print:min-h-[9.5in] print:p-0 print:shadow-none print:ring-0">
          <div className="flex items-center gap-3">
            <span className="h-px w-10" style={{ background: accent }} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">{docLabel}</p>
          </div>

          <div className="my-auto py-14">
            {isBusiness && brand.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt=""
                className="mb-8 size-24 rounded-full border-4 border-gray-200 object-cover shadow-sm"
              />
            )}
            {!isBusiness && studentImage && (
              // The Life Map cover leads with a large portrait above the name.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={studentImage}
                alt={studentName}
                className="mb-8 size-44 rounded-full border-4 border-gray-100 object-cover shadow-sm"
              />
            )}
            <h1 className="text-balance text-5xl font-bold leading-tight tracking-tight" style={titleFont}>
              {title}
            </h1>
            {isBusiness && brand.tagline && (
              <p className="mt-4 max-w-[5.5in] text-lg leading-relaxed text-gray-600">{brand.tagline}</p>
            )}
            <div className="mt-8 space-y-1 text-sm text-gray-500">
              {isBusiness && studentName && <p>by {studentName}</p>}
              {yearGroup && <p>SailFuture Academy · {formatYearGroup(yearGroup)}</p>}
              {lastEdited && (
                <p>
                  Updated{" "}
                  {lastEdited.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          </div>

          <div>
            {printSectionsAll.length > 0 && (
              <div className="border-t border-gray-200 pt-6">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Contents</p>
                <ol className="columns-2 gap-10 text-sm leading-7 text-gray-700">
                  {printSectionsAll.map(({ section }, i) => (
                    <li key={section.id} className="flex items-baseline gap-3 break-inside-avoid">
                      <span className="text-xs font-semibold tabular-nums" style={{ color: accent }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{section.section_title}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {isBusiness && (brand.contact.email || brand.contact.phone || brand.contact.location) && (
              <p className="mt-6 text-xs leading-relaxed text-gray-400">
                {[brand.contact.email, brand.contact.phone, brand.contact.location].filter(Boolean).join(" · ")}
              </p>
            )}
            {brand.palette.length > 0 && (
              <div className="mt-6 flex h-1.5 overflow-hidden rounded-full">
                {brand.palette.map((c, i) => (
                  <span key={i} className="flex-1" style={{ background: c }} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Sections, measured and packed into one-page sheets ── */}
        <PaginatedSheets
          printSections={printSectionsAll}
          responseMap={responseMap}
          brand={brand}
          accent={accent}
          titleFont={titleFont}
          displayTypesField={F.displayTypesId}
          title={title}
          docLabel={docLabel}
          budgetTables={budgetTables}
          resumeDoc={resumeDoc}
        />

        {printSectionsAll.length === 0 && (
          <section className="bg-white p-[0.75in] text-center shadow-md ring-1 ring-black/5 print:p-0 print:shadow-none print:ring-0">
            <p className="text-sm italic text-gray-500">Nothing has been approved for this document yet.</p>
          </section>
        )}
      </div>
    </div>
    </BrandThemeProvider>
  )
}

/**
 * A group becomes a run of independently-placeable blocks (heading rides
 * with the first one), so the paginator can flow long groups across
 * fixed-height pages instead of producing an oversized sheet:
 * - competitor map → the plot, then one full-width card row per company
 * - gallery → intro text rows, then 2-up image-card rows
 * - unit economics → one cost table per product
 * - everything else (incl. CHART/TABLE and Google Budget's iframe) → its
 *   underlying answers as question rows
 */
function buildGroupPrintBlocks(
  sectionId: number,
  group: CustomGroup,
  questions: TemplateQuestion[],
  responseMap: Map<number, StudentResponse>,
  brand: BrandTheme,
  accent: string,
  displayTypesField: string,
  budgetTables?: Map<number, SheetTab[]>
): PrintBlock[] {
  const base = `s${sectionId}-g${group.id}`
  const displayTypeId = Number(group[displayTypesField]) || null

  const bodies: PrintBlock[] = []
  if (displayTypeId === DISPLAY_TYPE.UNIT_ECONOMICS) {
    // The interactive flow diagram becomes its printable table equivalent,
    // one per product so each table can land on its own page.
    const lineItemsQ = questions.find((q) => isLineItemsQuestion(q))
    const raw = lineItemsQ ? (responseMap.get(lineItemsQ.id)?.student_response ?? "") : ""
    const products = parseLineItemProducts(raw).filter((p) => p.rows.length > 0)
    products.forEach((p, i) =>
      bodies.push({
        id: `${base}-p${i}`,
        node: (
          <div className="break-inside-avoid">
            <ProductLineItemsTable product={p} />
          </div>
        ),
      })
    )
    if (bodies.length === 0) bodies.push({ id: `${base}-none`, node: <LineItemsTable raw={raw} /> })
  } else if (displayTypeId === DISPLAY_TYPE.COMPETITOR_MAP) {
    const data = getCompetitorMapData(questions, responseMap)
    // 3:2 keeps the graph large but small enough to share the section's
    // header page.
    bodies.push({
      id: `${base}-plot`,
      node: (
        <div className="break-inside-avoid">
          <CompetitorMapPlot data={data} aspect="3 / 2" />
        </div>
      ),
    })
    // All four competitors stack on one page: full text flows in two
    // columns inside each card (no truncation), and the card family pulls
    // onto a fresh page together when it fits.
    data.cards.forEach((c, i) => {
      bodies.push({
        id: `${base}-card${i}`,
        familyKey: `${base}-cards`,
        node: (
          <div className="rounded-lg border border-gray-200 p-4 break-inside-avoid">
            <div className="flex items-center gap-3">
              {c.entity.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.entity.logoUrl}
                  alt=""
                  className="size-8 shrink-0 rounded-full border border-gray-200 object-contain"
                />
              ) : (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500">
                  {(c.entity.name || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold">{c.entity.name || "—"}</p>
                <p className="text-[10px] text-gray-400">{c.label}</p>
              </div>
            </div>
            {c.positioning ? (
              <div className="mt-2.5 columns-2 gap-8 whitespace-pre-wrap text-[11px] leading-relaxed text-gray-600">
                {c.positioning}
              </div>
            ) : (
              <div className="mt-2.5 h-6 rounded border border-dashed border-gray-200 bg-gray-50" />
            )}
          </div>
        ),
      })
    })
  } else if (displayTypeId === DISPLAY_TYPE.GALLERY) {
    // The slides are built from — and return — this module's own question
    // objects; the cast just restores their wider type.
    const { slides, intro } = buildGallerySlides(questions) as unknown as {
      slides: { imageQ: TemplateQuestion; titleQ: TemplateQuestion | null; descQs: TemplateQuestion[] }[]
      intro: TemplateQuestion[]
    }
    buildQuestionRows(intro, responseMap, brand).forEach((node, i) =>
      bodies.push({ id: `${base}-intro${i}`, familyKey: `${base}-fam`, node })
    )
    const cards = slides.map((s) => {
      const r = responseMap.get(s.imageQ.id)
      const src = r?.isComplete ? r.image_response?.path || r.image_response?.url : undefined
      const cardTitle = s.titleQ ? (responseMap.get(s.titleQ.id)?.student_response ?? "").trim() : ""
      const desc =
        s.descQs.map((dq) => (responseMap.get(dq.id)?.student_response ?? "").trim()).filter(Boolean)[0] ?? ""
      return {
        key: s.imageQ.id,
        src: src ? resolveImageUrl(src) : "",
        cardTitle: cardTitle || (src ? "" : s.imageQ.public_display_title || s.imageQ.field_label),
        desc,
        // Respect the field's configured crop inside the uniform card grid.
        ratio: questionRatio(s.imageQ)?.css ?? "4 / 3",
      }
    })
    // Galleries of 3+ print as ONE full-page grid of captioned cards, with
    // the column count chosen so the set fills the sheet. One- or two-slide
    // galleries stay inline with their section.
    const galRatio = questionRatio(slides[0]?.imageQ ?? ({} as TemplateQuestion))?.num ?? 4 / 3
    const galCols = cards.length <= 2 ? 2 : bestGridCols(Math.min(cards.length, 12), galRatio, true)
    for (let i = 0; i < cards.length; i += 12) {
      bodies.push({
        id: `${base}-imgs${i}`,
        ...(cards.length >= 3 ? { ownPage: true } : { familyKey: `${base}-fam` }),
        node: (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${galCols}, minmax(0, 1fr))` }}>
            {cards.slice(i, i + 12).map((c) => (
              <div key={c.key} className="overflow-hidden rounded-lg border border-gray-200 break-inside-avoid">
                {c.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.src} alt={c.cardTitle || "Gallery image"} className="w-full object-cover" style={{ aspectRatio: c.ratio }} />
                ) : (
                  <div className="w-full bg-gray-100" style={{ aspectRatio: c.ratio }} />
                )}
                {(c.cardTitle || c.desc) && (
                  <div className="border-t border-gray-200 px-2.5 py-1.5">
                    {c.cardTitle && <p className="text-[10px] font-semibold leading-snug">{c.cardTitle}</p>}
                    {c.desc && <p className="mt-0.5 text-[10px] leading-snug text-gray-600">{c.desc}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ),
      })
    }
  } else if (displayTypeId === DISPLAY_TYPE.GOOGLE_BUDGET) {
    // The embedded spreadsheet can't print — its answers print as rows, and
    // the sheet itself becomes a labeled link card (PDFs keep <a> targets
    // clickable, and the visible URL survives on paper).
    const urlQ = questions.find((q) => q.field_name === "google_sheet_url")
    const urlR = urlQ ? responseMap.get(urlQ.id) : undefined
    const sheetUrl = urlQ && hasContent(urlQ, urlR) ? (urlR!.student_response ?? "").trim() : ""
    const rest = printableGridQuestions(questions).filter(
      (q) => !(sheetUrl && q.field_name === "google_sheet_url")
    )
    buildQuestionRows(rest, responseMap, brand).forEach((node, i) =>
      bodies.push({ id: `${base}-row${i}`, node })
    )
    // The sheet's data, styled like the sheet itself: the header row and the
    // totals block (from the first "Total …" row down) print on the deep
    // template green, section-band rows (label only, no values) on the
    // lighter green, data rows plain. Each tab is a block family, so tabs
    // pack together on a page whenever they fit; a tab in SHEET_TAB_SPLIT
    // breaks at its blank rows into separate header-led tables.
    const tabs = urlQ ? budgetTables?.get(urlQ.id) : undefined
    if (tabs && tabs.length > 0) {
      const isNumeric = (v: string) => v !== "" && /^\(?-?[$€£]?[\d,.\s]+%?\)?$/.test(v)
      const styledTable = (blockRows: string[][], key: string) => {
        // Width stops at the block's last non-empty column, so a 2-column
        // totals table doesn't drag four empty columns along.
        const width = Math.max(
          1,
          ...blockRows.map((r) => {
            let w = 0
            r.forEach((v, i) => {
              if (v.trim() !== "") w = i + 1
            })
            return w
          })
        )
        const firstTotal = blockRows.findIndex((r) => /^total\b/i.test((r[0] ?? "").trim()))
        return (
          <table key={key} className="w-full border-collapse text-[10px] leading-snug">
            <tbody>
              {blockRows.map((r, ri) => {
                const label = (r[0] ?? "").trim()
                const hasValues = r.slice(1).some((v) => v.trim() !== "")
                const kind =
                  ri === 0
                    ? "header"
                    : (firstTotal > 0 && ri >= firstTotal) || /(subtotal)$/i.test(label) || /^net\b/i.test(label)
                      ? "summary"
                      : label !== "" && !hasValues
                        ? "band"
                        : "data"
                if (kind === "band") {
                  return (
                    <tr key={ri}>
                      <td
                        colSpan={width}
                        className="px-2 py-1 font-semibold text-gray-700"
                        style={{ background: SHEET_BAND_BG }}
                      >
                        {label}
                      </td>
                    </tr>
                  )
                }
                const dark = kind === "header" || kind === "summary"
                return (
                  <tr key={ri}>
                    {Array.from({ length: width }, (_, ci) => {
                      const v = (r[ci] ?? "").trim()
                      return (
                        <td
                          key={ci}
                          className={`px-2 py-1 align-top ${
                            dark
                              ? "font-semibold text-white"
                              : "border-b border-gray-100 text-gray-800"
                          } ${isNumeric(v) ? "text-right tabular-nums" : ""}`}
                          style={dark ? { background: SHEET_DEEP_BG } : undefined}
                        >
                          {v}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )
      }
      tabs.forEach((tab, ti) => {
        const famKey = `${base}-tab${ti}`
        const heading = tab.name ? (
          <div className="mb-3 flex items-center gap-2.5">
            <span className="h-3.5 w-1 rounded-full" style={{ background: accent }} />
            <h4 className="text-sm font-semibold tracking-tight">{tab.name}</h4>
          </div>
        ) : null
        // The Life Map monthly budget explodes into independent per-section
        // tables (its two column-streams unwoven), paired two-up across the
        // page, with the totals table full-width at the end.
        if (LM_BUDGET_TAB_RE.test(tab.name)) {
          const lmBlocks = splitLmBudget(tab.table.rows)
          if (lmBlocks.length > 0) {
            const summary = lmBlocks[lmBlocks.length - 1]?.title === "Monthly Summary" ? lmBlocks.pop() : null
            for (let i = 0; i < lmBlocks.length; i += 2) {
              const pair = lmBlocks.slice(i, i + 2)
              bodies.push({
                id: `${famKey}-lm${i}`,
                familyKey: famKey,
                node: (
                  <div>
                    {i === 0 && heading}
                    <div className="grid grid-cols-2 items-start gap-6">
                      {pair.map((b) => styledTable([[b.title, ""], ...b.rows], b.title))}
                    </div>
                  </div>
                ),
              })
            }
            if (summary) {
              bodies.push({
                id: `${famKey}-lmsum`,
                familyKey: famKey,
                node: styledTable([[summary.title, ""], ...summary.rows], "sum"),
              })
            }
            return
          }
        }
        const blocks = SHEET_TAB_SPLIT.has(tab.name.trim().toLowerCase())
          ? splitTabRows(tab.table.rows)
          : [tab.table.rows.filter((r) => !isBlankRow(r))]
        blocks.forEach((blockRows, bi) => {
          if (blockRows.length === 0) return
          const width = Math.max(...blockRows.map((r) => r.length))
          // A single long narrow table reads horizontally as two halves.
          const sideBySide = blocks.length === 1 && width <= 3 && blockRows.length >= 14
          let tableNode: React.ReactNode
          if (sideBySide) {
            const [headRow, ...body] = blockRows
            const half = Math.ceil(body.length / 2)
            tableNode = (
              <div className="grid grid-cols-2 items-start gap-6">
                {styledTable([headRow, ...body.slice(0, half)], "a")}
                {styledTable([headRow, ...body.slice(half)], "b")}
              </div>
            )
          } else {
            tableNode = styledTable(blockRows, "t")
          }
          bodies.push({
            id: `${famKey}-${bi}`,
            familyKey: famKey,
            node: (
              <div>
                {bi === 0 && heading}
                {tableNode}
              </div>
            ),
          })
        })
      })
    }
    if (sheetUrl) {
      const href = sheetUrl.startsWith("http") ? sheetUrl : `https://${sheetUrl}`
      bodies.push({
        id: `${base}-sheetlink`,
        node: (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 break-inside-avoid"
          >
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Live budget spreadsheet
            </span>
            <span className="mt-0.5 block break-all text-[12px] text-gray-700 underline decoration-gray-300 underline-offset-2">
              {href}
            </span>
          </a>
        ),
      })
    }
  } else if (displayTypeId === DISPLAY_TYPE.TRANSPORTATION_BUDGET) {
    bodies.push({
      id: `${base}-table`,
      node: (
        <div className="break-inside-avoid">
          <GroupDisplayRenderer
            displayTypeId={displayTypeId}
            questions={questions}
            responseMap={responseMap}
            mode="public"
          />
        </div>
      ),
    })
  } else {
    const printable = printableGridQuestions(questions)
    const imgQs = printable.filter((q) => typeIdOf(q) === QUESTION_TYPE.IMAGE_UPLOAD)
    const textQs = printable.filter(
      (q) => !q._question_types?.noInput && typeIdOf(q) !== QUESTION_TYPE.IMAGE_UPLOAD
    )
    // Interleaved image+caption sets (the prototype walkthrough): each image
    // pairs with the short answer that immediately follows it in sort order.
    // The whole set always prints as ONE full-page 3-across captioned grid.
    const captionByImage = new Map<number, TemplateQuestion>()
    for (let i = 0; i < printable.length - 1; i++) {
      if (typeIdOf(printable[i]) === QUESTION_TYPE.IMAGE_UPLOAD && isShortType(typeIdOf(printable[i + 1]))) {
        captionByImage.set(printable[i].id, printable[i + 1])
      }
    }
    const captionedSet = imgQs.length >= 3 && captionByImage.size >= Math.ceil(imgQs.length / 2)
    // Small text+image groups (a messaging location, say) print as one media
    // block — full text on the left, the uncropped image on the right.
    // Image-heavy groups skip this and use the grid below instead.
    const mediaGroup =
      imgQs.length >= 1 &&
      imgQs.length <= 2 &&
      textQs.length >= 1 &&
      textQs.length <= 3 &&
      printable.length === imgQs.length + textQs.length
    if (captionedSet) {
      const captionIds = new Set([...captionByImage.values()].map((c) => c.id))
      const leads = textQs.filter((t) => !captionIds.has(t.id))
      buildQuestionRows(leads, responseMap, brand).forEach((node, i) =>
        bodies.push({ id: `${base}-lead${i}`, node })
      )
      const csRatio = questionRatio(imgQs[0])?.num ?? 4 / 3
      const csCols = bestGridCols(imgQs.length, csRatio, true)
      bodies.push({
        id: `${base}-cgrid`,
        ownPage: true,
        node: (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${csCols}, minmax(0, 1fr))` }}>
            {imgQs.map((q) => {
              const r = responseMap.get(q.id)
              const src = hasContent(q, r)
                ? resolveImageUrl(r!.image_response?.path || r!.image_response?.url)
                : ""
              const capQ = captionByImage.get(q.id)
              const capR = capQ ? responseMap.get(capQ.id) : undefined
              const caption = capQ && hasContent(capQ, capR) ? (capR!.student_response ?? "").trim() : ""
              const ratio = questionRatio(q)?.css ?? "4 / 3"
              return (
                <div key={q.id} className="overflow-hidden rounded-lg border border-gray-200 break-inside-avoid">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={q.field_label} className="w-full object-cover" style={{ aspectRatio: ratio }} />
                  ) : (
                    <div className="w-full bg-gray-100" style={{ aspectRatio: ratio }} />
                  )}
                  {(caption || !src) && (
                    <div className="border-t border-gray-200 px-2.5 py-1.5">
                      <p className="text-[10px] leading-snug text-gray-600">
                        {caption || q.public_display_title || q.field_label}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ),
      })
    } else if (mediaGroup) {
      bodies.push({
        id: `${base}-media`,
        node: (
          <div className="grid grid-cols-2 items-start gap-x-10">
            <div className="space-y-3">
              {textQs.map((q) => {
                const r = responseMap.get(q.id)
                const raw = r?.student_response ?? ""
                const txt = looksLikeRichTextDoc(raw) ? extractPlainText(raw) : raw
                return (
                  <div key={q.id}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {q.public_display_title || q.field_label}
                    </p>
                    {hasContent(q, r) ? (
                      <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-gray-800">{txt}</p>
                    ) : (
                      <PlaceholderValue q={q} />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="space-y-3">
              {imgQs.map((q) => {
                const r = responseMap.get(q.id)
                const src = hasContent(q, r)
                  ? resolveImageUrl(r!.image_response?.path || r!.image_response?.url)
                  : ""
                const ratio = questionRatio(q)
                return (
                  <div key={q.id}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {q.public_display_title || q.field_label}
                    </p>
                    {src ? (
                      ratio ? (
                        <div
                          className="w-full overflow-hidden rounded-md border border-gray-200"
                          style={{ aspectRatio: ratio.css }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={q.field_label} className="size-full object-cover" />
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={q.field_label} className="h-auto max-h-[3.5in] w-auto max-w-full rounded-md border border-gray-200" />
                      )
                    ) : (
                      <PlaceholderValue q={q} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ),
      })
    } else if (imgQs.length >= 3 && textQs.length <= 2) {
      // Image-dominant groups (reference images) get a page of their own
      // with the whole set in a 3-across grid — gray squares mark missing
      // shots; any lead-in text prints as regular rows first.
      buildQuestionRows(textQs, responseMap, brand).forEach((node, i) =>
        bodies.push({ id: `${base}-lead${i}`, node })
      )
      // All of the set's images share one full page, sized to fill it.
      const igRatio = questionRatio(imgQs[0])?.num ?? 4 / 3
      const igCols = bestGridCols(Math.min(imgQs.length, 12), igRatio, false)
      for (let i = 0; i < imgQs.length; i += 12) {
        bodies.push({
          id: `${base}-igrid${i}`,
          ownPage: true,
          node: (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${igCols}, minmax(0, 1fr))` }}>
              {imgQs.slice(i, i + 12).map((q) => {
                const r = responseMap.get(q.id)
                const src = hasContent(q, r)
                  ? resolveImageUrl(r!.image_response?.path || r!.image_response?.url)
                  : ""
                const ratio = questionRatio(q)?.css ?? "4 / 3"
                return (
                  <div key={q.id} className="overflow-hidden rounded-lg border border-gray-200 break-inside-avoid">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={q.field_label} className="w-full object-cover" style={{ aspectRatio: ratio }} />
                    ) : (
                      <div className="w-full bg-gray-100" style={{ aspectRatio: ratio }} />
                    )}
                  </div>
                )
              })}
            </div>
          ),
        })
      }
    } else {
      buildQuestionRows(printable, responseMap, brand).forEach((node, i) =>
        bodies.push({ id: `${base}-row${i}`, node })
      )
    }
  }

  const sourceEntries = questions
    .map((q) => ({ q, r: responseMap.get(q.id) }))
    .filter(
      ({ q, r }) =>
        typeIdOf(q) === QUESTION_TYPE.SOURCE &&
        r?.isComplete &&
        (r.source_link || r.title_of_source || r.author_name_or_publisher)
    )
  if (sourceEntries.length > 0) {
    bodies.push({
      id: `${base}-sources`,
      node: (
        <div className="border-t border-gray-100 pt-3 break-inside-avoid">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-gray-400">Sources</p>
          {sourceEntries.map(({ q, r }) => (
            <p key={q.id} className="text-[11px] leading-snug text-gray-500">
              {citationLine(r!)}
            </p>
          ))}
        </div>
      ),
    })
  }

  // The heading rides with the first body block so it can't be orphaned at
  // the bottom of a page.
  const heading = (
    <div className="mb-4">
      <div className="flex items-center gap-2.5">
        <span className="h-4 w-1 rounded-full" style={{ background: accent }} />
        <h3 className="text-lg font-semibold tracking-tight">{group.group_name}</h3>
      </div>
      {group.group_description && (
        <p className="mt-2 text-xs leading-relaxed text-gray-500">{group.group_description}</p>
      )}
    </div>
  )
  return bodies.map((b, i) =>
    i === 0
      ? {
          ...b,
          node: (
            <div>
              {heading}
              {b.node}
            </div>
          ),
        }
      : b
  )
}

/** Half-width cells: images (so logos and reference shots pair up side by
    side in a 2-wide grid) and genuinely short answers. Anything
    paragraph-length takes the full page width — many "short response"
    questions hold long prose. */
function isHalfCell(q: TemplateQuestion, r: StudentResponse | undefined): boolean {
  const typeId = typeIdOf(q)
  if (typeId === QUESTION_TYPE.IMAGE_UPLOAD) return true
  const textLen = (r?.student_response ?? "").trim().length
  return isShortType(typeId) && textLen <= 140
}

/** Labeled placeholder for an unanswered question: the input's name plus a
    gray box for images or a dashed empty slot for everything else. */
function PlaceholderValue({ q }: { q: TemplateQuestion }) {
  if (typeIdOf(q) === QUESTION_TYPE.IMAGE_UPLOAD) {
    // The gray slot previews at the field's configured crop.
    const ratio = questionRatio(q)?.css ?? "4 / 3"
    return <div className="w-full rounded-md border border-gray-200 bg-gray-100" style={{ aspectRatio: ratio }} />
  }
  return <div className="h-6 w-full rounded border border-dashed border-gray-200 bg-gray-50" />
}

function QuestionCell({
  q,
  r,
  brand,
  half,
}: {
  q: TemplateQuestion
  r: StudentResponse | undefined
  brand: BrandTheme
  half: boolean
}) {
  return (
    <div className={`${half ? "" : "col-span-2"} break-inside-avoid`}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {q.public_display_title || q.field_label}
      </p>
      {hasContent(q, r) ? <PrintValue q={q} r={r!} brand={brand} /> : <PlaceholderValue q={q} />}
    </div>
  )
}

/** Cut a wall of prose at sentence boundaries into ~page-friendly pieces. */
function sentenceBuckets(plain: string, limit = 900): string[] {
  const sentences = plain.match(/[^.!?]+[.!?]+["”')\]]*\s*|[^.!?]+$/g) ?? [plain]
  const out: string[] = []
  let buf = ""
  for (const s of sentences) {
    if (buf && buf.length + s.length > limit) {
      out.push(buf.trim())
      buf = ""
    }
    buf += s
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

/** A single wall-of-text paragraph can't flow across pages, so cut plain
    paragraphs at sentence boundaries into ~page-friendly pieces. Paragraphs
    with marks (links, bold) pass through untouched. */
function splitLongParagraphs(nodes: unknown[]): unknown[] {
  const out: unknown[] = []
  for (const n of nodes) {
    const node = n as { type?: string; content?: { type?: string; text?: string; marks?: unknown[] }[] }
    const plain =
      node.type === "paragraph" &&
      Array.isArray(node.content) &&
      node.content.length > 0 &&
      node.content.every((c) => c.type === "text" && !(c.marks && c.marks.length))
        ? node.content.map((c) => c.text ?? "").join("")
        : null
    if (plain && plain.length > 900) {
      for (const piece of sentenceBuckets(plain)) {
        out.push({ type: "paragraph", content: [{ type: "text", text: piece }] })
      }
    } else {
      out.push(n)
    }
  }
  return out
}

/** Pack the ungrouped questions into row nodes (pairs of half-width cells,
    or one full-width cell) so the paginator can measure and place each row. */
function buildQuestionRows(
  questions: TemplateQuestion[],
  responseMap: Map<number, StudentResponse>,
  brand: BrandTheme
): React.ReactNode[] {
  const rows: React.ReactNode[] = []
  let pending: TemplateQuestion | null = null
  const push = (...qs: TemplateQuestion[]) => {
    rows.push(
      <div key={qs.map((q) => q.id).join("-")} className="grid grid-cols-2 gap-x-10">
        {qs.map((q) => (
          <QuestionCell
            key={q.id}
            q={q}
            r={responseMap.get(q.id)}
            brand={brand}
            half={isHalfCell(q, responseMap.get(q.id))}
          />
        ))}
      </div>
    )
  }
  const flushPending = () => {
    if (pending) {
      push(pending)
      pending = null
    }
  }
  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi]
    if (q._question_types?.noInput) {
      flushPending()
      rows.push(
        <p
          key={`h-${q.id}`}
          className="border-b border-gray-100 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500"
        >
          {q.public_display_title || q.field_label}
        </p>
      )
      continue
    }
    const r = responseMap.get(q.id)
    const text = r?.student_response ?? ""
    const typeId = typeIdOf(q)
    // Long essays split at the paragraph level so they flow across
    // fixed-height pages instead of forcing an oversized sheet.
    if ((typeId === RICH_TEXT_TYPE_ID || looksLikeRichTextDoc(text)) && hasContent(q, r) && !isHalfCell(q, r)) {
      flushPending()
      const nodes = splitLongParagraphs((parseRichText(text)?.content ?? []) as unknown[])
      if (nodes.length > 0) {
        const CHUNK = 2
        for (let i = 0; i < nodes.length; i += CHUNK) {
          rows.push(
            <div key={`rt-${q.id}-${i}`} className="break-inside-avoid">
              {i === 0 && (
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {q.public_display_title || q.field_label}
                </p>
              )}
              <RichTextDisplay
                raw={JSON.stringify({ type: "doc", content: nodes.slice(i, i + CHUNK) })}
                className="text-[13px] leading-relaxed"
              />
            </div>
          )
        }
        continue
      }
    }
    // Long plain-prose answers (the Executive Summary) get the same
    // treatment: sentence-bucket pieces flow onto the section's title page
    // and continue across pages instead of landing as one immovable slab.
    if (
      (typeId === QUESTION_TYPE.LONG_RESPONSE || typeId === QUESTION_TYPE.SHORT_RESPONSE) &&
      hasContent(q, r) &&
      !looksLikeRichTextDoc(text) &&
      text.trim().length > 1200
    ) {
      flushPending()
      const pieces = text
        .trim()
        .split(/\n{2,}/)
        .flatMap((p) => (p.length > 900 ? sentenceBuckets(p) : [p]))
      pieces.forEach((piece, i) => {
        rows.push(
          <div key={`lt-${q.id}-${i}`} className="break-inside-avoid">
            {i === 0 && (
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {q.public_display_title || q.field_label}
              </p>
            )}
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-800">{piece}</p>
          </div>
        )
      })
      continue
    }
    if (isHalfCell(q, r)) {
      if (pending) {
        push(pending, q)
        pending = null
      } else {
        pending = q
      }
    } else {
      flushPending()
      push(q)
    }
  }
  flushPending()
  return rows
}

interface PrintBlock {
  id: string
  node: React.ReactNode
  /** Sibling groups sharing a name prefix (e.g. the three "Messaging
      Location" groups) carry the same key so the paginator keeps the whole
      family on one page when it fits. */
  familyKey?: string
  /** Render on a page of its own (e.g. the reference-image sheet). */
  ownPage?: boolean
  /** Start a fresh page before this block (e.g. each budget-sheet tab);
      following blocks may still share the page. */
  breakBefore?: boolean
  /** The block IS the page: no sheet padding, header, or footer (the
      resume's PDF-page snapshots). Implies ownPage. */
  fullBleed?: boolean
}

interface PageSpec {
  sIdx: number
  blockIds: string[]
  /** A single block taller than one page; the sheet grows instead of clipping. */
  oversized: boolean
  /** 0 for the section's first page, 1+ for continuation pages. */
  contIndex: number
}

// Usable block height per page: 9.5in (Letter minus margins) is 912px at
// 96dpi; reserve room for the footer strip, continuation header, and a
// safety margin so screen measurements never overflow the printed page.
const PAGE_BUDGET = 850
const BLOCK_GAP = 24

/**
 * Renders every section as true 8.5×11 sheets: each section's content is
 * measured off-screen at page width, packed into pages, and re-rendered as
 * fixed-height sheets with a running footer and real page numbers — accurate
 * on screen and in the PDF, in every browser.
 */
function PaginatedSheets({
  printSections,
  responseMap,
  brand,
  accent,
  titleFont,
  displayTypesField,
  title,
  docLabel,
  budgetTables,
  resumeDoc,
}: {
  printSections: { section: SectionInfo; ungrouped: TemplateQuestion[]; groupBlocks: { group: CustomGroup; questions: TemplateQuestion[] }[] }[]
  responseMap: Map<number, StudentResponse>
  brand: BrandTheme
  accent: string
  titleFont?: React.CSSProperties
  displayTypesField: string
  title: string
  docLabel: string
  budgetTables?: Map<number, SheetTab[]>
  resumeDoc?: ResumeDoc | null
}) {
  const measureRef = useRef<HTMLDivElement | null>(null)
  // The layout is keyed to the block list it was measured from, so new
  // content automatically derives back to "not measured yet" — no reset
  // effect needed.
  const [layout, setLayout] = useState<{ source: unknown; pages: PageSpec[] } | null>(null)

  const sectionsBlocks = useMemo(() => {
    return printSections.map(({ section, ungrouped, groupBlocks }, i) => {
      // The synthetic resume section: PDF-snapshot pages render as one
      // full-sheet image each (the resume exactly as designed); the HTML
      // fallback renders the doc's blocks under the typographic header.
      if (section.id === RESUME_SECTION_ID && resumeDoc && resumeDoc.kind === "pages") {
        return {
          section,
          blocks: resumeDoc.pages.map((src, bi): PrintBlock => ({
            id: `resume-p${bi}`,
            ownPage: true,
            fullBleed: true,
            node: (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={`Resume page ${bi + 1}`} className="h-full w-full object-contain" />
            ),
          })),
        }
      }
      if (section.id === RESUME_SECTION_ID && resumeDoc && resumeDoc.kind === "flow") {
        const blocks: PrintBlock[] = [
          {
            id: "resume-header",
            node: (
              <header className="border-b border-gray-200 pb-5">
                <style>{resumeDoc.css}</style>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold tabular-nums" style={{ color: accent }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="h-px w-8" style={{ background: accent }} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">{docLabel}</span>
                </div>
                <h2 className="mt-2 text-3xl font-bold tracking-tight" style={titleFont}>
                  Resume
                </h2>
              </header>
            ),
          },
          ...resumeDoc.blocks.map((html, bi) => ({
            id: `resume-b${bi}`,
            node: (
              <div
                className="gdoc-resume break-inside-avoid"
                // Sanitized in parseGoogleDocHtml (scripts/handlers stripped).
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ),
          })),
        ]
        return { section, blocks }
      }
      const blocks: PrintBlock[] = [
        {
          id: `s${section.id}-header`,
          node: (
            <header className="border-b border-gray-200 pb-5">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold tabular-nums" style={{ color: accent }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="h-px w-8" style={{ background: accent }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">{docLabel}</span>
              </div>
              <h2 className="mt-2 text-3xl font-bold tracking-tight" style={titleFont}>
                {section.section_title}
              </h2>
              {(section.description || section.section_description) && (
                <p className="mt-2 max-w-[6in] text-sm leading-relaxed text-gray-500">
                  {section.description || section.section_description}
                </p>
              )}
            </header>
          ),
        },
      ]
      buildQuestionRows(ungrouped, responseMap, brand).forEach((node, ri) => {
        blocks.push({ id: `s${section.id}-row-${ri}`, node })
      })
      // Groups whose names share a prefix before ":" (dropping a plural "s")
      // form a family the paginator tries to keep on a single page; the
      // branding trio (logo, colors, typography) is one family by name.
      const famKeyOf = (name: string) => {
        if (/logo|colou?r|typograph|font/i.test(name)) return "branding"
        return name.split(":")[0].trim().toLowerCase().replace(/s$/, "")
      }
      const famKeys = groupBlocks.map(({ group }) => famKeyOf(group.group_name))
      groupBlocks.forEach(({ group, questions }, gi) => {
        const inRun =
          (gi > 0 && famKeys[gi - 1] === famKeys[gi]) ||
          (gi < famKeys.length - 1 && famKeys[gi + 1] === famKeys[gi])
        const gBlocks = buildGroupPrintBlocks(
          section.id,
          group,
          questions,
          responseMap,
          brand,
          accent,
          displayTypesField,
          budgetTables
        )
        blocks.push(
          ...(inRun
            ? gBlocks.map((b) =>
                b.familyKey || b.ownPage ? b : { ...b, familyKey: `s${section.id}-${famKeys[gi]}` }
              )
            : gBlocks)
        )
      })
      if (ungrouped.length === 0 && groupBlocks.length === 0) {
        blocks.push({
          id: `s${section.id}-empty`,
          node: <p className="text-xs italic text-gray-400">No approved content in this section yet.</p>,
        })
      }
      return { section, blocks }
    })
  }, [printSections, responseMap, brand, accent, titleFont, displayTypesField, docLabel, budgetTables, resumeDoc])

  const blockById = useMemo(() => {
    const m = new Map<string, React.ReactNode>()
    for (const s of sectionsBlocks) for (const b of s.blocks) m.set(b.id, b.node)
    return m
  }, [sectionsBlocks])

  // Pages holding one of these render edge-to-edge with no chrome.
  const fullBleedIds = useMemo(() => {
    const s = new Set<string>()
    for (const sec of sectionsBlocks) for (const b of sec.blocks) if (b.fullBleed) s.add(b.id)
    return s
  }, [sectionsBlocks])

  const pages = layout && layout.source === sectionsBlocks ? layout.pages : null

  useEffect(() => {
    if (pages !== null) return
    const el = measureRef.current
    if (!el) return
    let cancelled = false
    const withTimeout = (p: Promise<unknown>, ms: number) =>
      Promise.race([p.catch(() => {}), new Promise((res) => setTimeout(res, ms))])
    const whenLoaded = (img: HTMLImageElement) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.addEventListener("load", () => res(), { once: true })
            img.addEventListener("error", () => res(), { once: true })
          })
    const run = async () => {
      // Heights are only real once images and webfonts are in — but never
      // stall the layout on a hung request; measure with what has arrived.
      const imgs = Array.from(el.querySelectorAll("img")) as HTMLImageElement[]
      await withTimeout(Promise.all(imgs.map(whenLoaded)), 6000)
      await withTimeout(document.fonts?.ready ?? Promise.resolve(), 2500)
      const container = measureRef.current
      if (cancelled || !container) return
      const heights = new Map<string, number>()
      for (const child of Array.from(container.children) as HTMLElement[]) {
        if (child.dataset.bid) heights.set(child.dataset.bid, child.getBoundingClientRect().height)
      }
      const out: PageSpec[] = []
      sectionsBlocks.forEach(({ blocks }, sIdx) => {
        let cur: string[] = []
        let used = 0
        let cont = 0
        const flush = (oversized = false) => {
          if (!cur.length) return
          out.push({ sIdx, blockIds: cur, oversized, contIndex: cont })
          cont += 1
          cur = []
          used = 0
        }
        for (let bi = 0; bi < blocks.length; bi++) {
          const b = blocks[bi]
          const bh = (heights.get(b.id) ?? 0) + BLOCK_GAP
          // Own-page blocks (the reference-image sheet) print alone.
          if (b.ownPage) {
            flush()
            cur.push(b.id)
            used += bh
            flush(used > PAGE_BUDGET)
            continue
          }
          // A tab boundary: close the current page, then flow normally.
          if (b.breakBefore && used > 0) flush()
          // Entering a block family: when the whole family fits on a fresh
          // page but not in the space left, break early so it stays together.
          if (b.familyKey && used > 0 && blocks[bi - 1]?.familyKey !== b.familyKey) {
            let famTotal = 0
            for (let j = bi; j < blocks.length && blocks[j].familyKey === b.familyKey; j++) {
              famTotal += (heights.get(blocks[j].id) ?? 0) + BLOCK_GAP
            }
            if (famTotal <= PAGE_BUDGET && used + famTotal > PAGE_BUDGET) flush()
          }
          if (used > 0 && used + bh > PAGE_BUDGET) flush()
          cur.push(b.id)
          used += bh
          if (cur.length === 1 && used > PAGE_BUDGET) flush(true)
        }
        flush()
      })
      if (!cancelled) setLayout({ source: sectionsBlocks, pages: out })
    }
    run()
    return () => {
      cancelled = true
    }
  }, [pages, sectionsBlocks])

  if (pages === null) {
    return (
      <>
        {/* Off-screen measuring pass at exact page-content width. */}
        <div
          ref={measureRef}
          aria-hidden
          className="pointer-events-none fixed left-[-10000px] top-0 w-[7in] print:hidden"
        >
          {sectionsBlocks.flatMap((s) => s.blocks).map((b) => (
            <div key={b.id} data-bid={b.id}>
              {b.node}
            </div>
          ))}
        </div>
        <section className="flex h-[11in] items-center justify-center bg-white shadow-md ring-1 ring-black/5">
          <p className="text-sm text-gray-400">Laying out pages…</p>
        </section>
      </>
    )
  }

  const totalPages = pages.length + 1 // + cover

  return (
    <>
      {pages.map((page, pi) => {
        const { section } = sectionsBlocks[page.sIdx]
        // Full-bleed pages (the resume snapshots) are the image alone —
        // no padding, continuation header, or footer.
        if (page.blockIds.length === 1 && fullBleedIds.has(page.blockIds[0])) {
          return (
            <section
              key={`${section.id}-${page.contIndex}`}
              className="h-[11in] overflow-hidden break-before-page bg-white shadow-md ring-1 ring-black/5 print:h-[9.5in] print:shadow-none print:ring-0"
            >
              {blockById.get(page.blockIds[0])}
            </section>
          )
        }
        return (
          <section
            key={`${section.id}-${page.contIndex}`}
            className={`flex flex-col overflow-hidden break-before-page bg-white p-[0.75in] shadow-md ring-1 ring-black/5 print:p-0 print:shadow-none print:ring-0 ${
              page.oversized
                ? "min-h-[11in] print:min-h-0 print:overflow-visible"
                : "h-[11in] print:h-[9.5in]"
            }`}
          >
            {page.contIndex > 0 && (
              <div className="mb-5 flex items-center justify-between text-[8px] uppercase tracking-[0.14em] text-gray-400">
                <span>{section.section_title} — continued</span>
                <span>{title}</span>
              </div>
            )}
            <div className="space-y-6">
              {page.blockIds.map((id) => (
                <div key={id}>{blockById.get(id)}</div>
              ))}
            </div>
            <div className="mt-auto flex items-center justify-between pt-6 text-[8px] uppercase tracking-[0.14em] text-gray-400">
              <span>
                {title} — {docLabel}
              </span>
              <span>
                Page {pi + 2} of {totalPages}
              </span>
            </div>
          </section>
        )
      })}
    </>
  )
}

function PrintValue({ q, r, brand }: { q: TemplateQuestion; r: StudentResponse; brand: BrandTheme }) {
  const typeId = typeIdOf(q)
  const text = r.student_response ?? ""

  if (typeId === QUESTION_TYPE.IMAGE_UPLOAD) {
    const src = resolveImageUrl(r.image_response?.path || r.image_response?.url)
    const ratio = questionRatio(q)
    if (ratio) {
      // Honor the field's configured crop: a fixed-ratio frame with the
      // photo covering it, capped so the frame never exceeds ~3in tall.
      return (
        <div
          className="w-full max-w-full overflow-hidden rounded-md border border-gray-200 break-inside-avoid"
          style={{ aspectRatio: ratio.css, maxWidth: `${Math.min(3 * ratio.num, 7).toFixed(2)}in` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={q.field_label} className="size-full object-cover" />
        </div>
      )
    }
    return (
      // Free crop: the upload already carries the student's chosen shape —
      // show it uncropped, height-capped so it can't blow past a page.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={q.field_label} className="h-auto max-h-[3in] w-auto max-w-full rounded-md border border-gray-200 break-inside-avoid" />
    )
  }
  if (typeId === QUESTION_TYPE.CURRENCY) {
    return <p className="text-base tabular-nums">{formatCurrency(text)}</p>
  }
  if (typeId === QUESTION_TYPE.DATE) {
    return <p className="text-[13px]">{formatDate(r.date_response || text)}</p>
  }
  if (typeId === QUESTION_TYPE.URL) {
    // A real anchor: browsers keep the link clickable in the saved PDF.
    const href = text.startsWith("http") ? text : `https://${text}`
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-[13px] text-gray-700 underline decoration-gray-300 underline-offset-2"
      >
        {text}
      </a>
    )
  }
  if (typeId === QUESTION_TYPE.DROPDOWN) {
    return <p className="text-[13px]">{text}</p>
  }
  if (typeId === LINE_ITEMS_TYPE_ID || isLineItemsQuestion(q)) {
    return <LineItemsTable raw={text} />
  }
  if (typeId === RICH_TEXT_TYPE_ID || looksLikeRichTextDoc(text)) {
    return <RichTextDisplay raw={text} className="text-[13px] leading-relaxed" />
  }

  // Brand color answers print as a small swatch chip.
  const color = /colou?r/i.test(q.field_label) ? parseBrandColor(text) : parseExactHex(text)
  if (color) {
    return (
      <span className="inline-flex items-center gap-2 text-[13px]">
        <span className="inline-block size-4 rounded border border-gray-200" style={{ background: color.css }} />
        {color.hex ?? color.css}
      </span>
    )
  }
  if (/font/i.test(q.field_label)) {
    const family = extractFontFamily(text) || brand.primaryFont
    return (
      <p className="text-xl" style={family ? { fontFamily: `"${family}", inherit` } : undefined}>
        {family || text}
      </p>
    )
  }

  return <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-800">{text}</p>
}
