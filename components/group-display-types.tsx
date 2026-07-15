"use client"

import React from "react"
import dynamic from "next/dynamic"
import { Card, CardContent } from "@/components/ui/card"
import { useBrandTheme } from "@/components/brand-display"
import { ZoomableImage } from "@/components/zoomable-image"
import { isLineItemsQuestion, parseLineItemProducts, computeUnitEconomics } from "@/lib/line-items"
import { extractPlainText, looksLikeRichTextDoc } from "@/lib/rich-text"
import { ProductLineItemsTable } from "@/components/line-items-table"

const UnitEconomicsFlow = dynamic(
  () => import("@/components/unit-economics-flow").then((m) => m.UnitEconomicsFlow),
  { ssr: false, loading: () => <div className="h-[380px] w-full animate-pulse rounded-b-xl bg-gray-50" /> }
)
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface TemplateQuestion {
  id: number
  field_name: string
  field_label: string
  sortOrder?: number
  question_types_id?: number | null
  _question_types?: { id: number; type: string; noInput?: boolean }
  public_display_title?: string
  public_display_description?: string
}

interface StudentResponse {
  id: number
  student_response: string
  image_response: { path?: string; url?: string; name?: string; mime?: string } | null
  isComplete?: boolean
  [key: string]: unknown
}

const QUESTION_TYPE_IMAGE = 4
const QUESTION_TYPE_CURRENCY = 3
const QUESTION_TYPE_LONG_TEXT = 1

function resolveImageUrl(path: string | undefined): string {
  if (!path) return ""
  if (path.startsWith("http")) return path
  return `https://xsc3-mvx7-r86m.n7e.xano.io${path}`
}

function getResponse(
  fieldName: string,
  questions: TemplateQuestion[],
  responseMap: Map<number, StudentResponse>
): StudentResponse | undefined {
  const q = questions.find((q) => q.field_name === fieldName)
  if (!q) return undefined
  return responseMap.get(q.id)
}

function getTextValue(
  fieldName: string,
  questions: TemplateQuestion[],
  responseMap: Map<number, StudentResponse>
): string {
  const raw = getResponse(fieldName, questions, responseMap)?.student_response ?? ""
  // Rich-text essays store TipTap JSON; group displays only show plain text
  return looksLikeRichTextDoc(raw) ? extractPlainText(raw) : raw
}

function getImageUrl(
  fieldName: string,
  questions: TemplateQuestion[],
  responseMap: Map<number, StudentResponse>
): string {
  const r = getResponse(fieldName, questions, responseMap)
  // Images only appear on the public page once a teacher approves them
  if (!r?.isComplete) return ""
  const src = r?.image_response?.path || r?.image_response?.url
  return src ? resolveImageUrl(src) : ""
}

// ── Display type constants ──
export const DISPLAY_TYPE = {
  CHART: 1,
  TABLE: 2,
  GALLERY: 3,
  COMPETITOR_MAP: 4,
  GOOGLE_BUDGET: 6,
  TRANSPORTATION_BUDGET: 7,
  UNIT_ECONOMICS: 8,
} as const

export function isGroupDisplayType(typeId: number | null | undefined): boolean {
  if (!typeId) return false
  return Object.values(DISPLAY_TYPE).includes(typeId as typeof DISPLAY_TYPE[keyof typeof DISPLAY_TYPE])
}

export function GroupDisplayRenderer({
  displayTypeId,
  questions,
  responseMap,
  mode = "public",
}: {
  displayTypeId: number
  questions: TemplateQuestion[]
  responseMap: Map<number, StudentResponse>
  mode?: "public" | "teacher" | "student"
}) {
  switch (displayTypeId) {
    case DISPLAY_TYPE.GALLERY:
      return <GalleryDisplay questions={questions} responseMap={responseMap} mode={mode} />
    case DISPLAY_TYPE.COMPETITOR_MAP:
      return <CompetitorMapDisplay questions={questions} responseMap={responseMap} mode={mode} />
    case DISPLAY_TYPE.GOOGLE_BUDGET:
      return <GoogleBudgetDisplay questions={questions} responseMap={responseMap} />
    case DISPLAY_TYPE.TRANSPORTATION_BUDGET:
      return <TransportationBudgetDisplay questions={questions} responseMap={responseMap} />
    case DISPLAY_TYPE.UNIT_ECONOMICS:
      return <UnitEconomicsDisplay questions={questions} responseMap={responseMap} />
    default:
      return null
  }
}

// ── Unit Economics (type 8) ──

/** One diagram per product/service; products without components fall back
    to their summary table. */
function LineItemsFlowStack({ raw }: { raw: string }) {
  const products = parseLineItemProducts(raw).filter((p) => p.rows.length > 0)
  if (products.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm italic">
        No breakdown submitted yet.
      </p>
    )
  }
  return (
    <div className="space-y-6">
      {products.map((p, i) => {
        const econ = computeUnitEconomics(p.rows)
        return (
          <div key={i} className={i > 0 ? "border-t border-gray-100 pt-5" : undefined}>
            {p.name && (
              <div className="mb-1.5">
                <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                  Product / Service
                </p>
                <h4 className="text-foreground text-base font-semibold">{p.name}</h4>
              </div>
            )}
            {econ.components.length > 0 ? (
              <UnitEconomicsFlow
                components={econ.components}
                unitCost={econ.unitCost}
                unitCostDerived={econ.unitCostIsDerived}
                salePrice={econ.unitPrice}
                margin={econ.unitMargin}
                marginDerived={econ.unitMarginIsDerived}
              />
            ) : (
              <ProductLineItemsTable product={p} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function UnitEconomicsDisplay({
  questions,
  responseMap,
}: {
  questions: TemplateQuestion[]
  responseMap: Map<number, StudentResponse>
}) {
  const lineItemsQ = questions.find((q) => isLineItemsQuestion(q))
  const raw = lineItemsQ ? (responseMap.get(lineItemsQ.id)?.student_response ?? "") : ""
  return <LineItemsFlowStack raw={raw} />
}

// ── Gallery (type 3) ──

const QUESTION_TYPE_SHORT_TEXT = 2

export interface GallerySlide {
  imageQ: TemplateQuestion
  titleQ: TemplateQuestion | null
  descQs: TemplateQuestion[]
}

// Slides are derived from the group's questions in sort order rather than
// fixed field names: field names are auto-generated on duplication (e.g.
// image_2_copy_17721534...) and can collide across questions, so they can't
// be relied on. Each image upload starts a slide; a short-text question
// labeled like a name/title attaches to the next image, any other short
// text attaches to the previous image as its description. Questions of any
// other type (e.g. a long response) become intro text above the grid.
export function buildGallerySlides(questions: TemplateQuestion[]): {
  slides: GallerySlide[]
  intro: TemplateQuestion[]
} {
  const sorted = [...questions].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const slides: GallerySlide[] = []
  const intro: TemplateQuestion[] = []
  let pendingTitle: TemplateQuestion | null = null
  let current: GallerySlide | null = null

  for (const q of sorted) {
    const typeId = q.question_types_id ?? q._question_types?.id ?? null
    if (typeId === QUESTION_TYPE_IMAGE) {
      current = { imageQ: q, titleQ: pendingTitle, descQs: [] }
      pendingTitle = null
      slides.push(current)
    } else if (typeId === QUESTION_TYPE_SHORT_TEXT) {
      if (/name|title/i.test(q.field_label)) {
        pendingTitle = q
      } else if (current) {
        current.descQs.push(q)
      }
    } else {
      intro.push(q)
    }
  }
  return { slides, intro }
}

function GalleryDisplay({
  questions,
  responseMap,
}: {
  questions: TemplateQuestion[]
  responseMap: Map<number, StudentResponse>
  mode: string
}) {
  const { slides, intro } = buildGallerySlides(questions)

  const introBlocks = intro
    .map((q) => ({
      key: q.id,
      label: q.public_display_title || q.field_label,
      text: (responseMap.get(q.id)?.student_response ?? "").trim(),
    }))
    .filter((b) => b.text)

  const items = slides.map((s) => {
    const imgResponse = responseMap.get(s.imageQ.id)
    // Only approved images appear on the public page
    const src = imgResponse?.isComplete
      ? imgResponse.image_response?.path || imgResponse.image_response?.url
      : undefined
    return {
      key: s.imageQ.id,
      url: src ? resolveImageUrl(src) : "",
      title: s.titleQ ? (responseMap.get(s.titleQ.id)?.student_response ?? "").trim() : "",
      descriptions: s.descQs
        .map((q) => (responseMap.get(q.id)?.student_response ?? "").trim())
        .filter(Boolean),
    }
  })

  const populated = items.filter((i) => i.url)
  const gridCols = "grid-cols-1 sm:grid-cols-2" + (populated.length >= 3 ? " lg:grid-cols-3" : "")

  if (introBlocks.length === 0 && items.length === 0) return null

  const grid =
    populated.length > 0 ? (
      <div className={`grid items-stretch gap-4 ${gridCols}`}>
        {populated.map((item) => (
          <div key={item.key} className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
            {/* Fixed-ratio image box that never stretches, so every card's
                image is the same height and the titles below line up. */}
            <div className="aspect-[4/3] w-full shrink-0 overflow-hidden">
              <ZoomableImage
                src={item.url}
                alt={item.title || item.descriptions[0] || "Gallery image"}
                imgClassName="h-full w-full object-cover"
                caption={item.title || item.descriptions[0]}
              />
            </div>
            {(item.title || item.descriptions.length > 0) && (
              <div className="flex flex-1 flex-col gap-1 border-t border-gray-200 px-4 py-3">
                {item.title && (
                  <p className="text-lg font-semibold tracking-tight">{item.title}</p>
                )}
                {item.descriptions.map((d, i) => (
                  <p key={i} className="text-muted-foreground text-sm leading-relaxed">
                    {d}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    ) : items.length > 0 ? (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {items.map((i) => (
          <div key={i.key} className="flex aspect-[4/3] items-center justify-center rounded-xl bg-gray-100" />
        ))}
      </div>
    ) : null

  return (
    <div className="space-y-5">
      {introBlocks.map((b) => (
        <div key={b.key}>
          <h4 className="text-muted-foreground text-sm font-medium">{b.label}</h4>
          <p className="text-foreground mt-1 whitespace-pre-wrap text-base font-normal leading-snug">
            {b.text}
          </p>
        </div>
      ))}
      {grid}
    </div>
  )
}

// ── Competitor Map (type 4) ──

interface MapEntity {
  name: string
  logoUrl: string
  x: number
  y: number
  isMine?: boolean
}

export interface CompetitorMapCardData {
  label: string
  entity: MapEntity
  positioning: string
}

export interface CompetitorMapData {
  xAxisLabel: string
  yAxisLabel: string
  entities: MapEntity[]
  cards: CompetitorMapCardData[]
  hasData: boolean
}

/** Field-name-driven extraction of the competitor map's data, shared by the
    public display and the print document. */
export function getCompetitorMapData(
  questions: TemplateQuestion[],
  responseMap: Map<number, StudentResponse>
): CompetitorMapData {
  const xAxisLabel = getTextValue("x_axis_label", questions, responseMap) || "X Axis"
  const yAxisLabel = getTextValue("y_axis_label", questions, responseMap) || "Y Axis"

  const entities: MapEntity[] = [
    {
      name: getTextValue("competitor_1", questions, responseMap),
      logoUrl: getImageUrl("competitor_1_logo", questions, responseMap),
      x: parseFloat(getTextValue("competitor_1_x_coordinate", questions, responseMap)) || 0,
      y: parseFloat(getTextValue("competitor_1_y_coordinate", questions, responseMap)) || 0,
    },
    {
      name: getTextValue("competitor_2", questions, responseMap),
      logoUrl: getImageUrl("competitor_2_logo", questions, responseMap),
      x: parseFloat(getTextValue("competitor_2_x_coordinate", questions, responseMap)) || 0,
      y: parseFloat(getTextValue("competitor_2_y_coordinate", questions, responseMap)) || 0,
    },
    {
      name: getTextValue("competitor_3", questions, responseMap),
      logoUrl: getImageUrl("competitor_3_logo", questions, responseMap),
      x: parseFloat(getTextValue("competitor_3_x_coordinate", questions, responseMap)) || 0,
      y: parseFloat(getTextValue("competitor_3_y_coordinate", questions, responseMap)) || 0,
    },
    {
      name: getTextValue("my_company", questions, responseMap),
      logoUrl: getImageUrl("my_company_logo", questions, responseMap),
      x: parseFloat(getTextValue("mycompany_x_coordinate", questions, responseMap)) || 0,
      y: parseFloat(getTextValue("mycompany_y_coordinate", questions, responseMap)) || 0,
      isMine: true,
    },
  ]

  const labels = [
    { label: "Competitor 1", idx: 0, positioningField: "company_1_positioning" },
    { label: "Competitor 2", idx: 1, positioningField: "company_2_positioning" },
    { label: "Competitor 3", idx: 2, positioningField: "company_3_positioning" },
    { label: "My Company", idx: 3, positioningField: "my_company_positioning" },
  ]

  return {
    xAxisLabel,
    yAxisLabel,
    entities,
    hasData: entities.some((e) => e.name),
    cards: labels.map(({ label, idx, positioningField }) => ({
      label,
      entity: entities[idx],
      positioning: getTextValue(positioningField, questions, responseMap),
    })),
  }
}

/** The framed plot on its own — axis labels, 100×100 grid, entity chips.
    `aspect` widens or squares the plot (the print page uses a full-page
    square; the public page keeps the wide banner). */
export function CompetitorMapPlot({ data, aspect = "3 / 1" }: { data: CompetitorMapData; aspect?: string }) {
  const brand = useBrandTheme()
  const myChipBorder = brand.primary ?? "#111827"
  const { xAxisLabel, yAxisLabel, entities, hasData } = data

  return (
    <>
      {/* Positioning map framed by its axes — a 2-row grid so the Y-axis
          label (row 1, col 1) centers against the plot box height while the
          X-axis label (row 2, col 2) sits centered beneath the grid. The
          100×100 plot therefore falls within both axis labels. */}
      <div className="grid grid-cols-[auto_1fr] gap-x-2 sm:gap-x-3">
        {/* Y axis label — centered against the plot box (grid row 1) */}
        <div className="flex items-center justify-center">
          <span className="rotate-180 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
            {yAxisLabel}
          </span>
        </div>

        {/* Plot grid — y grows upward: low/low bottom-left, high/high top-right */}
        <div className="relative w-full min-w-0 overflow-hidden rounded-xl border bg-white" style={{ aspectRatio: aspect }}>
          {/* Corner quadrant labels */}
          <span className="absolute left-3 top-2 z-10 text-[11px] text-muted-foreground/60">
            High {yAxisLabel} / Low {xAxisLabel}
          </span>
          <span className="absolute right-3 top-2 z-10 text-[11px] text-muted-foreground/60">
            High {yAxisLabel} / High {xAxisLabel}
          </span>
          <span className="absolute bottom-2 left-3 z-10 text-[11px] text-muted-foreground/60">
            Low {yAxisLabel} / Low {xAxisLabel}
          </span>
          <span className="absolute bottom-2 right-3 z-10 text-[11px] text-muted-foreground/60">
            Low {yAxisLabel} / High {xAxisLabel}
          </span>

          {/* Grid lines — quarter grid with an emphasized center cross */}
          {[12.5, 25, 37.5, 50, 62.5, 75, 87.5].map((p) => (
            <div
              key={`v-${p}`}
              className={`absolute top-0 h-full w-px ${p === 50 ? "bg-gray-300" : "bg-gray-100"}`}
              style={{ left: `${p}%` }}
            />
          ))}
          {[25, 50, 75].map((p) => (
            <div
              key={`h-${p}`}
              className={`absolute left-0 h-px w-full ${p === 50 ? "bg-gray-300" : "bg-gray-100"}`}
              style={{ top: `${p}%` }}
            />
          ))}

          {/* Entities: a dot marks the exact coordinate; the name chip floats
              beside it. Coordinates 0–100 map into an inset field (MX/MY) so a
              point at an extreme value stays fully inside the box instead of
              being clipped at the edge. The chip flips below the dot when the
              dot sits near the top so it never runs off. */}
          {hasData && entities.map((entity, idx) => {
            if (!entity.name) return null
            const xPercent = Math.max(0, Math.min(100, entity.x))
            const yPercent = Math.max(0, Math.min(100, entity.y))
            const MX = 26
            const MY = 24
            const fromLeft = `calc(${MX}px + (100% - ${MX * 2}px) * ${xPercent / 100})`
            const fromBottom = `calc(${MY}px + (100% - ${MY * 2}px) * ${yPercent / 100})`
            const fromTop = `calc(${MY}px + (100% - ${MY * 2}px) * ${(100 - yPercent) / 100})`
            const dotNearTop = yPercent >= 55
            const chipStyle: React.CSSProperties = dotNearTop
              ? {
                  left: `clamp(92px, ${fromLeft}, calc(100% - 92px))`,
                  top: `min(calc(${fromTop} + 12px), calc(100% - 40px))`,
                }
              : {
                  left: `clamp(92px, ${fromLeft}, calc(100% - 92px))`,
                  bottom: `min(calc(${fromBottom} + 12px), calc(100% - 40px))`,
                }
            return (
              <React.Fragment key={idx}>
                <div
                  className="absolute z-20 -translate-x-1/2 translate-y-1/2"
                  style={{ left: fromLeft, bottom: fromBottom }}
                >
                  <span
                    className="block size-3 rounded-full border-2 border-white shadow-md"
                    style={{ background: entity.isMine ? myChipBorder : "#9CA3AF" }}
                  />
                </div>
                <div className="absolute z-10 -translate-x-1/2" style={chipStyle}>
                  <div
                    title={entity.name}
                    className={`flex max-w-[170px] items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-2.5 shadow-sm ${
                      entity.isMine ? "border-2" : "border border-gray-200"
                    }`}
                    style={entity.isMine ? { borderColor: myChipBorder } : undefined}
                  >
                    {entity.logoUrl ? (
                      <div className="size-6 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white">
                        <img
                          src={entity.logoUrl}
                          alt={entity.name}
                          className="size-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600">
                        {entity.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="truncate text-xs font-medium text-gray-700">
                      {entity.name}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            )
          })}
        </div>

        {/* X axis label — row 2 under the plot column, centered on the grid */}
        <div className="col-start-2 mt-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {xAxisLabel}
        </div>
      </div>
    </>
  )
}

function CompetitorMapDisplay({
  questions,
  responseMap,
}: {
  questions: TemplateQuestion[]
  responseMap: Map<number, StudentResponse>
  mode: string
}) {
  const data = getCompetitorMapData(questions, responseMap)
  return (
    <div className="space-y-5">
      <CompetitorMapPlot data={data} />

      {/* Company cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data.cards.map(({ label, entity, positioning }, idx) => {
          return (
            <Card key={idx} className="gap-0 border-gray-200 py-0 shadow-none">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {entity.logoUrl ? (
                    <div className="size-8 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white">
                      <img src={entity.logoUrl} alt={entity.name || label} className="size-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500">
                      {(entity.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {entity.name || "—"}
                    </p>
                    <p className="text-muted-foreground text-[10px]">{label}</p>
                  </div>
                </div>
                {positioning && (
                  <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-xs leading-relaxed">
                    {positioning}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ── Google Budget Sheet (type 6) ──

function toGoogleEmbedUrl(url: string): string {
  if (!url) return ""
  const trimmed = url.trim()
  const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (match) {
    const gid = trimmed.match(/gid=(\d+)/)
    return `https://docs.google.com/spreadsheets/d/${match[1]}/htmlview${gid ? `?gid=${gid[1]}` : ""}`
  }
  return trimmed
}

export function getGoogleSheetUrl(
  questions: TemplateQuestion[],
  responseMap: Map<number, StudentResponse>
): string {
  return getTextValue("google_sheet_url", questions, responseMap)
}

export function GoogleSheetOpenButton({ url }: { url: string }) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
    >
      Open Spreadsheet
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
    </a>
  )
}

function GoogleBudgetDisplay({
  questions,
  responseMap,
}: {
  questions: TemplateQuestion[]
  responseMap: Map<number, StudentResponse>
}) {
  const brand = useBrandTheme()
  const sheetUrl = getTextValue("google_sheet_url", questions, responseMap)
  const summary = getTextValue("google_sheet_summary", questions, responseMap)
  const embedUrl = toGoogleEmbedUrl(sheetUrl)

  const tableQuestions = questions.filter(
    (q) => q.field_name !== "google_sheet_url" && q.field_name !== "google_sheet_summary"
  )

  // A Line Items response feeds the unit economics diagrams rather than
  // tiles or table rows.
  const lineItemsQ = questions.find((q) => isLineItemsQuestion(q))
  const lineItemsRaw = lineItemsQ ? (responseMap.get(lineItemsQ.id)?.student_response ?? "") : ""
  const showFlow = parseLineItemProducts(lineItemsRaw).some((p) => p.rows.length > 0)

  type Section = { header: string; rows: { label: string; value: string; typeId: number | null }[] }
  const sections: Section[] = []
  const statTiles: { label: string; value: string }[] = []
  const narratives: { label: string; value: string }[] = []
  let current: Section | null = null

  for (const q of tableQuestions) {
    if (isLineItemsQuestion(q)) continue
    const isTextHeader = q._question_types?.noInput === true
    if (isTextHeader) {
      current = { header: q.public_display_title || q.field_label, rows: [] }
      sections.push(current)
    } else {
      const value = getTextValue(q.field_name, questions, responseMap)
      const label = q.public_display_title || q.field_label
      const typeId = q.question_types_id ?? q._question_types?.id ?? null
      // Currency questions render as stat tiles instead of table rows; the
      // per-unit trio moves into the diagram when components exist.
      if (typeId === QUESTION_TYPE_CURRENCY) {
        if (!(showFlow && /^per_unit_(price|cost|margin)$/.test(q.field_name))) {
          statTiles.push({ label, value })
        }
        continue
      }
      // Long-form answers read as prose blocks after the summary, not table rows
      if (typeId === QUESTION_TYPE_LONG_TEXT) {
        if (value) narratives.push({ label, value })
        continue
      }
      if (!current) {
        current = { header: "", rows: [] }
        sections.push(current)
      }
      current.rows.push({ label, value, typeId })
    }
  }
  const populatedSections = sections.filter((s) => s.rows.length > 0 || s.header)

  return (
    <div className="space-y-0">
      {embedUrl ? (
        <div className="h-[500px] w-full overflow-hidden">
          <iframe
            src={embedUrl}
            title="Google Budget Sheet"
            className="w-full border-0"
            style={{ height: "calc(100% + 56px)", marginTop: "-56px" }}
          />
        </div>
      ) : (
        <div className="flex h-[300px] items-center justify-center bg-gray-50 text-sm text-muted-foreground">
          No budget sheet linked
        </div>
      )}

      {showFlow && (
        <div className="border-t px-5 py-4">
          <LineItemsFlowStack raw={lineItemsRaw} />
        </div>
      )}

      {statTiles.length > 0 && (
        <div className="grid gap-3 border-t px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {statTiles.map((tile, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-3.5">
              <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                {tile.label}
              </p>
              <p className="text-foreground mt-1 text-2xl font-bold tracking-tight tabular-nums">
                {formatUSD(tile.value)}
              </p>
              <div
                className="mt-2.5 h-0.5 rounded"
                style={{ background: brand.primary ?? "#E5E7EB" }}
              />
            </div>
          ))}
        </div>
      )}

      {populatedSections.length > 0 && (
        <div className="border-t">
          <Table>
            {populatedSections.map((section, sIdx) => (
              <React.Fragment key={sIdx}>
                {section.header && (
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead colSpan={2} className="text-xs font-semibold uppercase tracking-wide">
                        {section.header}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                )}
                <TableBody>
                  {section.rows.map((row, rIdx) => (
                    <TableRow key={rIdx}>
                      <TableCell className="text-muted-foreground w-1/3 text-sm">{row.label}</TableCell>
                      <TableCell className="whitespace-pre-wrap text-sm font-semibold">
                        {row.typeId === QUESTION_TYPE_CURRENCY ? formatUSD(row.value) : row.value || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </React.Fragment>
            ))}
          </Table>
        </div>
      )}

      {(summary || narratives.length > 0) && (
        <div className="space-y-5 border-t px-5 py-4">
          {summary && (() => {
            const summaryQ = questions.find((q) => q.field_name === "google_sheet_summary")
            const label = summaryQ?.public_display_title || summaryQ?.field_label || "Summary"
            return (
              <div>
                <h4 className="text-muted-foreground text-sm font-medium">{label}</h4>
                <p className="text-foreground mt-1 whitespace-pre-wrap text-base font-normal leading-snug">
                  {summary}
                </p>
              </div>
            )
          })()}
          {narratives.map((n, i) => (
            <div key={i}>
              <h4 className="text-muted-foreground text-sm font-medium">{n.label}</h4>
              <p className="text-foreground mt-1 whitespace-pre-wrap text-base font-normal leading-snug">
                {n.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Transportation Budget (type 7) ──

const TRANSPORT_LAYOUT: { header: string; fields: string[] }[] = [
  {
    header: "Monthly Expenses",
    fields: ["insurance_amount", "gas", "maintenance", "total_monthly_cost"],
  },
  {
    header: "One Time Expenses",
    fields: ["initial_insurance", "tax_title_license", "total_one_time"],
  },
]

function formatUSD(raw: string): string {
  if (!raw) return "—"
  const num = parseFloat(raw.replace(/[^0-9.-]/g, ""))
  if (isNaN(num)) return raw
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function TransportationBudgetDisplay({
  questions,
  responseMap,
}: {
  questions: TemplateQuestion[]
  responseMap: Map<number, StudentResponse>
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        {TRANSPORT_LAYOUT.map((section, sIdx) => {
          const rows = section.fields.map((fieldName) => {
            const q = questions.find((q) => q.field_name === fieldName)
            const label = q?.public_display_title || q?.field_label || fieldName
            const value = getTextValue(fieldName, questions, responseMap)
            return { label, value }
          })

          return (
            <React.Fragment key={sIdx}>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead colSpan={2} className="text-xs font-semibold uppercase tracking-wide">
                    {section.header}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, rIdx) => (
                  <TableRow key={rIdx}>
                    <TableCell className="text-muted-foreground w-1/2 py-2 text-sm">{row.label}</TableCell>
                    <TableCell className="py-2 text-sm font-semibold">{formatUSD(row.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </React.Fragment>
          )
        })}
      </Table>
    </div>
  )
}
