"use client"

import { useMemo, useState } from "react"
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
      ),
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

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <BookingCard forAdvisor={forAdvisor} />
        <UpcomingCard
          forAdvisor={forAdvisor}
          meetings={upcoming}
          studentsByEmail={studentsByEmail}
          loading={meetingsQuery.isPending}
          configured={configured}
          failed={Boolean(data && data.configured && !data.ok)}
        />
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <IconTile icon={UserMultiple02Icon} />
            <div>
              <CardTitle>{forAdvisor ? "Your students’ meetings" : "Meetings by student"}</CardTitle>
              <CardDescription>
                {forAdvisor
                  ? "Thesis meetings on the shared calendar with each student you advise: how many have happened, and the last and next one."
                  : "Every senior’s thesis meetings from the shared calendar: how many have happened, the last and next one, and whether their advisor was on the invitation."}
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
                  {!forAdvisor && <TableHead>Advisor on invite</TableHead>}
                  <TableHead>Last meeting</TableHead>
                  <TableHead>Next meeting</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <MeetingRow key={r.student.id} row={r} now={now} forAdvisor={forAdvisor} />
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

function MeetingRow({ row, now, forAdvisor }: { row: StudentRow; now: number; forAdvisor: boolean }) {
  const { student, advisors, meetings: m } = row
  const status = statusOf(row, now)
  const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase()
  return (
    <TableRow>
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
      {!forAdvisor && (
        <TableCell className="text-muted-foreground tabular-nums">
          {m && m.held.length > 0 ? `${m.withAdvisor} of ${m.held.length}` : "–"}
        </TableCell>
      )}
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

function UpcomingCard({
  forAdvisor,
  meetings,
  studentsByEmail,
  loading,
  configured,
  failed,
}: {
  forAdvisor: boolean
  meetings: ThesisMeeting[]
  studentsByEmail: Map<string, RosterStudent>
  loading: boolean
  configured: boolean
  failed: boolean
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <IconTile icon={Calendar03Icon} />
          <div>
            <CardTitle>Booked in the next two weeks</CardTitle>
            <CardDescription>From the shared Senior Thesis Meetings calendar.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!configured ? (
          <p className="text-muted-foreground text-sm">
            {forAdvisor
              ? "Bookings show here once the shared meetings calendar is connected."
              : "Connect the meetings calendar to list bookings here. The steps are under Meetings by student."}
          </p>
        ) : loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : failed ? (
          <p className="text-muted-foreground text-sm">
            The meetings calendar couldn&rsquo;t be read just now.
          </p>
        ) : meetings.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
            Nothing booked in the next two weeks.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {meetings.map((m) => {
              const who = [...studentsByEmail.entries()]
                .filter(([email]) => meetingIncludes(m, email))
                .map(([, s]) => studentName(s))
              return (
                <li key={m.id} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
                  <span className="text-sm font-medium">{formatMeetingTime(m.start)}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {who.length ? who.join(", ") : m.title || "Thesis meeting"}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
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
