"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import { GroupDisplayRenderer, DISPLAY_TYPE } from "@/components/group-display-types"
import { LineItemsTable } from "@/components/line-items-table"
import { isLineItemsQuestion, LINE_ITEMS_TYPE_ID } from "@/lib/line-items"
import { RichTextDisplay } from "@/components/form/rich-text-display"
import { RICH_TEXT_TYPE_ID, looksLikeRichTextDoc } from "@/lib/rich-text"
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

        if (ungroupedWithContent.length === 0 && groupBlocks.length === 0) return null
        return { section, ungrouped: ungroupedWithContent, groupBlocks }
      })
      .filter((s): s is NonNullable<typeof s> => !!s)
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
      {/* Letter sizing lives here, not in globals.css: the rule only exists
          while a print route is mounted, so printing any other app page keeps
          the browser's default paper. (Lightning CSS strips named @page
          rules, so a stylesheet-scoped version isn't possible.) */}
      <style>{`@page { size: letter; margin: 0.75in; }`}</style>
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

        {/* ── Sections ── */}
        {printSections.map(({ section, ungrouped, groupBlocks }, i) => (
          <section
            key={section.id}
            className="break-before-page bg-white p-[0.75in] shadow-md ring-1 ring-black/5 print:p-0 print:shadow-none print:ring-0"
          >
            <header className="mb-7 border-b border-gray-200 pb-5">
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

            {ungrouped.length > 0 && (
              <div className="mb-8">
                <QuestionGrid questions={ungrouped} responseMap={responseMap} brand={brand} />
              </div>
            )}

            {groupBlocks.map(({ group, questions }) => (
              <GroupBlock
                key={group.id}
                group={group}
                questions={questions}
                responseMap={responseMap}
                brand={brand}
                accent={accent}
                displayTypesField={F.displayTypesId}
              />
            ))}
          </section>
        ))}

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

function GroupBlock({
  group,
  questions,
  responseMap,
  brand,
  accent,
  displayTypesField,
}: {
  group: CustomGroup
  questions: TemplateQuestion[]
  responseMap: Map<number, StudentResponse>
  brand: BrandTheme
  accent: string
  displayTypesField: string
}) {
  const displayTypeId = Number(group[displayTypesField]) || null
  const sourceEntries = questions
    .map((q) => ({ q, r: responseMap.get(q.id) }))
    .filter(
      ({ q, r }) =>
        typeIdOf(q) === QUESTION_TYPE.SOURCE &&
        r?.isComplete &&
        (r.source_link || r.title_of_source || r.author_name_or_publisher)
    )

  // Only these display types have a renderer that prints faithfully; a
  // gallery without a single approved image would print placeholder boxes,
  // so it falls back to the generic grid (approved text only) too. Anything
  // else — including CHART/TABLE, which the screen renderer doesn't draw
  // either, and Google Budget's iframe — prints its underlying answers.
  const hasApprovedImage = questions.some(
    (q) => typeIdOf(q) === QUESTION_TYPE.IMAGE_UPLOAD && hasContent(q, responseMap.get(q.id))
  )
  const printRendered =
    displayTypeId === DISPLAY_TYPE.COMPETITOR_MAP ||
    displayTypeId === DISPLAY_TYPE.TRANSPORTATION_BUDGET ||
    (displayTypeId === DISPLAY_TYPE.GALLERY && hasApprovedImage)

  let body: React.ReactNode
  if (displayTypeId === DISPLAY_TYPE.UNIT_ECONOMICS) {
    // The interactive flow diagram becomes its printable table equivalent.
    const lineItemsQ = questions.find((q) => isLineItemsQuestion(q))
    const raw = lineItemsQ ? (responseMap.get(lineItemsQ.id)?.student_response ?? "") : ""
    body = <LineItemsTable raw={raw} />
  } else if (printRendered) {
    body = (
      <GroupDisplayRenderer
        displayTypeId={displayTypeId!}
        questions={questions}
        responseMap={responseMap}
        mode="public"
      />
    )
  } else {
    body = (
      <QuestionGrid
        questions={printableGridQuestions(questions, responseMap)}
        responseMap={responseMap}
        brand={brand}
      />
    )
  }

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center gap-2.5 break-after-avoid">
        <span className="h-4 w-1 rounded-full" style={{ background: accent }} />
        <h3 className="text-lg font-semibold tracking-tight">{group.group_name}</h3>
      </div>
      {group.group_description && (
        <p className="-mt-2 mb-4 text-xs leading-relaxed text-gray-500">{group.group_description}</p>
      )}
      {body}
      {sourceEntries.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-gray-400">Sources</p>
          {sourceEntries.map(({ q, r }) => (
            <p key={q.id} className="text-[11px] leading-snug text-gray-500">
              {citationLine(r!)}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function QuestionGrid({
  questions,
  responseMap,
  brand,
}: {
  questions: TemplateQuestion[]
  responseMap: Map<number, StudentResponse>
  brand: BrandTheme
}) {
  return (
    <div className="grid grid-cols-2 gap-x-10 gap-y-6">
      {questions.map((q) => {
        const typeId = typeIdOf(q)
        if (q._question_types?.noInput) {
          return (
            <p
              key={q.id}
              className="col-span-2 border-b border-gray-100 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 break-after-avoid"
            >
              {q.public_display_title || q.field_label}
            </p>
          )
        }
        const r = responseMap.get(q.id)
        if (!hasContent(q, r)) return null
        const short = isShortType(typeId) && typeId !== null
        return (
          <div key={q.id} className={`${short ? "" : "col-span-2"} break-inside-avoid`}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {q.public_display_title || q.field_label}
            </p>
            <PrintValue q={q} r={r!} brand={brand} />
          </div>
        )
      })}
    </div>
  )
}

function PrintValue({ q, r, brand }: { q: TemplateQuestion; r: StudentResponse; brand: BrandTheme }) {
  const typeId = typeIdOf(q)
  const text = r.student_response ?? ""

  if (typeId === QUESTION_TYPE.IMAGE_UPLOAD) {
    const src = resolveImageUrl(r.image_response?.path || r.image_response?.url)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={q.field_label} className="max-h-[4in] w-auto max-w-full rounded-md border border-gray-200 break-inside-avoid" />
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
