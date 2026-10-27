"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon, CalendarAdd01Icon, UserMultiple02Icon } from "@hugeicons/core-free-icons"
import { ScheduleCard, useSchoolCalendar } from "@/components/class-schedule"
import { advisorAllowsProduct, advisorName, type Advisor } from "@/lib/advisors"
import { classYearOf, currentClassYear, studentName, type RosterStudent } from "@/lib/students"
import { useAdvisorAssignments, useAdvisors, useStudents } from "@/lib/queries"
import {
  THESIS_BOOKING_URL,
  bookingEmbedUrl,
  fetchThesisMeetings,
  formatMeetingTime,
  meetingIncludes,
  meetingsForStudent,
  type StudentMeetings,
  type ThesisMeeting,
} from "@/lib/thesis-meetings"
import { relativeTime } from "@/lib/format-time"
import { CLASS_MEETING, formatCalendarDate, type MeetingSession } from "@/lib/school-calendar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/** A student who hasn't met in this long, with nothing booked, needs a nudge. */
const STALE_DAYS = 21
const DAY_MS = 86_400_000
/** How far ahead the upcoming list looks. */
const UPCOMING_DAYS = 14

export function useThesisMeetings() {
  return useQuery({
    queryKey: ["thesis-meetings"],
    queryFn: fetchThesisMeetings,
    staleTime: 60_000,
  })
}

interface StudentRow {
  student: RosterStudent
  advisors: Advisor[]
  /** On an advisor's own page, the viewer is always the advisor. */
  hasAdvisor: boolean
  meetings: StudentMeetings | null
}

/**
 * Thesis meetings: when the class meets, the booking page, what's booked in
 * the next two weeks, and a per-student breakdown of whether meetings are
 * happening. Thesis supervisors and advisors book; students never do, they
 * are only guests on the meeting.
 *
 * Staff (the Schedule tab of the Advisors page) see every senior. With
 * `advisorId` (an advisor's home page) it covers only that advisor's own
 * Business Thesis students, and the API already returns only their meetings.
 */
export function ThesisSchedule({
  advisorId,
  showClassSchedule = true,
}: {
  advisorId?: string | number | null
  showClassSchedule?: boolean
} = {}) {
  const forAdvisor = advisorId != null
  const [day, setDay] = useState<MeetingSession | null>(null)
  const [openStudentId, setOpenStudentId] = useState<string | null>(null)
  const calendarQuery = useSchoolCalendar()
  const meetingsQuery = useThesisMeetings()
  const advisorsQuery = useAdvisors()
  const assignmentsQuery = useAdvisorAssignments()
  const studentsQuery = useStudents()
  const [now] = useState(() => Date.now())

  const data = meetingsQuery.data
  const meetings = useMemo(() => (data?.ok ? data.meetings : []), [data])

  const rows = useMemo<StudentRow[] | null>(() => {
    const advisors = advisorsQuery.data
    const assignments = assignmentsQuery.data
    const students = studentsQuery.data
    if (!advisors || !assignments || !students) return null
    const active = new Map(
      advisors
        .filter((a) => a.isActive !== false && advisorAllowsProduct(a, "business-thesis"))
        .map((a) => [Number(a.id), a])
    )
    const year = currentClassYear()
    const advisedIds = forAdvisor
      ? new Set(
          assignments
            .filter((a) => a.type === "business-thesis" && Number(a.advisors_id) === Number(advisorId))
            .map((a) => String(a.students_id))
        )
      : null
    return students
      .filter((s) => (advisedIds ? advisedIds.has(String(s.id)) : classYearOf(s) === year))
      .map((student) => {
        const mine = assignments
          .filter((a) => a.type === "business-thesis" && String(a.students_id) === String(student.id))
          .map((a) => active.get(Number(a.advisors_id)))
          .filter((a): a is Advisor => Boolean(a))
        return {
          student,
          advisors: mine,
          hasAdvisor: forAdvisor || mine.length > 0,
          meetings: data?.ok
            ? meetingsForStudent(meetings, student, mine.map((a) => a.email), now)
            : null,
        }
      })
      .sort((x, y) => attentionRank(x, now) - attentionRank(y, now) || studentName(x.student).localeCompare(studentName(y.student)))
  }, [advisorsQuery.data, assignmentsQuery.data, studentsQuery.data, data, meetings, now, forAdvisor, advisorId])

  const studentsByEmail = useMemo(
    () =>
      new Map(
        (studentsQuery.data ?? []).map((s) => [(s.studentEmail ?? "").trim().toLowerCase(), s])
      ),
    [studentsQuery.data]
  )

  const upcoming = useMemo(
    () =>
      meetings.filter(
        (m) => !m.canceled && m.start > now && m.start < now + UPCOMING_DAYS * DAY_MS
      ).sort((a, b) => a.start - b.start),
    [meetings, now]
  )

  const configured = data?.configured !== false

  return (
    <div className="flex flex-col gap-6">
      {showClassSchedule && (
        <ScheduleCard days={calendarQuery.data} status={calendarQuery.status} onSelectDay={setDay} />
      )}
      <DaySheet
        day={day}
        onClose={() => setDay(null)}
        meetings={meetings}
        studentsByEmail={studentsByEmail}
        loading={meetingsQuery.isPending}
        configured={configured}
        forAdvisor={forAdvisor}
      />

      <BookingCard forAdvisor={forAdvisor} />
      <UpcomingCard
        forAdvisor={forAdvisor}
        meetings={upcoming}
        rows={rows}
        loading={meetingsQuery.isPending}
        configured={configured}
        failed={Boolean(data && data.configured && !data.ok)}
        onOpenStudent={setOpenStudentId}
      />
      <StudentMeetingsSheet
        row={rows?.find((r) => String(r.student.id) === openStudentId) ?? null}
        meetings={meetings}
        now={now}
        forAdvisor={forAdvisor}
        onClose={() => setOpenStudentId(null)}
      />

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <IconTile icon={UserMultiple02Icon} />
            <div>
              <CardTitle>{forAdvisor ? "Your students’ meetings" : "Meetings by student"}</CardTitle>
              <CardDescription>
                {forAdvisor
                  ? "Thesis meetings on the shared calendar with each student you advise: how many have happened, and the last and next one."
                  : "Every senior’s thesis meetings from the shared calendar: how many have happened, and the last and next one."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {!configured ? (
            forAdvisor ? (
              <p className="text-muted-foreground px-6 text-sm">
                Meeting tracking isn&rsquo;t connected yet. SailFuture Academy staff are setting up
                the shared meetings calendar.
              </p>
            ) : (
              <SetupSteps />
            )
          ) : !rows || meetingsQuery.isPending ? (
            <div className="space-y-2 px-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data?.ok ? (
            <p className="text-muted-foreground px-6 text-sm">
              The meetings calendar couldn&rsquo;t be read just now. Try again in a few minutes.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground px-6 text-sm">
              {forAdvisor ? "No Business Thesis students are assigned to you yet." : "No seniors on the roster yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Student</TableHead>
                  {!forAdvisor && <TableHead>Advisor</TableHead>}
                  <TableHead className="text-right">Met</TableHead>
                  <TableHead>Last meeting</TableHead>
                  <TableHead>Next meeting</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <MeetingRow
                    key={r.student.id}
                    row={r}
                    now={now}
                    forAdvisor={forAdvisor}
                    onOpen={() => setOpenStudentId(String(r.student.id))}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Lower sorts first: students who need a meeting lead the table. */
function attentionRank(r: StudentRow, now: number): number {
  const s = statusOf(r, now)
  return s.tone === "warn" ? 0 : s.tone === "muted" ? 2 : 1
}

function statusOf(r: StudentRow, now: number): { label: string; tone: "warn" | "ok" | "muted" } {
  const m = r.meetings
  if (!m) return { label: "–", tone: "muted" }
  if (m.next) return { label: "Booked", tone: "ok" }
  if (!m.last) return { label: r.hasAdvisor ? "No meetings yet" : "No advisor, no meetings", tone: "warn" }
  const days = Math.floor((now - m.last.start) / DAY_MS)
  if (days > STALE_DAYS) return { label: `Last met ${Math.floor(days / 7)} weeks ago`, tone: "warn" }
  return { label: "On track", tone: "ok" }
}

/** Table rows that open a sheet: click, or Enter/Space when focused. */
function rowButtonProps(open: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: open,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        open()
      }
    },
    className: "focus-visible:bg-muted/60 cursor-pointer outline-none",
  }
}

const initialsOf = (s: RosterStudent) => `${s.firstName.charAt(0)}${s.lastName.charAt(0)}`.toUpperCase()

function MeetingRow({
  row,
  now,
  forAdvisor,
  onOpen,
}: {
  row: StudentRow
  now: number
  forAdvisor: boolean
  onOpen: () => void
}) {
  const { student, advisors, meetings: m } = row
  const status = statusOf(row, now)
  const initials = initialsOf(student)
  return (
    <TableRow {...rowButtonProps(onOpen)} aria-label={`${studentName(student)}: meetings`}>
      <TableCell className="pl-6">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-7">
            <AvatarImage src={student.profileImage || undefined} alt="" />
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{studentName(student)}</span>
        </div>
      </TableCell>
      {!forAdvisor && (
        <TableCell className="text-muted-foreground">
          {advisors.length ? advisors.map(advisorName).join(", ") : "None"}
        </TableCell>
      )}
      <TableCell className="text-right tabular-nums">{m?.held.length ?? "–"}</TableCell>
      <TableCell className="text-muted-foreground">
        {m?.last ? (
          <span title={formatMeetingTime(m.last.start)}>{relativeTime(m.last.start, now)}</span>
        ) : (
          "–"
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {m?.next ? formatMeetingTime(m.next.start) : "–"}
      </TableCell>
      <TableCell className="pr-6">
        <span
          className={cn(
            "text-sm",
            status.tone === "warn" && "font-medium text-amber-700",
            status.tone === "muted" && "text-muted-foreground"
          )}
        >
          {status.label}
        </span>
      </TableCell>
    </TableRow>
  )
}

function IconTile({ icon }: { icon: typeof Calendar03Icon }) {
  return (
    <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
      <HugeiconsIcon icon={icon} strokeWidth={2} className="text-primary size-5" />
    </div>
  )
}

/** Google's booking page, inline when it can be framed, else as a link. */
function BookingCard({ forAdvisor }: { forAdvisor: boolean }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <IconTile icon={CalendarAdd01Icon} />
          <div>
            <CardTitle>Book a thesis meeting</CardTitle>
            <CardDescription>
              {forAdvisor
                ? "Pick an open time during class to meet with one of your students. Add the student as a guest so it lands on their calendar and counts below."
                : "Open times during class for thesis advisors and supervisors to meet with a student. Each booking lands on the shared Senior Thesis Meetings calendar; add the student as a guest so it counts for them."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <BookingEmbed forAdvisor={forAdvisor} />
      </CardContent>
    </Card>
  )
}

/** Google's booking page, inline when it can be framed, else as a link. */
function BookingEmbed({ forAdvisor, className }: { forAdvisor: boolean; className?: string }) {
  const embed = THESIS_BOOKING_URL ? bookingEmbedUrl(THESIS_BOOKING_URL) : null
  if (embed) {
    return (
      <iframe
        src={embed}
        title="Book a thesis meeting"
        className={cn("h-[640px] w-full rounded-lg border-0", className)}
        loading="lazy"
      />
    )
  }
  if (THESIS_BOOKING_URL) {
    return (
      <Button asChild>
        <a href={THESIS_BOOKING_URL} target="_blank" rel="noopener noreferrer">
          Open the booking page
        </a>
      </Button>
    )
  }
  return (
    <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
      {forAdvisor
        ? "Booking isn’t open yet. SailFuture Academy staff are setting up the meeting times."
        : "The booking page isn’t connected yet. Once the appointment schedule exists in Google Calendar, set its inline embed link as NEXT_PUBLIC_THESIS_BOOKING_URL in Vercel and redeploy."}
    </p>
  )
}

/** The school's calendar date (YYYY-MM-DD) a meeting falls on. */
const dayKey = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(ms))

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  })

/**
 * One class day: what's already booked on it, then the booking page so a
 * supervisor or advisor can book a time without leaving the schedule.
 */
function DaySheet({
  day,
  onClose,
  meetings,
  studentsByEmail,
  loading,
  configured,
  forAdvisor,
}: {
  day: MeetingSession | null
  onClose: () => void
  meetings: ThesisMeeting[]
  studentsByEmail: Map<string, RosterStudent>
  loading: boolean
  configured: boolean
  forAdvisor: boolean
}) {
  const booked = useMemo(
    () =>
      day
        ? meetings.filter((m) => !m.canceled && dayKey(m.start) === day.date).sort((a, b) => a.start - b.start)
        : [],
    [day, meetings]
  )
  return (
    <Sheet open={day !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="shrink-0 gap-1 border-b px-6 py-5 pr-12">
          <SheetTitle className="text-lg font-semibold">
            {day ? formatCalendarDate(day.date) : "Class day"}
          </SheetTitle>
          <SheetDescription>
            {day?.session ?? "Class session"}, {CLASS_MEETING.startLabel} – {CLASS_MEETING.endLabel} Eastern.
            {day?.status === "unknown" && " Not on the school calendar yet."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section>
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Booked this day
            </p>
            {!configured ? (
              <p className="text-muted-foreground mt-2 text-sm">
                Bookings show here once the shared meetings calendar is connected.
              </p>
            ) : loading ? (
              <div className="mt-2 space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : booked.length === 0 ? (
              <p className="text-muted-foreground mt-2 rounded-lg border border-dashed p-3 text-sm">
                Nothing booked yet.
              </p>
            ) : (
              <ul className="mt-2 divide-y overflow-hidden rounded-lg border">
                {booked.map((m) => {
                  const who = [...studentsByEmail.entries()]
                    .filter(([email]) => meetingIncludes(m, email))
                    .map(([, s]) => studentName(s))
                  return (
                    <li key={m.id} className="flex items-baseline gap-3 px-4 py-3">
                      <span className="w-32 shrink-0 text-sm font-medium tabular-nums">
                        {clock(m.start)} – {clock(m.end)}
                      </span>
                      <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
                        {who.length ? who.join(", ") : m.title || "Thesis meeting"}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          <section>
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Book a time
            </p>
            <p className="text-muted-foreground mt-1 mb-3 text-sm">
              Pick a time on this day, then add the student as a guest.
            </p>
            <BookingEmbed forAdvisor={forAdvisor} />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * What's booked in the next two weeks, as a table: when, who and with which
 * advisor. A row with a student on it opens that student's meetings.
 */
function UpcomingCard({
  forAdvisor,
  meetings,
  rows,
  loading,
  configured,
  failed,
  onOpenStudent,
}: {
  forAdvisor: boolean
  meetings: ThesisMeeting[]
  rows: StudentRow[] | null
  loading: boolean
  configured: boolean
  failed: boolean
  onOpenStudent: (studentId: string) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <IconTile icon={Calendar03Icon} />
          <div>
            <CardTitle>Booked in the next two weeks</CardTitle>
            <CardDescription>
              From the shared Senior Thesis Meetings calendar. Select a meeting to see that
              student&rsquo;s meetings.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {!configured ? (
          <p className="text-muted-foreground px-6 text-sm">
            {forAdvisor
              ? "Bookings show here once the shared meetings calendar is connected."
              : "Connect the meetings calendar to list bookings here. The steps are under Meetings by student."}
          </p>
        ) : loading ? (
          <div className="space-y-2 px-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : failed ? (
          <p className="text-muted-foreground px-6 text-sm">
            The meetings calendar couldn&rsquo;t be read just now.
          </p>
        ) : meetings.length === 0 ? (
          <p className="text-muted-foreground mx-6 rounded-lg border border-dashed p-3 text-sm">
            Nothing booked in the next two weeks.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Student</TableHead>
                {!forAdvisor && <TableHead className="pr-6">Advisor</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {meetings.map((m) => {
                const who = (rows ?? []).filter((r) => meetingIncludes(m, r.student.studentEmail))
                const first = who[0]
                return (
                  <TableRow
                    key={m.id}
                    {...(first ? rowButtonProps(() => onOpenStudent(String(first.student.id))) : {})}
                  >
                    <TableCell className="pl-6 font-medium">{formatDay(m.start)}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {clock(m.start)} – {clock(m.end)}
                    </TableCell>
                    <TableCell>
                      {who.length ? (
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-7">
                            <AvatarImage src={first!.student.profileImage || undefined} alt="" />
                            <AvatarFallback className="text-[10px]">{initialsOf(first!.student)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{who.map((r) => studentName(r.student)).join(", ")}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{m.title || "Thesis meeting"}</span>
                      )}
                    </TableCell>
                    {!forAdvisor && (
                      <TableCell className="text-muted-foreground pr-6">
                        {first?.advisors.length ? first.advisors.map(advisorName).join(", ") : "–"}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

/** "Thu, Oct 29" in the school's zone. */
const formatDay = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  })

type MeetingState = "Held" | "Upcoming" | "Canceled" | "Declined"

function meetingState(m: ThesisMeeting, studentEmail: string, now: number): MeetingState {
  if (m.canceled) return "Canceled"
  if (m.attendees.some((a) => a.email === studentEmail && a.response === "DECLINED")) return "Declined"
  return m.start > now ? "Upcoming" : "Held"
}

/**
 * One student's thesis meetings: totals, every meeting on the shared
 * calendar (upcoming first, then past), and links into their thesis.
 */
function StudentMeetingsSheet({
  row,
  meetings,
  now,
  forAdvisor,
  onClose,
}: {
  row: StudentRow | null
  meetings: ThesisMeeting[]
  now: number
  forAdvisor: boolean
  onClose: () => void
}) {
  const student = row?.student
  const email = (student?.studentEmail ?? "").trim().toLowerCase()
  const list = useMemo(() => {
    if (!email) return []
    const mine = meetings.filter(
      (m) =>
        m.mentions.includes(email) || m.attendees.some((a) => a.email === email)
    )
    const upcoming = mine.filter((m) => m.start > now).sort((a, b) => a.start - b.start)
    const past = mine.filter((m) => m.start <= now).sort((a, b) => b.start - a.start)
    return [...upcoming, ...past]
  }, [meetings, email, now])
  const m = row?.meetings
  const id = student ? String(student.id) : ""

  return (
    <Sheet open={row !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 gap-3 border-b px-6 py-5 pr-12">
          <div className="flex items-center gap-3">
            <Avatar className="size-11">
              <AvatarImage src={student?.profileImage || undefined} alt="" />
              <AvatarFallback>{student ? initialsOf(student) : ""}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg font-semibold">
                {student ? studentName(student) : "Student"}
              </SheetTitle>
              <SheetDescription className="truncate">
                {forAdvisor
                  ? "Your thesis meetings with this student"
                  : row?.advisors.length
                    ? `Advisor: ${row.advisors.map(advisorName).join(", ")}`
                    : "No thesis advisor yet"}
              </SheetDescription>
            </div>
          </div>
          {student && (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`/admin/business-thesis/${id}`}>Open Business Thesis</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/business-thesis/${id}/review`}>Review</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={`/public/business-thesis/${id}`} target="_blank" rel="noopener noreferrer">
                  Public page
                </a>
              </Button>
            </div>
          )}
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {m && (
            <div className="grid grid-cols-3 gap-3">
              <SheetStat label="Met" value={m.held.length} />
              <SheetStat label="Upcoming" value={m.upcoming.length} />
              <SheetStat label="Canceled" value={m.canceled} />
            </div>
          )}
          {list.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
              No thesis meetings on the shared calendar yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Meeting</TableHead>
                    <TableHead className="pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((mt) => {
                    const state = meetingState(mt, email, now)
                    return (
                      <TableRow key={mt.id}>
                        <TableCell className="pl-4 font-medium">{formatDay(mt.start)}</TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {clock(mt.start)} – {clock(mt.end)}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[14rem] truncate">
                          {mt.title || "Thesis meeting"}
                        </TableCell>
                        <TableCell className="pr-4">
                          <span
                            className={cn(
                              "text-sm",
                              state === "Held" && "font-medium",
                              state === "Upcoming" && "text-primary font-medium",
                              (state === "Canceled" || state === "Declined") && "text-muted-foreground line-through"
                            )}
                          >
                            {state}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SheetStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

/** Shown until THESIS_MEETINGS_ICS_URL is set on the server. */
function SetupSteps() {
  return (
    <div className="px-6 text-sm">
      <p className="text-muted-foreground">
        The meetings calendar isn&rsquo;t connected yet. Setting it up takes a few minutes in
        Google Calendar, signed in with a SailFuture account:
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5">
        <li>Create a calendar named Senior Thesis Meetings.</li>
        <li>
          Share it with teachers and supervisors (make changes) and with each thesis advisor
          (see all event details).
        </li>
        <li>
          Create an appointment schedule for the class times, saving bookings to that calendar.
          Thesis supervisors and advisors book it from this page; students don&rsquo;t book.
        </li>
        <li>
          When booking, add the student as a guest. A meeting counts for a student only when
          their email is on it.
        </li>
        <li>
          Copy the calendar&rsquo;s secret iCal address into THESIS_MEETINGS_ICS_URL in Vercel,
          and the schedule&rsquo;s inline embed link into NEXT_PUBLIC_THESIS_BOOKING_URL.
        </li>
      </ol>
    </div>
  )
}
