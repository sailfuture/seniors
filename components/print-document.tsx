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

/** Questions worth printing in a generic grid: approved answers, plus any
    noInput text header that still has printable content following it —
    orphaned subheaders are dropped. */
function printableGridQuestions(
  questions: TemplateQuestion[],
  responseMap: Map<number, StudentResponse>
): TemplateQuestion[] {
  const out: TemplateQuestion[] = []
  let pendingHeader: TemplateQuestion | null = null
  for (const q of questions) {
    if (q._question_types?.noInput) {
      pendingHeader = q
      continue
    }
    if (typeIdOf(q) === QUESTION_TYPE.SOURCE) continue
    if (!hasContent(q, responseMap.get(q.id))) continue
    if (pendingHeader) {
      out.push(pendingHeader)
      pendingHeader = null
    }
    out.push(q)
  }
  return out
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
  const [yearGroup, setYearGroup] = useState("")
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [sectionsRes, templateRes, responsesRes, groupsRes, studentsRes] = await Promise.all([
        fetch(cfg.sectionsEndpoint),
        fetch(cfg.templateEndpoint),
        fetch(`${cfg.responsesEndpoint}?students_id=${studentId}`),
        fetch(cfg.customGroupEndpoint),
        fetch(STUDENTS_ENDPOINT),
      ])
      if (sectionsRes.ok) {
        const data: SectionInfo[] = await sectionsRes.json()
        setSections(data.filter((s) => !s.isLocked).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      }
      if (templateRes.ok) {
        const data: TemplateQuestion[] = await templateRes.json()
        setTemplates(data.filter((q) => !q.isArchived && q.isPublished))
      }
      if (responsesRes.ok) {
        const data: StudentResponse[] = await responsesRes.json()
        // Belt-and-suspenders: re-filter by student even if the endpoint does.
        setResponses(data.filter((r) => !r.isArchived && String(r.students_id ?? "") === String(studentId)))
      }
      if (groupsRes.ok) setGroups(await groupsRes.json())
      if (studentsRes.ok) {
        const students: { id: string; firstName: string; lastName: string; yearGroup?: string }[] =
          await studentsRes.json()
        const match = students.find((s) => String(s.id) === String(studentId))
        if (match) {
          setStudentName(`${match.firstName} ${match.lastName}`)
          if (match.yearGroup) setYearGroup(match.yearGroup)
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

        const ungroupedWithContent = ungrouped.filter((q) => hasContent(q, responseMap.get(q.id)))
        const groupBlocks = sectionGroups
          .map((g) => {
            const qs = byGroup.get(g.id) ?? []
            const printable = qs.some((q) => hasContent(q, responseMap.get(q.id)))
            return printable ? { group: g, questions: qs } : null
          })
          .filter((g): g is { group: CustomGroup; questions: TemplateQuestion[] } => !!g)

        // Every section prints — an empty one keeps its page and header so
        // the document always shows the full outline.
        return { section, ungrouped: ungroupedWithContent, groupBlocks }
      })
  }, [sections, templates, groups, responseMap, F.sectionId, F.customGroupId])

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
                className="mb-8 size-20 rounded-full border border-gray-200 object-cover"
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
              {yearGroup && <p>SailFuture Academy · {yearGroup}</p>}
              {lastEdited && (
                <p>
                  Updated{" "}
                  {lastEdited.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          </div>

          <div>
            {printSections.length > 0 && (
              <div className="border-t border-gray-200 pt-6">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Contents</p>
                <ol className="columns-2 gap-10 text-sm leading-7 text-gray-700">
                  {printSections.map(({ section }, i) => (
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
          printSections={printSections}
          responseMap={responseMap}
          brand={brand}
          accent={accent}
          titleFont={titleFont}
          displayTypesField={F.displayTypesId}
          title={title}
          docLabel={docLabel}
        />

        {printSections.length === 0 && (
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
  displayTypesField: string
): PrintBlock[] {
  const base = `s${sectionId}-g${group.id}`
  const displayTypeId = Number(group[displayTypesField]) || null
  const hasApprovedImage = questions.some(
    (q) => typeIdOf(q) === QUESTION_TYPE.IMAGE_UPLOAD && hasContent(q, responseMap.get(q.id))
  )

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
    // A square plot fills the page on its own — the graph gets a full page.
    bodies.push({
      id: `${base}-plot`,
      node: (
        <div className="break-inside-avoid">
          <CompetitorMapPlot data={data} aspect="1 / 1" />
        </div>
      ),
    })
    // Cards travel in stacked pairs: two per page minimum, four when the
    // positioning text is short enough for both pairs to share a page.
    const cardsData = data.cards.filter((c) => c.entity.name || c.positioning)
    for (let i = 0; i < cardsData.length; i += 2) {
      bodies.push({
        id: `${base}-cards${i}`,
        node: (
          <div className="space-y-4">
            {cardsData.slice(i, i + 2).map((c) => (
              <div key={c.label} className="rounded-lg border border-gray-200 p-4 break-inside-avoid">
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
                {c.positioning && (
                  // Clamped so a pair always fits one page.
                  <p className="mt-2.5 line-clamp-[16] whitespace-pre-wrap text-[12px] leading-relaxed text-gray-600">
                    {c.positioning}
                  </p>
                )}
              </div>
            ))}
          </div>
        ),
      })
    }
  } else if (displayTypeId === DISPLAY_TYPE.GALLERY && hasApprovedImage) {
    // The slides are built from — and return — this module's own question
    // objects; the cast just restores their wider type.
    const { slides, intro } = buildGallerySlides(questions) as unknown as {
      slides: { imageQ: TemplateQuestion; titleQ: TemplateQuestion | null; descQs: TemplateQuestion[] }[]
      intro: TemplateQuestion[]
    }
    buildQuestionRows(
      intro.filter((q) => hasContent(q, responseMap.get(q.id))),
      responseMap,
      brand
    ).forEach((node, i) => bodies.push({ id: `${base}-intro${i}`, node }))
    const cards = slides
      .map((s) => {
        const r = responseMap.get(s.imageQ.id)
        const src = r?.isComplete ? r.image_response?.path || r.image_response?.url : undefined
        if (!src) return null
        const cardTitle = s.titleQ ? (responseMap.get(s.titleQ.id)?.student_response ?? "").trim() : ""
        const desc =
          s.descQs.map((dq) => (responseMap.get(dq.id)?.student_response ?? "").trim()).filter(Boolean)[0] ?? ""
        return { key: s.imageQ.id, src: resolveImageUrl(src), cardTitle, desc }
      })
      .filter((c): c is { key: number; src: string; cardTitle: string; desc: string } => !!c)
    // A whole image set stays together on one page: 3-across cropped cards
    // with clamped captions keep even 9 images inside a single page block.
    for (let i = 0; i < cards.length; i += 9) {
      bodies.push({
        id: `${base}-imgs${i}`,
        node: (
          <div className="grid grid-cols-3 gap-4">
            {cards.slice(i, i + 9).map((c) => (
              <div key={c.key} className="overflow-hidden rounded-lg border border-gray-200 break-inside-avoid">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.src} alt={c.cardTitle || "Gallery image"} className="aspect-[4/3] w-full object-cover" />
                {(c.cardTitle || c.desc) && (
                  <div className="border-t border-gray-200 px-2.5 py-1.5">
                    {c.cardTitle && <p className="truncate text-[11px] font-semibold">{c.cardTitle}</p>}
                    {c.desc && <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-gray-500">{c.desc}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
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
    const printable = printableGridQuestions(questions, responseMap)
    const imgQs = printable.filter((q) => typeIdOf(q) === QUESTION_TYPE.IMAGE_UPLOAD)
    const textQs = printable.filter(
      (q) => !q._question_types?.noInput && typeIdOf(q) !== QUESTION_TYPE.IMAGE_UPLOAD
    )
    // Small text+image groups (a messaging location, say) compress to one
    // media block — texts stacked and clamped on the left, image on the
    // right — so a family of them shares a single page.
    const compactMedia =
      imgQs.length >= 1 &&
      textQs.length >= 1 &&
      textQs.length <= 3 &&
      printable.length === imgQs.length + textQs.length
    if (compactMedia) {
      bodies.push({
        id: `${base}-media`,
        node: (
          <div className="grid grid-cols-2 items-start gap-x-10">
            <div className="space-y-3 break-inside-avoid">
              {textQs.map((q) => {
                const r = responseMap.get(q.id)!
                const raw = r.student_response ?? ""
                const txt = looksLikeRichTextDoc(raw) ? extractPlainText(raw) : raw
                return (
                  <div key={q.id}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {q.public_display_title || q.field_label}
                    </p>
                    <p className="line-clamp-3 whitespace-pre-wrap text-[12px] leading-relaxed text-gray-800">{txt}</p>
                  </div>
                )
              })}
            </div>
            <div className="space-y-3 break-inside-avoid">
              {imgQs.slice(0, 2).map((q) => {
                const r = responseMap.get(q.id)!
                const src = resolveImageUrl(r.image_response?.path || r.image_response?.url)
                return (
                  <div key={q.id}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {q.public_display_title || q.field_label}
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={q.field_label}
                      className="aspect-video w-full rounded-md border border-gray-200 object-cover"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ),
      })
      if (imgQs.length > 2) {
        buildQuestionRows(imgQs.slice(2), responseMap, brand, true).forEach((node, i) =>
          bodies.push({ id: `${base}-xrow${i}`, node })
        )
      }
    } else if (imgQs.length >= 3 && textQs.length === 0) {
      // Image-only groups (reference images) print as one 3-across grid
      // block so the whole set shares a page.
      for (let i = 0; i < imgQs.length; i += 9) {
        bodies.push({
          id: `${base}-igrid${i}`,
          node: (
            <div className="grid grid-cols-3 gap-4">
              {imgQs.slice(i, i + 9).map((q) => {
                const r = responseMap.get(q.id)!
                const src = resolveImageUrl(r.image_response?.path || r.image_response?.url)
                return (
                  <div key={q.id} className="overflow-hidden rounded-lg border border-gray-200 break-inside-avoid">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={q.field_label} className="aspect-[4/3] w-full object-cover" />
                  </div>
                )
              })}
            </div>
          ),
        })
      }
    } else {
      buildQuestionRows(printable, responseMap, brand, true).forEach((node, i) =>
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
          id: b.id,
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

function QuestionCell({
  q,
  r,
  brand,
  half,
  cropImage = false,
}: {
  q: TemplateQuestion
  r: StudentResponse
  brand: BrandTheme
  half: boolean
  cropImage?: boolean
}) {
  return (
    <div className={`${half ? "" : "col-span-2"} break-inside-avoid`}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {q.public_display_title || q.field_label}
      </p>
      <PrintValue q={q} r={r} brand={brand} cropImage={cropImage} />
    </div>
  )
}

/** Pack the ungrouped questions into row nodes (pairs of half-width cells,
    or one full-width cell) so the paginator can measure and place each row. */
function buildQuestionRows(
  questions: TemplateQuestion[],
  responseMap: Map<number, StudentResponse>,
  brand: BrandTheme,
  /** Group mode: pair a long text with its neighboring image side by side
      (text clamped, image cropped) so text+image groups fit one page. */
  compact = false
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
            r={responseMap.get(q.id)!}
            brand={brand}
            half={isHalfCell(q, responseMap.get(q.id))}
            cropImage={compact}
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
    if ((typeId === RICH_TEXT_TYPE_ID || looksLikeRichTextDoc(text)) && !isHalfCell(q, r)) {
      flushPending()
      const nodes = (parseRichText(text)?.content ?? []) as unknown[]
      if (nodes.length > 1) {
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
    // Compact groups: a paragraph answer followed by its image prints as one
    // side-by-side row — clamped text, cropped image — so a text+image group
    // (e.g. a messaging location) fits on a single page.
    const next = questions[qi + 1]
    if (
      compact &&
      !isHalfCell(q, r) &&
      typeIdOf(q) !== QUESTION_TYPE.IMAGE_UPLOAD &&
      next &&
      typeIdOf(next) === QUESTION_TYPE.IMAGE_UPLOAD &&
      hasContent(next, responseMap.get(next.id))
    ) {
      flushPending()
      const imgR = responseMap.get(next.id)!
      const src = resolveImageUrl(imgR.image_response?.path || imgR.image_response?.url)
      rows.push(
        <div key={`pair-${q.id}-${next.id}`} className="grid grid-cols-2 items-start gap-x-10">
          <div className="break-inside-avoid">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {q.public_display_title || q.field_label}
            </p>
            <p className="line-clamp-[8] whitespace-pre-wrap text-[13px] leading-relaxed text-gray-800">{text}</p>
          </div>
          <div className="break-inside-avoid">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {next.public_display_title || next.field_label}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={next.field_label}
              className="aspect-video w-full rounded-md border border-gray-200 object-cover"
            />
          </div>
        </div>
      )
      qi++
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
const PAGE_BUDGET = 820
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
}: {
  printSections: { section: SectionInfo; ungrouped: TemplateQuestion[]; groupBlocks: { group: CustomGroup; questions: TemplateQuestion[] }[] }[]
  responseMap: Map<number, StudentResponse>
  brand: BrandTheme
  accent: string
  titleFont?: React.CSSProperties
  displayTypesField: string
  title: string
  docLabel: string
}) {
  const measureRef = useRef<HTMLDivElement | null>(null)
  // The layout is keyed to the block list it was measured from, so new
  // content automatically derives back to "not measured yet" — no reset
  // effect needed.
  const [layout, setLayout] = useState<{ source: unknown; pages: PageSpec[] } | null>(null)

  const sectionsBlocks = useMemo(() => {
    return printSections.map(({ section, ungrouped, groupBlocks }, i) => {
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
      // form a family the paginator tries to keep on a single page.
      const famKeyOf = (name: string) => name.split(":")[0].trim().toLowerCase().replace(/s$/, "")
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
          displayTypesField
        )
        blocks.push(
          ...(inRun ? gBlocks.map((b) => ({ ...b, familyKey: `s${section.id}-${famKeys[gi]}` })) : gBlocks)
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
  }, [printSections, responseMap, brand, accent, titleFont, displayTypesField, docLabel])

  const blockById = useMemo(() => {
    const m = new Map<string, React.ReactNode>()
    for (const s of sectionsBlocks) for (const b of s.blocks) m.set(b.id, b.node)
    return m
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

function PrintValue({
  q,
  r,
  brand,
  cropImage = false,
}: {
  q: TemplateQuestion
  r: StudentResponse
  brand: BrandTheme
  cropImage?: boolean
}) {
  const typeId = typeIdOf(q)
  const text = r.student_response ?? ""

  if (typeId === QUESTION_TYPE.IMAGE_UPLOAD) {
    const src = resolveImageUrl(r.image_response?.path || r.image_response?.url)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={q.field_label}
        className={`w-full rounded-md border border-gray-200 break-inside-avoid ${cropImage ? "aspect-video object-cover" : ""}`}
      />
    )
  }
  if (typeId === QUESTION_TYPE.CURRENCY) {
    return <p className="text-base tabular-nums">{formatCurrency(text)}</p>
  }
  if (typeId === QUESTION_TYPE.DATE) {
    return <p className="text-[13px]">{formatDate(r.date_response || text)}</p>
  }
  if (typeId === QUESTION_TYPE.URL) {
    return <p className="break-all text-[13px] text-gray-700 underline decoration-gray-300 underline-offset-2">{text}</p>
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
