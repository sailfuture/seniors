"use client"

import React from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"

interface TemplateQuestion {
  id: number
  field_name: string
  field_label: string
  question_types_id?: number | null
  _question_types?: { id: number; type: string }
  public_display_title?: string
  public_display_description?: string
}

interface StudentResponse {
  id: number
  lifemap_template_id: number
  student_response: string
  image_response: { path?: string; url?: string; name?: string; mime?: string } | null
  isComplete?: boolean
}

const QUESTION_TYPE_IMAGE = 4

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
  return getResponse(fieldName, questions, responseMap)?.student_response ?? ""
}

function getImageUrl(
  fieldName: string,
  questions: TemplateQuestion[],
  responseMap: Map<number, StudentResponse>
): string {
  const r = getResponse(fieldName, questions, responseMap)
  const src = r?.image_response?.path || r?.image_response?.url
  return src ? resolveImageUrl(src) : ""
}

// ── Display type constants ──
export const DISPLAY_TYPE = {
  CHART: 1,
  TABLE: 2,
  GALLERY: 3,
  COMPETITOR_MAP: 4,
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
    default:
      return null
  }
}

// ── Gallery (type 3) ──

function GalleryDisplay({
  questions,
  responseMap,
}: {
  questions: TemplateQuestion[]
  responseMap: Map<number, StudentResponse>
  mode: string
}) {
  const imageFields = ["gallery_image_1", "gallery_image_2", "gallery_image_3", "gallery_image_4"]

  const images = imageFields.map((field) => {
    const q = questions.find((q) => q.field_name === field)
    const url = getImageUrl(field, questions, responseMap)
    const label = q?.public_display_title || q?.field_label || ""
    return { url, label, field }
  })

  const hasAnyImage = images.some((img) => img.url)
  if (!hasAnyImage) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {images.map((img) => (
          <div
            key={img.field}
            className="flex min-h-[160px] items-center justify-center rounded-xl bg-gray-100"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {images.map((img) => (
        <Card key={img.field} className="gap-0 border-gray-200 py-0 shadow-none">
          <CardContent className="p-0">
            {img.url ? (
              <img
                src={img.url}
                alt={img.label || "Gallery image"}
                className="aspect-square w-full rounded-t-xl object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-t-xl bg-gray-100" />
            )}
          </CardContent>
          {img.label && (
            <CardFooter className="border-t-0 bg-white px-3 py-2">
              <p className="text-muted-foreground text-xs">{img.label}</p>
            </CardFooter>
          )}
        </Card>
      ))}
    </div>
  )
}

// ── Competitor Map (type 4) ──

interface MapEntity {
  name: string
  logoUrl: string
  x: number
  y: number
}

function CompetitorMapDisplay({
  questions,
  responseMap,
}: {
  questions: TemplateQuestion[]
  responseMap: Map<number, StudentResponse>
  mode: string
}) {
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
    },
  ]

  const hasData = entities.some((e) => e.name)

  const labels = [
    { label: "Competitor 1", idx: 0, positioningField: "company_1_positioning" },
    { label: "Competitor 2", idx: 1, positioningField: "company_2_positioning" },
    { label: "Competitor 3", idx: 2, positioningField: "company_3_positioning" },
    { label: "My Company", idx: 3, positioningField: "my_company_positioning" },
  ]

  return (
    <div className="space-y-5">
      {/* Map */}
      <div className="relative w-full overflow-hidden rounded-xl border bg-white" style={{ aspectRatio: "3.5 / 1" }}>
        {/* Corner quadrant labels */}
        <span className="absolute left-3 top-2 z-10 text-[11px] text-muted-foreground/60">
          Low {yAxisLabel} / Low {xAxisLabel}
        </span>
        <span className="absolute right-3 top-2 z-10 text-[11px] text-muted-foreground/60">
          Low {yAxisLabel} / High {xAxisLabel}
        </span>
        <span className="absolute bottom-2 left-3 z-10 text-[11px] text-muted-foreground/60">
          High {yAxisLabel} / Low {xAxisLabel}
        </span>
        <span className="absolute bottom-2 right-3 z-10 text-[11px] text-muted-foreground/60">
          High {yAxisLabel} / High {xAxisLabel}
        </span>

        {/* Cross lines */}
        <div className="absolute left-1/2 top-0 h-full w-px bg-gray-200" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-gray-200" />

        {/* Axis labels – rendered after lines so they sit on top */}
        <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 bg-white px-2 text-xs font-medium text-muted-foreground">
          {xAxisLabel}
        </div>
        <div className="absolute left-2 top-1/2 z-10 origin-center -translate-y-1/2 -rotate-90 whitespace-nowrap bg-white px-2 text-xs font-medium text-muted-foreground">
          {yAxisLabel}
        </div>

        {/* Entities plotted on chart */}
        {hasData && entities.filter((e) => e.name).map((entity, idx) => {
          const xPercent = Math.max(5, Math.min(95, entity.x))
          const yPercent = Math.max(5, Math.min(95, entity.y))
          return (
            <div
              key={idx}
              className="absolute -translate-x-1/2 translate-y-1/2"
              style={{
                left: `${xPercent}%`,
                bottom: `${yPercent}%`,
              }}
            >
              <div className="flex flex-col items-center gap-0.5">
                {entity.logoUrl ? (
                  <div className="size-9 overflow-hidden rounded-full border border-gray-200 bg-white shadow-sm">
                    <img
                      src={entity.logoUrl}
                      alt={entity.name}
                      className="size-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex size-9 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 shadow-sm">
                    {entity.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="max-w-[90px] truncate text-[10px] font-medium text-gray-600">
                  {entity.name}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Company cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {labels.map(({ label, idx, positioningField }) => {
          const entity = entities[idx]
          const positioning = getTextValue(positioningField, questions, responseMap)
          return (
            <Card key={idx} className="gap-0 border-gray-200 py-0 shadow-none">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {entity.logoUrl ? (
                    <div className="size-8 shrink-0 overflow-hidden rounded-full border border-gray-200">
                      <img src={entity.logoUrl} alt={entity.name || label} className="size-full object-cover" />
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
                  <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
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
