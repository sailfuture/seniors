"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import type { FormApiConfig } from "@/lib/form-api-config"
import { extractPlainText, isRichTextQuestion, looksLikeRichTextDoc } from "@/lib/rich-text"
import { isLineItemsQuestion } from "@/lib/line-items"
import { ResponseReviewSheet, type ReviewTarget } from "@/components/form/response-review-sheet"

const STUDENTS_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/get_active_students_email"

const IMAGE_UPLOAD = 4

interface Student {
  id: string
  firstName: string
  lastName: string
  profileImage?: string
}

interface TemplateQuestion {
  id: number
  field_name: string
  field_label: string
  isArchived: boolean
  isPublished: boolean
  question_types_id?: number | null
  [key: string]: unknown
}

interface StudentResponse {
  id: number
  students_id?: string | number | null
  student_response?: string
  image_response?: Record<string, unknown> | null
  isArchived?: boolean
  isComplete?: boolean
  readyReview?: boolean
  revisionNeeded?: boolean
  last_edited?: number | string | null
  created_at?: number
  [key: string]: unknown
}

interface SectionInfo {
  id: number
  section_title: string
  isLocked?: boolean
  order?: number
}

interface QueueRow {
  key: string
  responseId: number
  studentName: string
  studentImage?: string
  questionLabel: string
  sectionTitle: string
  preview: string
  when: number | null
  target: ReviewTarget
}

type GroupKey = "pending" | "revisions"

const GROUP_META: Record<GroupKey, { label: string; dot: string; empty: string }> = {
  pending: { label: "Pending review", dot: "bg-blue-500", empty: "Nothing waiting to be reviewed." },
  revisions: { label: "Revisions requested", dot: "bg-red-500", empty: "No outstanding revision requests." },
}

const GROUP_ORDER: GroupKey[] = ["pending", "revisions"]
const ROW_CAP = 6

function initials(name: string): string {
  const [a = "", b = ""] = name.split(" ")
  return `${a.charAt(0)}${b.charAt(0)}`.toUpperCase()
}

function formatWhen(ts: number | null): string {
  if (!ts) return "—"
  // Relative down to the minute within the last week; absolute date beyond.
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 45) return "just now"
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function toTimestamp(v: number | string | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === "number") return v
  const parsed = Date.parse(v)
  return isNaN(parsed) ? null : parsed
}

function previewOf(q: TemplateQuestion, r: StudentResponse): string {
  if ((q.question_types_id ?? null) === IMAGE_UPLOAD) return "Image submission"
  if (isLineItemsQuestion(q)) return "Cost / product breakdown"
  const raw = r.student_response ?? ""
  const text = isRichTextQuestion(q) || looksLikeRichTextDoc(raw) ? extractPlainText(raw) : raw
  const t = text.trim().replace(/\s+/g, " ")
  if (!t) return "—"
  return t.length > 110 ? `${t.slice(0, 110)}…` : t
}

type GroupMode = "student" | "section"

/** Group rows by student (global queue) or by section (single-student page),
 *  freshest group first. */
function groupRows(rows: QueueRow[], mode: GroupMode): { label: string; image?: string; rows: QueueRow[] }[] {
  const keyOf = (r: QueueRow) => (mode === "section" ? r.sectionTitle : r.studentName)
  const byKey = new Map<string, QueueRow[]>()
  for (const r of rows) {
    const k = keyOf(r)
    const arr = byKey.get(k) ?? []
    arr.push(r)
    byKey.set(k, arr)
  }
  return [...byKey.entries()]
    .map(([label, list]) => ({
      label,
      image: mode === "student" ? list[0]?.studentImage : undefined,
      rows: list.sort((a, b) => (b.when ?? 0) - (a.when ?? 0)),
    }))
    .sort((a, b) => (b.rows[0]?.when ?? 0) - (a.rows[0]?.when ?? 0))
}

/**
 * Teacher-facing review queue: a card per review type (pending / revisions),
 * each grouped by student, with a truncated response preview. Clicking a row
 * opens the response and its thread in a sheet — review without navigating.
 */
export function AdminReviewQueue({
  title,
  apiConfig,
  slugify,
  defaultExpanded = false,
  viewAllHref,
  studentId: onlyStudentId,
}: {
  title?: string
  apiConfig: FormApiConfig
  slugify: (title: string) => string
  defaultExpanded?: boolean
  viewAllHref?: string
  /** Scope to a single student (per-student review page). */
  studentId?: string
}) {
  const cfg = apiConfig
  const F = cfg.fields

  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<Record<GroupKey, QueueRow[]>>({ pending: [], revisions: [] })
  const [expanded, setExpanded] = useState<Set<GroupKey>>(new Set())
  const [sheetTarget, setSheetTarget] = useState<ReviewTarget | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [studentsRes, sectionsRes, templateRes, responsesRes] = await Promise.all([
          fetch(STUDENTS_ENDPOINT),
          fetch(cfg.sectionsEndpoint),
          fetch(cfg.templateEndpoint),
          fetch(cfg.allResponsesEndpoint),
        ])
        const students: Student[] = studentsRes.ok ? await studentsRes.json() : []
        const sections: SectionInfo[] = sectionsRes.ok ? await sectionsRes.json() : []
        const template: TemplateQuestion[] = templateRes.ok ? await templateRes.json() : []
        const responses: StudentResponse[] = responsesRes.ok ? await responsesRes.json() : []
        if (cancelled) return

        const studentById = new Map(students.map((s) => [String(s.id), s]))
        const sectionById = new Map(sections.map((s) => [s.id, s]))
        const liveQuestions = new Map<number, TemplateQuestion>()
        for (const q of template) {
          if (!q.isArchived && q.isPublished) liveQuestions.set(q.id, q)
        }

        const rowFor = (r: StudentResponse, group: GroupKey): QueueRow | null => {
          if (onlyStudentId && String(r.students_id) !== String(onlyStudentId)) return null
          const q = liveQuestions.get(Number(r[F.templateId]))
          if (!q) return null
          const section = sectionById.get(Number(q[F.sectionId]))
          if (!section || section.isLocked) return null
          const student = studentById.get(String(r.students_id))
          if (!student) return null
          const studentName = `${student.firstName} ${student.lastName}`.trim()
          return {
            key: `${group}-${r.id}`,
            responseId: r.id,
            studentName,
            studentImage: student.profileImage,
            questionLabel: q.field_label,
            sectionTitle: section.section_title,
            preview: previewOf(q, r),
            when: toTimestamp(r.last_edited) ?? r.created_at ?? null,
            target: {
              response: {
                id: r.id,
                student_response: r.student_response,
                image_response: r.image_response,
                students_id: String(r.students_id),
                isComplete: r.isComplete,
                readyReview: r.readyReview,
                revisionNeeded: r.revisionNeeded,
                last_edited: r.last_edited,
              },
              question: {
                id: q.id,
                field_name: q.field_name,
                field_label: q.field_label,
                question_types_id: q.question_types_id ?? null,
              },
              sectionId: section.id,
              sectionTitle: section.section_title,
              studentName,
            },
          }
        }

        const pending: QueueRow[] = []
        const revisions: QueueRow[] = []
        for (const r of responses) {
          if (r.isArchived || r.isComplete) continue
          if (r.revisionNeeded) {
            const row = rowFor(r, "revisions")
            if (row) revisions.push(row)
          } else if (r.readyReview) {
            const row = rowFor(r, "pending")
            if (row) pending.push(row)
          }
        }
        setGroups({ pending, revisions })
      } catch {
        /* leave empty state */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [cfg, F, slugify, onlyStudentId])

  const openRow = (target: ReviewTarget) => {
    setSheetTarget(target)
    setSheetOpen(true)
  }

  const handleReviewed = (responseId: number, action: "complete" | "revision" | "ready") => {
    setGroups((prev) => {
      const row =
        prev.pending.find((r) => r.responseId === responseId) ??
        prev.revisions.find((r) => r.responseId === responseId)
      const pending = prev.pending.filter((r) => r.responseId !== responseId)
      const revisions = prev.revisions.filter((r) => r.responseId !== responseId)
      // Complete leaves the queue; revision/undo move the row to the other card.
      if (!row || action === "complete") return { pending, revisions }
      if (action === "revision") return { pending, revisions: [{ ...row, key: `revisions-${responseId}` }, ...revisions] }
      return { pending: [{ ...row, key: `pending-${responseId}` }, ...pending], revisions }
    })
  }

  const toggle = (key: GroupKey) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="space-y-6">
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      {GROUP_ORDER.map((key) => (
        <ReviewCard
          key={key}
          meta={GROUP_META[key]}
          rows={groups[key]}
          groupBy={onlyStudentId ? "section" : "student"}
          loading={loading}
          expanded={defaultExpanded || expanded.has(key)}
          canToggle={!defaultExpanded}
          onToggle={() => toggle(key)}
          onOpen={openRow}
          viewAllHref={viewAllHref}
        />
      ))}

      <ResponseReviewSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        target={sheetTarget}
        apiConfig={cfg}
        onReviewed={handleReviewed}
      />
    </div>
  )
}

function ReviewCard({
  meta,
  rows,
  groupBy,
  loading,
  expanded,
  canToggle,
  onToggle,
  onOpen,
  viewAllHref,
}: {
  meta: { label: string; dot: string; empty: string }
  rows: QueueRow[]
  groupBy: GroupMode
  loading: boolean
  expanded: boolean
  canToggle: boolean
  onToggle: () => void
  onOpen: (target: ReviewTarget) => void
  viewAllHref?: string
}) {
  const groups = useMemo(() => groupRows(rows, groupBy), [rows, groupBy])

  // Cap the number of data rows shown when collapsed, without splitting groups awkwardly.
  let shown = 0
  const visibleGroups = expanded
    ? groups
    : groups
        .map((g) => {
          if (shown >= ROW_CAP) return null
          const take = g.rows.slice(0, Math.max(0, ROW_CAP - shown))
          shown += take.length
          return { ...g, rows: take }
        })
        .filter(Boolean) as typeof groups

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className={`size-2 rounded-full ${meta.dot}`} />
          {meta.label}
          {!loading && <span className="text-muted-foreground text-sm font-normal">({rows.length})</span>}
        </CardTitle>
        {viewAllHref && (
          <CardAction>
            <Link
              href={viewAllHref}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
            >
              View all
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5" />
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground px-6 py-6 text-center text-sm italic">{meta.empty}</p>
        ) : (
          <div className="divide-y">
            {visibleGroups.map((g) => (
              <div key={g.label}>
                <div className="bg-muted/40 flex items-center gap-2 px-4 py-1.5">
                  {groupBy === "student" && (
                    <Avatar className="size-5">
                      <AvatarImage src={g.image} />
                      <AvatarFallback className="text-[9px]">{initials(g.label)}</AvatarFallback>
                    </Avatar>
                  )}
                  <span className="text-xs font-semibold">{g.label}</span>
                  <span className="text-muted-foreground text-xs">({g.rows.length})</span>
                </div>
                {g.rows.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => onOpen(row.target)}
                    className="hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors"
                  >
                    {/* Question name and the actual response, same size, bullet-separated. */}
                    <p className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-medium">{row.questionLabel}</span>
                      <span className="text-muted-foreground"> &middot; </span>
                      <span className="font-normal">{row.preview}</span>
                    </p>
                    {groupBy === "student" && (
                      <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
                        {row.sectionTitle}
                      </span>
                    )}
                    <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                      {formatWhen(row.when)}
                    </span>
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="text-muted-foreground/40 size-4 shrink-0" />
                  </button>
                ))}
              </div>
            ))}
            {canToggle && rows.length > ROW_CAP && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground w-full py-2 text-center text-xs font-medium transition-colors"
                onClick={onToggle}
              >
                {expanded ? "Show fewer" : `Show all ${rows.length}`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
