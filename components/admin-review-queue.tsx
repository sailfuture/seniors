"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import type { FormApiConfig } from "@/lib/form-api-config"

const STUDENTS_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/get_active_students_email"

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
  [key: string]: unknown
}

interface StudentResponse {
  id: number
  students_id?: string | number | null
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
  studentName: string
  studentImage?: string
  questionLabel: string
  sectionTitle: string
  href: string
  when: number | null
}

type GroupKey = "pending" | "revisions"

const GROUP_META: Record<GroupKey, { label: string; dot: string; empty: string }> = {
  pending: { label: "Pending review", dot: "bg-blue-500", empty: "Nothing waiting to be reviewed." },
  revisions: { label: "Revisions requested", dot: "bg-red-500", empty: "No outstanding revision requests." },
}

const GROUP_ORDER: GroupKey[] = ["pending", "revisions"]
const ROW_CAP = 6

function initials(first: string, last: string): string {
  return `${first?.charAt(0) ?? ""}${last?.charAt(0) ?? ""}`.toUpperCase()
}

function formatWhen(ts: number | null): string {
  if (!ts) return "—"
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function toTimestamp(v: number | string | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === "number") return v
  const parsed = Date.parse(v)
  return isNaN(parsed) ? null : parsed
}

/**
 * Teacher-facing consolidated review queue: every student's submissions that
 * are awaiting review or awaiting a resubmission, across one product, each row
 * deep-linking to that student's exact input. Uses the cross-student
 * (unfiltered) responses endpoint — the whole point is to see every student.
 */
export function AdminReviewQueue({
  title,
  description,
  apiConfig,
  adminBasePath,
  slugify,
  defaultExpanded = false,
  viewAllHref,
}: {
  title?: string
  description?: string
  apiConfig: FormApiConfig
  /** e.g. "/admin/life-map" — rows link to `${adminBasePath}/${studentId}/${slug}`. */
  adminBasePath: string
  slugify: (title: string) => string
  defaultExpanded?: boolean
  viewAllHref?: string
}) {
  const cfg = apiConfig
  const F = cfg.fields
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<Record<GroupKey, QueueRow[]>>({ pending: [], revisions: [] })
  const [expanded, setExpanded] = useState<Set<GroupKey>>(new Set())

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
          const q = liveQuestions.get(Number(r[F.templateId]))
          if (!q) return null
          const section = sectionById.get(Number(q[F.sectionId]))
          if (!section || section.isLocked) return null
          const student = studentById.get(String(r.students_id))
          if (!student) return null
          const slug = slugify(section.section_title)
          return {
            key: `${group}-${r.id}`,
            studentName: `${student.firstName} ${student.lastName}`.trim(),
            studentImage: student.profileImage,
            questionLabel: q.field_label,
            sectionTitle: section.section_title,
            href: `${adminBasePath}/${student.id}/${slug}?focus=${encodeURIComponent(q.field_name)}`,
            when: toTimestamp(r.last_edited) ?? r.created_at ?? null,
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

        // Newest submissions first — the freshest work to grade sits on top.
        const byRecent = (a: QueueRow, b: QueueRow) => (b.when ?? 0) - (a.when ?? 0)
        setGroups({ pending: pending.sort(byRecent), revisions: revisions.sort(byRecent) })
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
  }, [cfg, F, adminBasePath, slugify])

  const total = GROUP_ORDER.reduce((n, k) => n + groups[k].length, 0)

  const toggleGroup = (key: GroupKey) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <Card className="gap-0 py-0">
      {title && (
        <CardHeader className="border-b py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            {title}
            {!loading && <span className="text-muted-foreground text-sm font-normal">({total})</span>}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
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
      )}
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="hidden md:table-cell w-[180px]">Section</TableHead>
                <TableHead className="w-[110px]">Date</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {GROUP_ORDER.map((key) => {
                const meta = GROUP_META[key]
                const rows = groups[key]
                const isExpanded = defaultExpanded || expanded.has(key)
                const visible = isExpanded ? rows : rows.slice(0, ROW_CAP)
                return (
                  <QueueGroupRows
                    key={key}
                    meta={meta}
                    rows={rows}
                    visible={visible}
                    isExpanded={isExpanded}
                    canToggle={!defaultExpanded && rows.length > ROW_CAP}
                    onToggle={() => toggleGroup(key)}
                    onOpen={(href) => router.push(href)}
                  />
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function QueueGroupRows({
  meta,
  rows,
  visible,
  isExpanded,
  canToggle,
  onToggle,
  onOpen,
}: {
  meta: { label: string; dot: string; empty: string }
  rows: QueueRow[]
  visible: QueueRow[]
  isExpanded: boolean
  canToggle: boolean
  onToggle: () => void
  onOpen: (href: string) => void
}) {
  return (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell colSpan={5} className="py-2">
          <div className="flex items-center gap-2">
            <span className={`size-2 shrink-0 rounded-full ${meta.dot}`} />
            <span className="text-xs font-semibold uppercase tracking-wide">{meta.label}</span>
            <span className="text-muted-foreground text-xs">({rows.length})</span>
          </div>
        </TableCell>
      </TableRow>
      {rows.length === 0 ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={5} className="text-muted-foreground py-3 text-center text-xs italic">
            {meta.empty}
          </TableCell>
        </TableRow>
      ) : (
        <>
          {visible.map((row) => (
            <TableRow key={row.key} className="cursor-pointer" onClick={() => onOpen(row.href)}>
              <TableCell className="py-2.5">
                <div className="flex items-center gap-2">
                  <Avatar className="size-6">
                    <AvatarImage src={row.studentImage} />
                    <AvatarFallback className="text-[10px]">
                      {initials(...(row.studentName.split(" ") as [string, string]))}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium whitespace-nowrap">{row.studentName}</span>
                </div>
              </TableCell>
              <TableCell className="py-2.5 text-sm">{row.questionLabel}</TableCell>
              <TableCell className="text-muted-foreground hidden py-2.5 text-sm md:table-cell">
                {row.sectionTitle}
              </TableCell>
              <TableCell className="text-muted-foreground py-2.5 text-sm whitespace-nowrap">
                {formatWhen(row.when)}
              </TableCell>
              <TableCell className="py-2.5 text-right">
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="text-muted-foreground/50 size-4" />
              </TableCell>
            </TableRow>
          ))}
          {canToggle && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="py-1.5">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground mx-auto block text-xs font-medium transition-colors"
                  onClick={onToggle}
                >
                  {isExpanded ? "Show fewer" : `Show all ${rows.length}`}
                </button>
              </TableCell>
            </TableRow>
          )}
        </>
      )}
    </>
  )
}
