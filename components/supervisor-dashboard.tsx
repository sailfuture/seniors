"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  ArrowTurnBackwardIcon,
  BookOpen02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  UserGroupIcon,
  UserQuestion01Icon,
  UserWarning01Icon,
} from "@hugeicons/core-free-icons"
import {
  advisorAllowsProduct,
  advisorInitials,
  advisorName,
  type Advisor,
  type AdvisorProduct,
} from "@/lib/advisors"
import { accessByEmail, type AdvisorAccess } from "@/lib/advisor-invitations"
import {
  classYearOf,
  currentClassYear,
  studentName,
  type RosterStudent,
} from "@/lib/students"
import {
  studentsById,
  useAdvisorAccess,
  useAdvisorAssignments,
  useAdvisors,
  useStudents,
} from "@/lib/queries"
import { BUSINESSTHESIS_API_CONFIG } from "@/lib/form-api-config"
import { cachedFetch } from "@/lib/cached-fetch"
import { reviewCountsByStudent } from "@/lib/review-counts"
import { relativeTime, toMillis } from "@/lib/format-time"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

/** Thesis supervisors oversee the business thesis advisors only. */
const PRODUCT: AdvisorProduct = "business-thesis"
const CFG = BUSINESSTHESIS_API_CONFIG

const ROSTER_HREF = "/admin/business-thesis"
const ADVISORS_HREF = "/admin/advisors"

/** Work waiting on a reviewer longer than this reads as overdue. */
const OVERDUE_DAYS = 7
const DAY_MS = 86_400_000

/** As many advisor cards across as fit at 26rem+. */
const ADVISOR_GRID =
  "grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,26rem),1fr))]"

function reviewHref(studentId: string) {
  return `/admin/business-thesis/${studentId}/review`
}

function studentInitials(s: RosterStudent) {
  return `${s.firstName.charAt(0)}${s.lastName.charAt(0)}`.toUpperCase() || "?"
}

function byStudentName(a: RosterStudent, b: RosterStudent) {
  return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
}

// ---------------------------------------------------------------------------
// Thesis progress: one read of the status rows and the review queue for the
// whole class, reduced per student.
// ---------------------------------------------------------------------------

interface StudentProgress {
  /** Answers marked complete on questions that need one. */
  approved: number
  /** Answers ready for review and not yet acted on. */
  pending: number
  /** Answers sent back for revision and not yet resubmitted. */
  revisions: number
  /** When the longest-waiting ready-for-review answer was last edited. */
  oldestPendingAt: number | null
}

interface ThesisProgress {
  /** Questions on the live form that need an answer. */
  required: number
  byStudent: Map<string, StudentProgress>
}

interface TemplateRow {
  id: number
  isArchived?: boolean
  isPublished?: boolean
  question_types_id?: number | null
  [key: string]: unknown
}

interface StatusRow {
  students_id?: string | number | null
  isArchived?: boolean
  isComplete?: boolean
  readyReview?: boolean
  revisionNeeded?: boolean
  last_edited?: number | string | null
  created_at?: number | string | null
  [key: string]: unknown
}

const EMPTY_PROGRESS: StudentProgress = { approved: 0, pending: 0, revisions: 0, oldestPendingAt: null }

function summarizeProgress(
  sections: unknown,
  template: unknown,
  types: unknown,
  statusRows: unknown,
  queueRows: unknown
): ThesisProgress {
  const { templateId, sectionId } = CFG.fields

  // Headers and other display-only types never take an answer.
  const noInput = new Set<number>()
  for (const t of Array.isArray(types) ? (types as { id: number; noInput?: boolean }[]) : []) {
    if (t?.noInput) noInput.add(Number(t.id))
  }

  const live = new Map<number, TemplateRow>()
  const required = new Set<number>()
  for (const q of Array.isArray(template) ? (template as TemplateRow[]) : []) {
    if (!q || q.isArchived || !q.isPublished) continue
    live.set(Number(q.id), q)
    if (q.question_types_id != null && noInput.has(Number(q.question_types_id))) continue
    required.add(Number(q.id))
  }

  const lockedSections = new Set<number>()
  for (const s of Array.isArray(sections) ? (sections as { id: number; isLocked?: boolean }[]) : []) {
    if (s?.isLocked) lockedSections.add(Number(s.id))
  }

  const byStudent = new Map<string, StudentProgress>()
  const entry = (studentId: string) => {
    let e = byStudent.get(studentId)
    if (!e) {
      e = { ...EMPTY_PROGRESS }
      byStudent.set(studentId, e)
    }
    return e
  }

  // Approved answers, one per question per student.
  const approvedSeen = new Set<string>()
  for (const r of Array.isArray(statusRows) ? (statusRows as StatusRow[]) : []) {
    if (!r || r.isArchived || !r.isComplete) continue
    const sid = String(r.students_id ?? "")
    const qid = Number(r[templateId])
    if (!sid || !required.has(qid)) continue
    const key = `${sid}:${qid}`
    if (approvedSeen.has(key)) continue
    approvedSeen.add(key)
    entry(sid).approved++
  }

  // Waiting work, counted exactly the way the review queue lists it.
  for (const [sid, counts] of reviewCountsByStudent(queueRows, template, sections, CFG.fields)) {
    const e = entry(sid)
    e.pending = counts.pending
    e.revisions = counts.revisions
  }

  // How long the oldest ready-for-review answer has been waiting.
  for (const r of Array.isArray(queueRows) ? (queueRows as StatusRow[]) : []) {
    if (!r || r.isArchived || r.isComplete || !r.readyReview || r.revisionNeeded) continue
    const q = live.get(Number(r[templateId]))
    if (!q || lockedSections.has(Number(q[sectionId]))) continue
    const sid = String(r.students_id ?? "")
    const at = toMillis(r.last_edited ?? r.created_at ?? null)
    if (!sid || at == null) continue
    const e = entry(sid)
    if (e.oldestPendingAt == null || at < e.oldestPendingAt) e.oldestPendingAt = at
  }

  return { required: required.size, byStudent }
}

function useThesisProgress() {
  return useQuery<ThesisProgress>({
    queryKey: ["supervisor-thesis-progress"],
    queryFn: async () => {
      const [sectionsRes, templateRes, typesRes, statusRes, queueRes] = await Promise.all([
        cachedFetch(CFG.sectionsEndpoint),
        cachedFetch(CFG.templateEndpoint),
        cachedFetch(CFG.questionTypesEndpoint),
        fetch(CFG.responseStatusEndpoint),
        fetch(CFG.reviewQueueEndpoint),
      ])
      if (!sectionsRes.ok || !templateRes.ok || !statusRes.ok || !queueRes.ok) {
        throw new Error("Business thesis progress couldn't be loaded")
      }
      const [sections, template, types, statusRows, queueRows] = await Promise.all([
        sectionsRes.json(),
        templateRes.json(),
        typesRes.ok ? typesRes.json() : [],
        statusRes.json(),
        queueRes.json(),
      ])
      return summarizeProgress(sections, template, types, statusRows, queueRows)
    },
  })
}

function isOverdue(at: number | null | undefined, now: number) {
  return at != null && now - at > OVERDUE_DAYS * DAY_MS
}

/** "9 days" for the attention list; relativeTime's "9d ago" elsewhere. */
function waitedFor(at: number, now: number) {
  const days = Math.floor((now - at) / DAY_MS)
  if (days < 1) return "less than a day"
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`
  return `${Math.floor(days / 7)} weeks`
}

// ---------------------------------------------------------------------------
// Sign-in state, from Clerk through the advisor invitations route.
// ---------------------------------------------------------------------------

interface SignIn {
  label: string
  ok: boolean
}

function signInOf(access: AdvisorAccess | undefined, now: number): SignIn | null {
  if (!access) return null
  switch (access.state) {
    case "accepted":
      return {
        label: access.lastSignInAt
          ? `Signed in ${relativeTime(access.lastSignInAt, now)}`
          : "Account created, not signed in",
        ok: Boolean(access.lastSignInAt),
      }
    case "pending":
      return { label: "Invited, hasn't signed up", ok: false }
    case "expired":
      return { label: "Invitation expired", ok: false }
    default:
      return { label: "Not invited yet", ok: false }
  }
}

// ---------------------------------------------------------------------------
// The dashboard
// ---------------------------------------------------------------------------

interface AdvisorRow {
  advisor: Advisor
  students: RosterStudent[]
}

/**
 * Home page for thesis supervisors: the business thesis advisors, the
 * students each one advises, what's waiting on a reviewer, and who still
 * needs an advisor or hasn't signed in. No Life Map anywhere.
 */
export function SupervisorDashboard() {
  const advisorsQuery = useAdvisors()
  const assignmentsQuery = useAdvisorAssignments()
  // Active roster only: graduated students have nothing left to review.
  const studentsQuery = useStudents()
  const accessQuery = useAdvisorAccess(true)
  const progressQuery = useThesisProgress()
  // One clock for every "waiting since" on the page.
  const [now] = useState(() => Date.now())

  const access = useMemo(
    () => (accessQuery.data?.ok === false ? null : accessByEmail(accessQuery.data?.access ?? [])),
    [accessQuery.data]
  )

  const model = useMemo(() => {
    const advisors = advisorsQuery.data
    const assignments = assignmentsQuery.data
    const students = studentsQuery.data
    if (!advisors || !assignments || !students) return null

    const byId = studentsById(students)
    const thesisAdvisors = advisors.filter(
      (a) => a.isActive !== false && advisorAllowsProduct(a, PRODUCT)
    )
    const activeIds = new Set(thesisAdvisors.map((a) => Number(a.id)))

    // A student whose only advisor was deactivated still needs one.
    const studentsByAdvisor = new Map<number, RosterStudent[]>()
    const advised = new Map<string, RosterStudent>()
    for (const a of assignments) {
      if (a.type !== PRODUCT || !activeIds.has(Number(a.advisors_id))) continue
      const student = byId.get(String(a.students_id))
      if (!student) continue
      const list = studentsByAdvisor.get(Number(a.advisors_id)) ?? []
      if (!list.some((s) => s.id === student.id)) list.push(student)
      studentsByAdvisor.set(Number(a.advisors_id), list)
      advised.set(String(student.id), student)
    }

    const rows: AdvisorRow[] = thesisAdvisors
      .map((advisor) => ({
        advisor,
        students: [...(studentsByAdvisor.get(Number(advisor.id)) ?? [])].sort(byStudentName),
      }))
      // Advisors with students first, then by name.
      .sort((x, y) => {
        if ((x.students.length > 0) !== (y.students.length > 0)) return x.students.length > 0 ? -1 : 1
        return advisorName(x.advisor).localeCompare(advisorName(y.advisor))
      })

    const year = currentClassYear()
    const seniors = students.filter((s) => classYearOf(s) === year)
    const unadvised = seniors.filter((s) => !advised.has(String(s.id))).sort(byStudentName)

    return { rows, seniors, unadvised, advised: [...advised.values()] }
  }, [advisorsQuery.data, assignmentsQuery.data, studentsQuery.data])

  const progress = progressQuery.data
  const progressLoading = progressQuery.isPending

  // Totals across every student an advisor covers, each student once.
  const totals = useMemo(() => {
    if (!model || !progress) return null
    let pending = 0
    let revisions = 0
    let oldest: number | null = null
    for (const s of model.advised) {
      const p = progress.byStudent.get(String(s.id))
      if (!p) continue
      pending += p.pending
      revisions += p.revisions
      if (p.oldestPendingAt != null && (oldest == null || p.oldestPendingAt < oldest)) {
        oldest = p.oldestPendingAt
      }
    }
    return { pending, revisions, oldest }
  }, [model, progress])

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Thesis supervision</h1>
          <p className="text-muted-foreground mt-1">
            Your business thesis advisors, the students each one advises, and what&rsquo;s
            waiting on a review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={ADVISORS_HREF}>Thesis advisors</Link>
          </Button>
          <Button asChild>
            <Link href={ROSTER_HREF}>Business Thesis roster</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <Kpi
          icon={UserGroupIcon}
          label="Thesis advisors"
          value={model?.rows.length}
          note={
            model && access
              ? `${model.rows.filter((r) => signInOf(access.get(r.advisor.email?.trim().toLowerCase() ?? ""), now)?.ok).length} signed in`
              : undefined
          }
          loading={!model}
        />
        <Kpi
          icon={BookOpen02Icon}
          label="Seniors with an advisor"
          value={model ? `${model.seniors.length - model.unadvised.length} of ${model.seniors.length}` : undefined}
          note={
            model
              ? model.unadvised.length > 0
                ? `${model.unadvised.length} still need one`
                : "Every senior has one"
              : undefined
          }
          warn={Boolean(model && model.unadvised.length > 0)}
          loading={!model}
        />
        <Kpi
          icon={Clock01Icon}
          label="Ready for review"
          dot="bg-blue-500"
          value={totals?.pending}
          note={
            totals
              ? totals.oldest != null
                ? `Oldest waiting ${waitedFor(totals.oldest, now)}`
                : "Nothing waiting"
              : undefined
          }
          warn={isOverdue(totals?.oldest, now)}
          loading={!totals && (progressLoading || !model)}
          failed={progressQuery.isError}
        />
        <Kpi
          icon={ArrowTurnBackwardIcon}
          label="Revisions open"
          dot="bg-red-500"
          value={totals?.revisions}
          note={totals ? "Sent back, waiting on students" : undefined}
          loading={!totals && (progressLoading || !model)}
          failed={progressQuery.isError}
        />
      </div>

      <AttentionCard
        model={model}
        progress={progress}
        access={access}
        accessLoading={accessQuery.isPending}
        now={now}
      />

      <section className="flex min-w-0 flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Advisors and their students</h2>
          <p className="text-muted-foreground text-sm">
            Each student&rsquo;s share of approved answers and what&rsquo;s waiting. Open a student
            to see their review page.
          </p>
        </div>
        {!model ? (
          <div className={ADVISOR_GRID}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : model.rows.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No business thesis advisors yet</CardTitle>
              <CardDescription>
                Add advisors on the Users page, then assign them students from the Business
                Thesis roster.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={ADVISORS_HREF}>Add an advisor</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className={ADVISOR_GRID}>
            {model.rows.map((row) => (
              <AdvisorCard
                key={row.advisor.id}
                row={row}
                progress={progress}
                progressLoading={progressLoading}
                signIn={
                  access
                    ? signInOf(access.get(row.advisor.email?.trim().toLowerCase() ?? ""), now)
                    : null
                }
                signInLoading={accessQuery.isPending}
                now={now}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Kpi({
  icon,
  label,
  value,
  note,
  dot,
  warn = false,
  loading,
  failed = false,
}: {
  icon: typeof UserGroupIcon
  label: string
  value: number | string | undefined
  note?: string
  dot?: string
  warn?: boolean
  loading: boolean
  failed?: boolean
}) {
  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex items-start gap-3 px-4">
        <div className="bg-primary/10 hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex">
          <HugeiconsIcon icon={icon} strokeWidth={2} className="text-primary size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            {dot && <span className={cn("size-1.5 shrink-0 rounded-full", dot)} />}
            {label}
          </p>
          {loading ? (
            <>
              <Skeleton className="mt-1.5 h-7 w-16" />
              <Skeleton className="mt-1.5 h-3.5 w-28" />
            </>
          ) : failed ? (
            <p className="text-muted-foreground mt-1 text-sm">Couldn&rsquo;t load</p>
          ) : (
            <>
              <p className="text-2xl leading-8 font-semibold tabular-nums">{value ?? "–"}</p>
              {note && (
                <p className={cn("text-xs", warn ? "text-amber-700" : "text-muted-foreground")}>
                  {note}
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * What a supervisor should act on: seniors without an advisor, advisors who
 * can't get in yet, and advisors with work waiting longer than a week.
 */
function AttentionCard({
  model,
  progress,
  access,
  accessLoading,
  now,
}: {
  model: { rows: AdvisorRow[]; unadvised: RosterStudent[] } | null
  progress: ThesisProgress | undefined
  access: Map<string, AdvisorAccess> | null
  accessLoading: boolean
  now: number
}) {
  if (!model) return <Skeleton className="h-36 rounded-xl" />

  const notSignedIn = access
    ? model.rows
        .map((r) => ({ advisor: r.advisor, signIn: signInOf(access.get(r.advisor.email?.trim().toLowerCase() ?? ""), now) }))
        .filter((x) => x.signIn && !x.signIn.ok)
    : []

  const overdue = progress
    ? model.rows
        .map((r) => {
          let oldest: number | null = null
          let waiting = 0
          for (const s of r.students) {
            const p = progress.byStudent.get(String(s.id))
            if (!p) continue
            waiting += p.pending
            if (p.oldestPendingAt != null && (oldest == null || p.oldestPendingAt < oldest)) oldest = p.oldestPendingAt
          }
          return { advisor: r.advisor, oldest, waiting }
        })
        .filter((x) => isOverdue(x.oldest, now))
        .sort((x, y) => (x.oldest ?? 0) - (y.oldest ?? 0))
    : []

  const clear = model.unadvised.length === 0 && notSignedIn.length === 0 && overdue.length === 0

  return (
    <Card>
      <CardHeader className={cn(!clear && "border-b")}>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>
          {clear
            ? accessLoading || !progress
              ? "Checking sign-ins and waiting work…"
              : "Nothing right now: every senior has an advisor, every advisor can sign in, and no work has waited over a week."
            : "Seniors without an advisor, advisors who can't sign in yet, and work waiting over a week."}
        </CardDescription>
      </CardHeader>
      {!clear && (
        <CardContent className="flex flex-col divide-y">
          {model.unadvised.length > 0 && (
            <AttentionRow
              icon={UserQuestion01Icon}
              title={`${model.unadvised.length} senior${model.unadvised.length === 1 ? "" : "s"} without a thesis advisor`}
              action={{ label: "Assign on the roster", href: ROSTER_HREF }}
            >
              <ul className="mt-2 flex flex-wrap gap-2">
                {model.unadvised.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={reviewHref(s.id)}
                      className="hover:bg-muted flex items-center gap-2 rounded-full border py-0.5 pr-3 pl-0.5 text-sm transition-colors"
                    >
                      <Avatar className="size-6">
                        <AvatarImage src={s.profileImage || undefined} alt="" />
                        <AvatarFallback className="text-[10px]">{studentInitials(s)}</AvatarFallback>
                      </Avatar>
                      {studentName(s)}
                    </Link>
                  </li>
                ))}
              </ul>
            </AttentionRow>
          )}
          {notSignedIn.length > 0 && (
            <AttentionRow
              icon={UserWarning01Icon}
              title={`${notSignedIn.length} advisor${notSignedIn.length === 1 ? " hasn't" : "s haven't"} signed in`}
              action={{ label: "Send invitations", href: ADVISORS_HREF }}
            >
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {notSignedIn.map(({ advisor, signIn }) => (
                  <li key={advisor.id}>
                    <a href={`#advisor-${advisor.id}`} className="font-medium hover:underline">
                      {advisorName(advisor)}
                    </a>
                    <span className="text-muted-foreground"> · {signIn?.label}</span>
                  </li>
                ))}
              </ul>
            </AttentionRow>
          )}
          {overdue.length > 0 && (
            <AttentionRow
              icon={Clock01Icon}
              title={`${overdue.length} advisor${overdue.length === 1 ? " has" : "s have"} work waiting over a week`}
            >
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {overdue.map(({ advisor, oldest, waiting }) => (
                  <li key={advisor.id}>
                    <a href={`#advisor-${advisor.id}`} className="font-medium hover:underline">
                      {advisorName(advisor)}
                    </a>
                    <span className="text-muted-foreground">
                      {" "}
                      · {waiting} answer{waiting === 1 ? "" : "s"} ready for review, oldest{" "}
                      {oldest != null ? waitedFor(oldest, now) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </AttentionRow>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function AttentionRow({
  icon,
  title,
  action,
  children,
}: {
  icon: typeof UserGroupIcon
  title: string
  action?: { label: string; href: string }
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
      <HugeiconsIcon icon={icon} strokeWidth={2} className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{title}</p>
          {action && (
            <Button asChild variant="outline" size="sm">
              <Link href={action.href}>{action.label}</Link>
            </Button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

function AdvisorCard({
  row,
  progress,
  progressLoading,
  signIn,
  signInLoading,
  now,
}: {
  row: AdvisorRow
  progress: ThesisProgress | undefined
  progressLoading: boolean
  signIn: SignIn | null
  signInLoading: boolean
  now: number
}) {
  const { advisor, students } = row

  let pending = 0
  let revisions = 0
  for (const s of students) {
    const p = progress?.byStudent.get(String(s.id))
    pending += p?.pending ?? 0
    revisions += p?.revisions ?? 0
  }

  return (
    <Card id={`advisor-${advisor.id}`} className="h-full scroll-mt-6">
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <Avatar className="size-11">
            <AvatarImage src={advisor.profileImage || undefined} alt="" />
            <AvatarFallback>{advisorInitials(advisor)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate">{advisorName(advisor)}</CardTitle>
            <CardDescription className="truncate" title={advisor.email}>
              {advisor.email}
            </CardDescription>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {signInLoading ? (
            <Skeleton className="h-3.5 w-28" />
          ) : (
            signIn && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    signIn.ok ? "bg-emerald-500" : "bg-amber-500"
                  )}
                />
                <span className={signIn.ok ? "text-muted-foreground" : "text-amber-700"}>
                  {signIn.label}
                </span>
              </span>
            )
          )}
          <span className="text-muted-foreground">
            {students.length} student{students.length === 1 ? "" : "s"}
          </span>
          {progress && students.length > 0 && (
            <>
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-blue-500" />
                {pending} ready for review
              </span>
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-red-500" />
                {revisions} revision{revisions === 1 ? "" : "s"} open
              </span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {students.length === 0 ? (
          <div className="text-muted-foreground flex flex-1 flex-col items-start gap-3 text-sm">
            <p>No students assigned yet.</p>
            <Button asChild variant="outline" size="sm">
              <Link href={ROSTER_HREF}>Assign from the roster</Link>
            </Button>
          </div>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {students.map((s) => (
              <li key={s.id}>
                <StudentRow
                  student={s}
                  progress={progress?.byStudent.get(String(s.id)) ?? (progress ? EMPTY_PROGRESS : undefined)}
                  required={progress?.required ?? 0}
                  loading={progressLoading}
                  now={now}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function StudentRow({
  student,
  progress,
  required,
  loading,
  now,
}: {
  student: RosterStudent
  progress: StudentProgress | undefined
  required: number
  loading: boolean
  now: number
}) {
  const pct = progress && required > 0 ? Math.min(100, Math.round((progress.approved / required) * 100)) : 0
  const overdue = isOverdue(progress?.oldestPendingAt, now)

  return (
    <Link
      href={reviewHref(student.id)}
      className="hover:bg-muted/60 group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors"
    >
      <Avatar className="size-8">
        <AvatarImage src={student.profileImage || undefined} alt="" />
        <AvatarFallback className="text-xs">{studentInitials(student)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{studentName(student)}</p>
        {loading ? (
          <Skeleton className="mt-1.5 h-1.5 w-full" />
        ) : progress ? (
          <div className="mt-1.5 flex items-center gap-2">
            <div
              className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${studentName(student)}: ${pct}% of answers approved`}
            >
              <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">
              {pct}%
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {progress && progress.pending > 0 && (
          <span
            title={`${progress.pending} ready for review`}
            className={cn(
              "inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-full px-2 text-xs font-medium tabular-nums",
              overdue ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
            )}
          >
            {overdue && <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3" />}
            {progress.pending}
          </span>
        )}
        {progress && progress.revisions > 0 && (
          <span
            title={`${progress.revisions} revision${progress.revisions === 1 ? "" : "s"} open`}
            className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-100 px-2 text-xs font-medium text-red-800 tabular-nums"
          >
            {progress.revisions}
          </span>
        )}
        {progress && progress.pending === 0 && progress.revisions === 0 && pct === 100 && (
          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-emerald-600" />
        )}
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          strokeWidth={2}
          className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
    </Link>
  )
}
