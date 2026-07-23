"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
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
import { AdminReviewQueue } from "@/components/admin-review-queue"
import { StudentReviewStatus } from "@/components/student-review-status"

interface TemplateQuestion {
  id: number
  field_name: string
  field_label: string
  sortOrder: number
  isArchived: boolean
  isPublished: boolean
  [key: string]: unknown
}

interface StudentResponse {
  id: number
  student_response: string
  students_id?: string | number | null
  isArchived?: boolean
  isComplete?: boolean
  readyReview?: boolean
  revisionNeeded?: boolean
  last_edited?: number | string | null
  created_at?: number
  [key: string]: unknown
}

interface TeacherComment {
  id: number
  field_name: string
  note: string
  students_id?: string | number | null
  thread_id?: string | null
  isOld?: boolean
  isComplete?: boolean
  isStudentReply?: boolean
  teacher_name?: string | null
  created_at?: number
  _teachers?: { name?: string | null } | null
  [key: string]: unknown
}

interface SectionInfo {
  id: number
  section_title: string
  isLocked?: boolean
  order?: number
}

interface StatusRow {
  key: string
  sectionTitle: string
  sectionOrder: number
  questionLabel: string
  href: string
  when: number | null
  note?: string
  teacher?: string
}

type GroupKey = "revisions" | "pending" | "unread" | "approved"

const GROUP_META: Record<GroupKey, { label: string; dot: string; empty: string }> = {
  revisions: { label: "Revisions requested", dot: "bg-red-500", empty: "No revisions requested." },
  pending: { label: "Pending review", dot: "bg-blue-500", empty: "Nothing currently submitted." },
  unread: { label: "Unread comments", dot: "bg-gray-400", empty: "No unread comments." },
  approved: { label: "Approved", dot: "bg-green-500", empty: "No approved submissions yet." },
}

// Students see what needs their attention; admins see the student's full
// submission picture — what's awaiting review first, then the history.
const VARIANT_GROUPS: Record<"student" | "admin", GroupKey[]> = {
  student: ["revisions", "pending", "unread"],
  admin: ["pending", "revisions", "approved"],
}

const ROW_CAP = 5

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
 * One product's status as a single grouped table: segments for each status
 * group with clickable rows that deep-link to the exact input.
 *
 * `studentId` semantics: `undefined` = still resolving (stays in skeleton),
 * `null` = no student, string = load that student's data. `basePath` is the
 * page prefix rows link under — `/life-map` for students,
 * `/admin/life-map/{studentId}` for teachers (both host `?focus=` sections).
 */
export function ProductStatusCard({
  title,
  description,
  apiConfig,
  slugify,
  studentId,
  basePath,
  variant = "student",
  defaultExpanded = false,
  viewAllHref,
}: {
  title?: string
  description?: string
  apiConfig: FormApiConfig
  slugify: (title: string) => string
  studentId: string | null | undefined
  basePath: string
  variant?: "student" | "admin"
  defaultExpanded?: boolean
  viewAllHref?: string
}) {
  const cfg = apiConfig
  const F = cfg.fields
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<Record<GroupKey, StatusRow[]>>({
    revisions: [],
    pending: [],
    unread: [],
    approved: [],
  })
  const [expanded, setExpanded] = useState<Set<GroupKey>>(new Set())

  useEffect(() => {
    if (studentId === undefined) return // session still resolving
    if (!studentId) {
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const [sectionsRes, templateRes, responsesRes, commentsRes] = await Promise.all([
          fetch(cfg.sectionsEndpoint),
          fetch(cfg.templateEndpoint),
          fetch(`${cfg.responsesEndpoint}?students_id=${studentId}`),
          fetch(`${cfg.commentsEndpoint}?students_id=${studentId}`),
        ])
        const sections: SectionInfo[] = sectionsRes.ok ? await sectionsRes.json() : []
        const template: TemplateQuestion[] = templateRes.ok ? await templateRes.json() : []
        // Xano ignores the students_id query param on the comments endpoints
        // and returns every student's records (verified live: 13 students came
        // back for one id) — enforce the scope here, like every other consumer.
        const responses: StudentResponse[] = (responsesRes.ok ? await responsesRes.json() : []).filter(
          (r: StudentResponse) => String(r.students_id ?? "") === String(studentId)
        )
        const comments: TeacherComment[] = (commentsRes.ok ? await commentsRes.json() : []).filter(
          // Skip inline essay-comment threads (they belong to a highlight).
          (c: TeacherComment) => String(c.students_id ?? "") === String(studentId) && !c.thread_id
        )
        if (cancelled) return

        const sectionById = new Map(sections.map((s) => [s.id, s]))
        const liveQuestions = new Map<number, TemplateQuestion>()
        for (const q of template) {
          if (!q.isArchived && q.isPublished) liveQuestions.set(q.id, q)
        }

        const rowFor = (
          q: TemplateQuestion,
          when: number | null,
          extra?: { note?: string; teacher?: string; key?: string }
        ): StatusRow | null => {
          const section = sectionById.get(Number(q[F.sectionId]))
          if (!section || section.isLocked) return null
          const slug = slugify(section.section_title)
          return {
            key: extra?.key ?? `q-${q.id}`,
            sectionTitle: section.section_title,
            sectionOrder: section.order ?? 0,
            questionLabel: q.field_label,
            href: `${basePath}/${slug}?focus=${encodeURIComponent(q.field_name)}`,
            when,
            note: extra?.note,
            teacher: extra?.teacher,
          }
        }

        const revisionRows: StatusRow[] = []
        const pendingRows: StatusRow[] = []
        const approvedRows: StatusRow[] = []
        for (const r of responses) {
          if (r.isArchived) continue
          const q = liveQuestions.get(Number(r[F.templateId]))
          if (!q) continue
          const when = toTimestamp(r.last_edited) ?? r.created_at ?? null
          if (r.isComplete) {
            const row = rowFor(q, when)
            if (row) approvedRows.push(row)
          } else if (r.revisionNeeded) {
            const row = rowFor(q, when)
            if (row) revisionRows.push(row)
          } else if (r.readyReview) {
            const row = rowFor(q, when)
            if (row) pendingRows.push(row)
          }
        }

        const unreadRows: StatusRow[] = []
        for (const c of comments) {
          // Skip read and resolved comments (matching the field sheets, which
          // hide isComplete ones) and the student's own replies.
          if (c.isOld || c.isComplete || c.isStudentReply) continue
          const q = [...liveQuestions.values()].find((q) => q.field_name === c.field_name)
          const section = sectionById.get(Number(c[F.sectionId]))
          if (!section || section.isLocked) continue
          const teacher = c.teacher_name || c._teachers?.name || undefined
          if (q) {
            const row = rowFor(q, c.created_at ?? null, { note: c.note, teacher, key: `c-${c.id}` })
            if (row) unreadRows.push(row)
          } else {
            const slug = slugify(section.section_title)
            unreadRows.push({
              key: `c-${c.id}`,
              sectionTitle: section.section_title,
              sectionOrder: section.order ?? 0,
              questionLabel: c.field_name === "_section_comment" ? "Section comment" : c.field_name,
              href: `${basePath}/${slug}`,
              when: c.created_at ?? null,
              note: c.note,
              teacher,
            })
          }
        }

        const bySection = (a: StatusRow, b: StatusRow) =>
          a.sectionOrder - b.sectionOrder || a.questionLabel.localeCompare(b.questionLabel)
        setGroups({
          revisions: revisionRows.sort(bySection),
          pending: pendingRows.sort(bySection),
          unread: unreadRows.sort((a, b) => (b.when ?? 0) - (a.when ?? 0)),
          approved: approvedRows.sort(bySection),
        })
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
  }, [studentId, cfg, F, basePath, slugify])

  const groupKeys = VARIANT_GROUPS[variant]
  const total = groupKeys.reduce((n, k) => n + groups[k].length, 0)

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
            {!loading && (
              <span className="text-muted-foreground text-sm font-normal">({total})</span>
            )}
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
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : !studentId ? (
          <p className="text-muted-foreground px-6 py-6 text-center text-sm italic">
            No student account is linked to this login.
          </p>
        ) : (
          <Table className="[&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:last-child]:pr-4">
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead className="w-[180px]">Section</TableHead>
                <TableHead className="w-[110px]">Date</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupKeys.map((key) => {
                const meta = GROUP_META[key]
                const rows = groups[key]
                const isExpanded = defaultExpanded || expanded.has(key)
                const visible = isExpanded ? rows : rows.slice(0, ROW_CAP)
                return (
                  <StatusGroupRows
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

function StatusGroupRows({
  meta,
  rows,
  visible,
  isExpanded,
  canToggle,
  onToggle,
  onOpen,
}: {
  meta: { label: string; dot: string; empty: string }
  rows: StatusRow[]
  visible: StatusRow[]
  isExpanded: boolean
  canToggle: boolean
  onToggle: () => void
  onOpen: (href: string) => void
}) {
  return (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell colSpan={4} className="py-2">
          <div className="flex items-center gap-2">
            <span className={`size-2 shrink-0 rounded-full ${meta.dot}`} />
            <span className="text-xs font-semibold uppercase tracking-wide">{meta.label}</span>
            <span className="text-muted-foreground text-xs">({rows.length})</span>
          </div>
        </TableCell>
      </TableRow>
      {rows.length === 0 ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={4} className="text-muted-foreground py-3 text-center text-xs italic">
            {meta.empty}
          </TableCell>
        </TableRow>
      ) : (
        <>
          {visible.map((row) => (
            <TableRow
              key={row.key}
              className="cursor-pointer"
              onClick={() => onOpen(row.href)}
            >
              <TableCell className="py-2.5">
                <p className="text-sm font-medium">{row.questionLabel}</p>
                {row.note && (
                  <p className="text-muted-foreground mt-0.5 line-clamp-1 max-w-[420px] text-xs">
                    {row.teacher && <span className="text-foreground/70 font-medium">{row.teacher}: </span>}
                    {row.note}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground py-2.5 text-sm">{row.sectionTitle}</TableCell>
              <TableCell className="text-muted-foreground py-2.5 text-sm whitespace-nowrap">
                {formatWhen(row.when)}
              </TableCell>
              <TableCell className="py-2.5 text-right">
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  className="text-muted-foreground/50 size-4"
                />
              </TableCell>
            </TableRow>
          ))}
          {canToggle && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="py-1.5">
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

/**
 * Student-facing overview of everything that needs attention: revision
 * requests, submissions pending teacher review, and unread teacher comments —
 * across every section of one product (Life Map or Business Thesis).
 */
export function StatusOverview({
  title,
  basePath,
  apiConfig,
  slugify,
  studentId: studentIdProp,
  adminBasePath,
}: {
  title: string
  basePath: string
  apiConfig: FormApiConfig
  slugify: (title: string) => string
  /** Defaults to the signed-in student; pass explicitly for teacher views. */
  studentId?: string
  /** Where admin rows link, e.g. "/admin/life-map". Enables the teacher queue. */
  adminBasePath?: string
}) {
  const { data: session, status: sessionStatus } = useSession()
  const user = session?.user as Record<string, unknown> | undefined
  const role = user?.role as string | undefined
  const sessionStudentId = user?.students_id as string | undefined
  const studentId =
    studentIdProp !== undefined
      ? studentIdProp
      : sessionStatus === "loading"
        ? undefined
        : (sessionStudentId ?? null)

  // Admins have no students_id; show them the consolidated cross-student queue
  // rather than their own (empty) status.
  if (studentIdProp === undefined && role === "admin" && adminBasePath) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">{title} — Review Queue</h1>
          <p className="text-muted-foreground mt-1">
            Every student&apos;s work that needs your attention: submissions pending review and outstanding revision requests.
          </p>
        </div>
        <AdminReviewQueue apiConfig={apiConfig} slugify={slugify} defaultExpanded />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">{title} — Review Status</h1>
        <p className="text-muted-foreground mt-1">
          Everything that needs your attention: revision requests, pending reviews, and unread teacher comments.
        </p>
      </div>
      <StudentReviewStatus
        apiConfig={apiConfig}
        slugify={slugify}
        studentId={studentId}
        basePath={basePath}
      />
    </div>
  )
}
