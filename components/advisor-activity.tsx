"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  ArrowLeft02Icon,
  ArrowRight01Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Comment01Icon,
} from "@hugeicons/core-free-icons"
import {
  advisorAllowsProduct,
  advisorInitials,
  advisorName,
  type Advisor,
  type AdvisorProduct,
} from "@/lib/advisors"
import { buildAdvisorActivity, type ActivityItem, type ActivityKind } from "@/lib/advisor-activity"
import { BUSINESSTHESIS_API_CONFIG } from "@/lib/form-api-config"
import { cachedFetch } from "@/lib/cached-fetch"
import type { Comment } from "@/lib/form-types"
import { dateTime, relativeTime } from "@/lib/format-time"
import { useAdvisorAssignments, useAdvisors, useStudents } from "@/lib/queries"
import type { ResponseEvent } from "@/lib/response-events"
import { classYearOf, currentClassYear, studentName, type RosterStudent } from "@/lib/students"
import { formatMeetingTime, meetingIncludes } from "@/lib/thesis-meetings"
import { cn } from "@/lib/utils"
import { Kpi, useThesisProgress } from "@/components/supervisor-dashboard"
import { StatusCount } from "@/components/status-count"
import { useThesisMeetings } from "@/components/thesis-schedule"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/** Thesis advisors work on the business thesis. */
const PRODUCT: AdvisorProduct = "business-thesis"
const CFG = BUSINESSTHESIS_API_CONFIG

export const ADVISOR_ACTIVITY_HREF = "/admin/advisor-activity"

export const advisorActivityHref = (advisorId: number | string) => `${ADVISOR_ACTIVITY_HREF}/${advisorId}`

const studentInitials = (s: RosterStudent) => `${s.firstName.charAt(0)}${s.lastName.charAt(0)}`.toUpperCase() || "?"

const byStudentName = (a: RosterStudent, b: RosterStudent) =>
  `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)

// ---------------------------------------------------------------------------
// The index: every senior and their thesis advisor
// ---------------------------------------------------------------------------

/**
 * Every senior with their thesis advisor. A row opens that advisor's page:
 * what they've commented, the revisions they've asked for and their meetings.
 */
export function AdvisorActivityIndex() {
  const router = useRouter()
  const advisorsQuery = useAdvisors()
  const assignmentsQuery = useAdvisorAssignments()
  const studentsQuery = useStudents()
  const meetingsQuery = useThesisMeetings()
  const progressQuery = useThesisProgress()
  const [now] = useState(() => Date.now())

  const rows = useMemo(() => {
    const advisors = advisorsQuery.data
    const assignments = assignmentsQuery.data
    const students = studentsQuery.data
    if (!advisors || !assignments || !students) return null
    const active = new Map(
      advisors
        .filter((a) => a.isActive !== false && advisorAllowsProduct(a, PRODUCT))
        .map((a) => [Number(a.id), a])
    )
    const year = currentClassYear()
    return students
      .filter((s) => classYearOf(s) === year)
      .sort(byStudentName)
      .map((student) => ({
        student,
        advisors: assignments
          .filter((a) => a.type === PRODUCT && String(a.students_id) === String(student.id))
          .map((a) => active.get(Number(a.advisors_id)))
          .filter((a): a is Advisor => Boolean(a)),
      }))
  }, [advisorsQuery.data, assignmentsQuery.data, studentsQuery.data])

  const meetings = meetingsQuery.data?.ok && meetingsQuery.data.configured ? meetingsQuery.data.meetings : null
  const progress = progressQuery.data

  return (
    <div className={PAGE}>
      <div>
        <h1 className="text-2xl font-bold">Advisor activity</h1>
        <p className="text-muted-foreground mt-1">
          Every senior and their thesis advisor. Select a student to see what their advisor has
          commented, the revisions they&rsquo;ve asked for and their meetings.
        </p>
      </div>

      <Card>
        <CardContent className="px-0">
          {!rows ? (
            <div className="space-y-2 px-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground px-6 text-sm">No seniors on the roster yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Student</TableHead>
                  <TableHead>Thesis advisor</TableHead>
                  <TableHead>Waiting on review</TableHead>
                  <TableHead className="pr-6">Last meeting together</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ student, advisors }) => {
                  const first = advisors[0]
                  const open = first ? () => router.push(advisorActivityHref(first.id)) : undefined
                  const p = progress?.byStudent.get(String(student.id))
                  const last = meetings
                    ? meetings
                        .filter(
                          (m) =>
                            !m.canceled &&
                            m.start <= now &&
                            meetingIncludes(m, student.studentEmail) &&
                            advisors.some((a) => meetingIncludes(m, a.email))
                        )
                        .reduce<number | null>((max, m) => (max === null || m.start > max ? m.start : max), null)
                    : undefined
                  return (
                    <TableRow
                      key={student.id}
                      {...(open
                        ? {
                            role: "button",
                            tabIndex: 0,
                            "aria-label": `${studentName(student)}: ${advisorName(first!)}’s activity`,
                            onClick: open,
                            onKeyDown: (e: React.KeyboardEvent) => {
                              if (e.target !== e.currentTarget) return
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                open()
                              }
                            },
                            className: "focus-visible:bg-muted/60 cursor-pointer outline-none",
                          }
                        : {})}
                    >
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-7">
                            <AvatarImage src={student.profileImage || undefined} alt="" />
                            <AvatarFallback className="text-[10px]">{studentInitials(student)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{studentName(student)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {advisors.length === 0 ? (
                          <span className="text-sm font-medium text-amber-700">No advisor yet</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            {advisors.map((a) => (
                              <Link
                                key={a.id}
                                href={advisorActivityHref(a.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-2 hover:underline"
                              >
                                <Avatar className="size-7">
                                  <AvatarImage src={a.profileImage || undefined} alt="" />
                                  <AvatarFallback className="text-[10px]">{advisorInitials(a)}</AvatarFallback>
                                </Avatar>
                                {advisorName(a)}
                              </Link>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {progressQuery.isPending ? (
                          <Skeleton className="h-7 w-16 rounded-lg" />
                        ) : p && (p.pending > 0 || p.revisions > 0) ? (
                          <span className="flex items-center gap-1.5">
                            <StatusCount kind="ready" count={p.pending} size="sm" />
                            <StatusCount kind="revision" count={p.revisions} size="sm" />
                          </span>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground pr-6">
                        <span className="flex items-center gap-2">
                          {meetingsQuery.isPending ? (
                            <Skeleton className="h-4 w-20" />
                          ) : last ? (
                            <span title={formatMeetingTime(last)}>{relativeTime(last, now)}</span>
                          ) : last === null && advisors.length > 0 ? (
                            "None yet"
                          ) : (
                            "–"
                          )}
                          {open && (
                            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="ml-auto size-4 shrink-0" />
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// One advisor
// ---------------------------------------------------------------------------

interface RawActivity {
  comments: Comment[]
  events: ResponseEvent[]
  template: unknown
  sections: unknown
}

/** The advisor's students' comments and review events, plus the template
    that names the questions they're on. Two reads per student. */
function useAdvisorRecords(advisorId: number, studentIds: string[] | null) {
  return useQuery<RawActivity>({
    queryKey: ["advisor-activity", advisorId, studentIds?.join(",") ?? ""],
    enabled: studentIds !== null,
    queryFn: async () => {
      const list = async <T,>(url: string): Promise<T[]> => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`${url} returned ${res.status}`)
        const rows = await res.json()
        return Array.isArray(rows) ? (rows as T[]) : []
      }
      const [template, sections, ...perStudent] = await Promise.all([
        cachedFetch(CFG.templateEndpoint).then((r) => (r.ok ? r.json() : [])),
        cachedFetch(CFG.sectionsEndpoint).then((r) => (r.ok ? r.json() : [])),
        ...(studentIds ?? []).map(async (id) => ({
          comments: await list<Comment>(`${CFG.commentsEndpoint}?students_id=${id}`),
          events: CFG.responseEventsEndpoint
            ? await list<ResponseEvent>(`${CFG.responseEventsEndpoint}?students_id=${id}`)
            : [],
        })),
      ])
      return {
        template,
        sections,
        comments: perStudent.flatMap((p) => p.comments),
        events: perStudent.flatMap((p) => p.events),
      }
    },
  })
}

type Filter = "all" | ActivityKind

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "comment", label: "Comments" },
  { value: "revision", label: "Reviews" },
  { value: "meeting", label: "Meetings" },
]

/**
 * One thesis advisor: who they advise, totals for their comments, revision
 * requests and meetings, and everything they've done in date order.
 */
export function AdvisorActivityDetail({ advisorId }: { advisorId: number }) {
  const advisorsQuery = useAdvisors()
  const assignmentsQuery = useAdvisorAssignments()
  const studentsQuery = useStudents()
  const meetingsQuery = useThesisMeetings()
  const progressQuery = useThesisProgress()
  const [now] = useState(() => Date.now())
  const [filter, setFilter] = useState<Filter>("all")

  const advisor = advisorsQuery.data?.find((a) => Number(a.id) === advisorId) ?? null
  const students = useMemo(() => {
    const assignments = assignmentsQuery.data
    const roster = studentsQuery.data
    if (!assignments || !roster) return null
    const ids = new Set(
      assignments
        .filter((a) => a.type === PRODUCT && Number(a.advisors_id) === advisorId)
        .map((a) => String(a.students_id))
    )
    return roster.filter((s) => ids.has(String(s.id))).sort(byStudentName)
  }, [assignmentsQuery.data, studentsQuery.data, advisorId])

  const recordsQuery = useAdvisorRecords(advisorId, students ? students.map((s) => String(s.id)) : null)
  const meetingsData = meetingsQuery.data
  const meetingsReadable = Boolean(meetingsData?.ok && meetingsData.configured)

  const activity = useMemo(() => {
    if (!advisor || !students || !recordsQuery.data) return null
    return buildAdvisorActivity({
      advisor,
      students,
      comments: recordsQuery.data.comments,
      events: recordsQuery.data.events,
      meetings: meetingsData?.ok ? meetingsData.meetings : [],
      template: recordsQuery.data.template,
      sections: recordsQuery.data.sections,
      cfg: CFG,
      now,
    })
  }, [advisor, students, recordsQuery.data, meetingsData, now])

  const waiting = useMemo(() => {
    if (!students || !progressQuery.data) return null
    let pending = 0
    let revisions = 0
    for (const s of students) {
      const p = progressQuery.data.byStudent.get(String(s.id))
      pending += p?.pending ?? 0
      revisions += p?.revisions ?? 0
    }
    return { pending, revisions }
  }, [students, progressQuery.data])

  if (advisorsQuery.isPending) {
    return (
      <div className={PAGE}>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-14 w-80 max-w-full" />
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }
  if (!advisor) {
    return (
      <div className={cn(PAGE, "gap-4")}>
        <BackLink />
        <p className="text-muted-foreground text-sm">That advisor isn&rsquo;t in the directory anymore.</p>
      </div>
    )
  }

  const loading = !activity
  const failed = recordsQuery.isError
  const items = activity ? (filter === "all" ? activity.items : activity.items.filter((i) => i.kind === filter)) : []
  const counts: Record<Filter, number> = {
    all: activity?.items.length ?? 0,
    comment: activity?.items.filter((i) => i.kind === "comment").length ?? 0,
    revision: activity?.items.filter((i) => i.kind === "revision").length ?? 0,
    meeting: activity?.items.filter((i) => i.kind === "meeting").length ?? 0,
  }
  const next = activity?.meetingsUpcoming[0]
  const studentById = new Map((students ?? []).map((s) => [String(s.id), s]))

  return (
    <div className={PAGE}>
      <BackLink />

      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-14">
          <AvatarImage src={advisor.profileImage || undefined} alt="" />
          <AvatarFallback className="text-lg">{advisorInitials(advisor)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{advisorName(advisor)}</h1>
            {advisor.isActive === false && <Badge variant="secondary">Deactivated</Badge>}
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Thesis advisor ·{" "}
            <a
              href={`mailto:${advisor.email}`}
              className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:underline"
            >
              {advisor.email}
            </a>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Kpi
          icon={Comment01Icon}
          label="Comments written"
          value={activity?.comments}
          note={
            activity && activity.revisionNotes > 0
              ? `${activity.revisionNotes} sent with a revision request`
              : undefined
          }
          loading={loading && !failed}
          failed={failed}
        />
        <Kpi
          icon={AlertCircleIcon}
          label="Revisions requested"
          dot="bg-red-500"
          value={activity?.revisionsRequested}
          note={
            waiting
              ? `${waiting.revisions} open and ${waiting.pending} ready for review now`
              : undefined
          }
          loading={loading && !failed}
          failed={failed}
        />
        <Kpi
          icon={Calendar03Icon}
          label="Meetings held"
          value={meetingsReadable ? activity?.meetingsHeld.length : "–"}
          note={
            !meetingsReadable
              ? "The meetings calendar couldn’t be read"
              : next
                ? `Next: ${formatMeetingTime(next.start)}`
                : "None booked"
          }
          warn={meetingsReadable && !next}
          loading={(loading && !failed) || meetingsQuery.isPending}
        />
        <Kpi
          icon={Clock01Icon}
          label="Last active"
          value={activity?.lastActiveAt ? relativeTime(activity.lastActiveAt, now) : "Not yet"}
          note={activity?.lastActiveAt ? dateTime(activity.lastActiveAt) : "No comments, reviews or meetings"}
          loading={loading && !failed}
          failed={failed}
        />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>{students?.length === 1 ? "Student" : "Students"}</CardTitle>
          <CardDescription>Who they advise, and what&rsquo;s waiting on a review.</CardDescription>
        </CardHeader>
        <CardContent>
          {!students ? (
            <Skeleton className="h-12 w-full" />
          ) : students.length === 0 ? (
            <p className="text-muted-foreground text-sm">No students assigned yet.</p>
          ) : (
            <ul className="-my-1.5 flex flex-col">
              {students.map((s) => {
                const p = progressQuery.data?.byStudent.get(String(s.id))
                return (
                  <li key={s.id} className="border-b py-1 last:border-b-0">
                    <Link
                      href={`${CFG.adminBasePath}/${s.id}/review`}
                      className="hover:bg-muted/60 focus-visible:ring-ring/50 -mx-2 flex min-h-11 items-center gap-3 rounded-lg px-2 py-1.5 transition-colors outline-none focus-visible:ring-[3px]"
                    >
                      <Avatar className="size-8">
                        <AvatarImage src={s.profileImage || undefined} alt="" />
                        <AvatarFallback className="text-xs">{studentInitials(s)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{studentName(s)}</span>
                      <StatusCount kind="ready" count={p?.pending ?? 0} size="sm" />
                      <StatusCount kind="revision" count={p?.revisions ?? 0} size="sm" />
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        strokeWidth={2}
                        className="text-muted-foreground size-4 shrink-0"
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            {advisorName(advisor)}&rsquo;s own comments, review decisions (revision requests and reopened work) and
            meetings, newest first.
          </CardDescription>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mt-2 min-w-0">
            <TabsList
              aria-label="Kind of activity"
              className="max-w-full justify-start overflow-x-auto [scrollbar-width:none]"
            >
              {FILTERS.map((f) => (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.label}
                  {activity && <span className="text-muted-foreground tabular-nums">{counts[f.value]}</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {failed ? (
            <p className="text-muted-foreground text-sm">
              The activity couldn&rsquo;t be loaded just now. Try again in a minute.
            </p>
          ) : loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm text-pretty">
{filter === "all"
                ? students && students.length === 0
                  ? "No students are assigned to this advisor yet, so there’s nothing to show."
                  : "Nothing yet. Comments, revision requests and meetings show here as they happen."
                : `No ${FILTERS.find((f) => f.value === filter)!.label.toLowerCase()} yet.`}
            </p>
          ) : (
            <ActivityStream
              items={items}
              now={now}
              studentById={studentById}
              showStudent={(students?.length ?? 0) > 1}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Meetings</CardTitle>
          <CardDescription>Thesis meetings with this advisor on the invitation.</CardDescription>
        </CardHeader>
        <CardContent>
          {meetingsQuery.isPending || !activity ? (
            <Skeleton className="h-12 w-full" />
          ) : !meetingsReadable ? (
            <p className="text-muted-foreground text-sm">The meetings calendar couldn&rsquo;t be read just now.</p>
          ) : activity.meetingsUpcoming.length + activity.meetingsHeld.length === 0 ? (
            <p className="text-muted-foreground text-sm">No meetings yet.</p>
          ) : (
            <ul className="divide-y">
              {[...activity.meetingsUpcoming, ...activity.meetingsHeld].map((m) => {
                const upcoming = m.start > now
                const who = (students ?? []).filter((s) => meetingIncludes(m, s.studentEmail)).map(studentName)
                return (
                  <li key={m.id} className="flex items-baseline gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{formatMeetingTime(m.start)}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {who.length ? who.join(", ") : m.title || "Thesis meeting"}
                      </span>
                    </span>
                    <span
                      className={cn("shrink-0 text-xs font-medium", upcoming ? "text-primary" : "text-muted-foreground")}
                    >
                      {upcoming ? "Upcoming" : "Held"}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Both pages are a single centred column. */
const PAGE = "mx-auto flex w-full max-w-4xl flex-1 flex-col items-stretch gap-6 p-4 md:p-6"

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
      <Link href={ADVISOR_ACTIVITY_HREF}>
        <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
        Advisor activity
      </Link>
    </Button>
  )
}

const KIND_ICON: Record<ActivityKind, { icon: typeof Comment01Icon; className: string }> = {
  comment: { icon: Comment01Icon, className: "text-muted-foreground" },
  revision: { icon: CheckmarkCircle02Icon, className: "text-muted-foreground" },
  meeting: { icon: Calendar03Icon, className: "text-primary" },
}

function dayLabel(ms: number, now: number): string {
  const day = new Date(ms).toDateString()
  if (day === new Date(now).toDateString()) return "Today"
  if (day === new Date(now - 86_400_000).toDateString()) return "Yesterday"
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear()
  return new Date(ms).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
}

const timeOfDay = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

/** The stream, a heading per day. */
function ActivityStream({
  items,
  now,
  studentById,
  showStudent,
}: {
  items: ActivityItem[]
  now: number
  studentById: Map<string, RosterStudent>
  /** Name the student on each entry: only useful with more than one. */
  showStudent: boolean
}) {
  const days: { label: string; items: ActivityItem[] }[] = []
  for (const item of items) {
    const label = dayLabel(item.at, now)
    const last = days[days.length - 1]
    if (last && last.label === label) last.items.push(item)
    else days.push({ label, items: [item] })
  }
  return (
    <div className="flex flex-col gap-5">
      {days.map((day) => (
        <section key={`${day.label}-${day.items[0].id}`}>
          <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">{day.label}</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {day.items.map((item) => {
              const k = item.emphasis ? { icon: AlertCircleIcon, className: "text-red-500" } : KIND_ICON[item.kind]
              const student = studentById.get(item.studentId)
              const body = (
                <>
                  <HugeiconsIcon icon={k.icon} strokeWidth={2} className={cn("mt-0.5 size-4 shrink-0", k.className)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {showStudent && student ? `${studentName(student)} · ` : ""}
                        {timeOfDay(item.at)}
                      </span>
                    </span>
                    {item.quote && (
                      <span className="text-muted-foreground mt-1 line-clamp-2 border-l-2 pl-2 text-xs italic">
                        {item.quote}
                      </span>
                    )}
                    {item.detail && (
                      <span className="text-muted-foreground mt-1 line-clamp-3 text-sm whitespace-pre-line">
                        {item.detail}
                      </span>
                    )}
                  </span>
                </>
              )
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="hover:bg-muted/60 focus-visible:ring-ring/50 -mx-2 flex items-start gap-3 rounded-lg px-2 py-2 transition-colors outline-none focus-visible:ring-[3px]"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="-mx-2 flex items-start gap-3 px-2 py-2">{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
