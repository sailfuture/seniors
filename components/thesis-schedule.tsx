"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon, CalendarAdd01Icon, UserMultiple02Icon } from "@hugeicons/core-free-icons"
import { ScheduleCard, useSchoolCalendarData } from "@/components/class-schedule"
import { advisorAllowsProduct, advisorName, type Advisor } from "@/lib/advisors"
import { classYearOf, currentClassYear, studentName, type RosterStudent } from "@/lib/students"
import { useAdvisorAssignments, useAdvisors, useStudents } from "@/lib/queries"
import {
  MEETING_MINUTES,
  bookThesisMeeting,
  bookingStartTimes,
  cancelThesisMeeting,
  fetchThesisMeetings,
  formatMeetingTime,
  formatSlot,
  meetingIncludes,
  meetingsForStudent,
  type StudentMeetings,
  type ThesisMeeting,
  type ThesisMeetingsResponse,
} from "@/lib/thesis-meetings"
import { relativeTime } from "@/lib/format-time"
import {
  CLASS_MEETING,
  addDays,
  defaultYear,
  eventCategory,
  formatCalendarDate,
  formatEventTime,
  meetingOutlook,
  schoolInstant,
  schoolNow,
  termsOfYear,
  yearsWithDays,
  type MeetingSession,
} from "@/lib/school-calendar"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
/** Class days offered for booking when the school calendar can't say how
    long the year runs. */
const BOOKING_WEEKS = 8

/** What the booking dialog opens on: a student, a class day, both or neither. */
interface BookingRequest {
  studentId?: string
  date?: string
}

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
 * Thesis meetings: when the class meets, every upcoming booking, and a
 * per-student breakdown of whether meetings are happening. Thesis
 * supervisors and advisors book an hour during class right here; the meeting
 * goes on the shared calendar and Google invites the student, their advisor
 * and the thesis supervisor. Students never book.
 *
 * Staff (the Schedule page) see every senior. With `advisorId` (an advisor's
 * home page) it covers only that advisor's own Business Thesis students, and
 * the API already returns only their meetings. `termPicker` lets the class
 * schedule switch between the year's terms instead of showing just the
 * current one.
 */
export function ThesisSchedule({
  advisorId,
  showClassSchedule = true,
  termPicker = false,
}: {
  advisorId?: string | number | null
  showClassSchedule?: boolean
  termPicker?: boolean
} = {}) {
  const forAdvisor = advisorId != null
  const [day, setDay] = useState<MeetingSession | null>(null)
  const [openStudentId, setOpenStudentId] = useState<string | null>(null)
  const [booking, setBooking] = useState<BookingRequest | null>(null)
  const calendarQuery = useSchoolCalendarData()
  const meetingsQuery = useThesisMeetings()
  const advisorsQuery = useAdvisors()
  const assignmentsQuery = useAdvisorAssignments()
  const studentsQuery = useStudents()
  const [now] = useState(() => Date.now())
  const [today] = useState(() => schoolNow().date)

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
      meetings.filter((m) => !m.canceled && m.start > now).sort((a, b) => a.start - b.start),
    [meetings, now]
  )

  const configured = data?.configured !== false
  /** Null while the meetings are still loading. */
  const canBook = data ? data.canBook === true : null

  // The class days a meeting can still be booked on: the rest of the school
  // year, or the coming weeks when the calendar can't say.
  const bookableDays = useMemo(() => {
    const cal = calendarQuery.data
    let through = addDays(today, BOOKING_WEEKS * 7 - 1)
    if (cal) {
      const year = defaultYear(yearsWithDays(cal), today)
      const terms = year ? termsOfYear(cal, year.id) : []
      const last = terms[terms.length - 1]
      if (last && last.end >= today) through = last.end
    }
    return meetingOutlook(cal?.days ?? [], { from: today, through }, undefined, cal?.events ?? []).sessions.filter(
      (s) => s.status !== "off"
    )
  }, [calendarQuery.data, today])

  // An advisor cancels only meetings they are on; staff cancel any.
  const viewerEmail = forAdvisor
    ? (advisorsQuery.data?.find((a) => Number(a.id) === Number(advisorId))?.email ?? "")
    : null

  return (
    <div className="flex flex-col gap-6">
      {showClassSchedule && (
        <ScheduleCard
          calendar={calendarQuery.data}
          status={calendarQuery.status}
          onSelectDay={setDay}
          termPicker={termPicker}
        />
      )}
      <DaySheet
        day={day}
        onClose={() => setDay(null)}
        meetings={meetings}
        studentsByEmail={studentsByEmail}
        loading={meetingsQuery.isPending}
        configured={configured}
        onBook={canBook === null ? undefined : (date) => setBooking({ date })}
      />

      <UpcomingCard
        forAdvisor={forAdvisor}
        onBook={canBook === null ? undefined : () => setBooking({})}
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
        viewerEmail={viewerEmail}
        canCancel={canBook === true}
        onBook={canBook === null ? undefined : (studentId) => setBooking({ studentId })}
        onClose={() => setOpenStudentId(null)}
      />
      <BookingDialog
        request={booking}
        onClose={() => setBooking(null)}
        forAdvisor={forAdvisor}
        canBook={canBook === true}
        missing={data?.missing ?? []}
        rows={rows ?? []}
        days={bookableDays}
        meetings={meetings}
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

/** "Book a thesis meeting": opens the booking dialog. */
function BookButton({
  onBook,
  label = "Book a thesis meeting",
  size,
  className,
}: {
  /** Undefined until the meetings have loaded. */
  onBook: (() => void) | undefined
  label?: string
  size?: "sm"
  className?: string
}) {
  return (
    <Button size={size} className={cn("gap-2", className)} disabled={!onBook} onClick={onBook}>
      <HugeiconsIcon icon={CalendarAdd01Icon} strokeWidth={2} className="size-4" />
      {label}
    </Button>
  )
}

/** Two stretches of time that share at least a minute. */
const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd

/**
 * Booking a thesis meeting, in the app: one student, a class day and an hour
 * inside the class session. Saving puts the meeting on the shared calendar
 * and Google emails the student, their advisor and the thesis supervisor.
 */
function BookingDialog({
  request,
  onClose,
  forAdvisor,
  canBook,
  missing,
  rows,
  days,
  meetings,
}: {
  /** What to open on; null while closed. */
  request: BookingRequest | null
  onClose: () => void
  forAdvisor: boolean
  canBook: boolean
  /** The settings the deployment lacks, when the server names them (staff only). */
  missing: string[]
  rows: StudentRow[]
  days: MeetingSession[]
  meetings: ThesisMeeting[]
}) {
  return (
    <Dialog open={request !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>Book a thesis meeting</DialogTitle>
          <DialogDescription>
            An hour during the senior class, {CLASS_MEETING.startLabel} – {CLASS_MEETING.endLabel} Eastern.
            More than one meeting can run at the same time.
          </DialogDescription>
        </DialogHeader>
        {request &&
          (canBook ? (
            <BookingForm
              request={request}
              onClose={onClose}
              forAdvisor={forAdvisor}
              rows={rows}
              days={days}
              meetings={meetings}
            />
          ) : (
            <div className="text-muted-foreground flex flex-col gap-2 rounded-lg border border-dashed p-4 text-sm">
              {forAdvisor ? (
                <p>Booking isn’t open yet. SailFuture Academy staff are connecting the meetings calendar.</p>
              ) : missing.length > 0 ? (
                <>
                  <p>
                    Booking isn’t connected to the meetings calendar yet. This deployment is missing{" "}
                    {missing.length === 1 ? "one setting" : `${missing.length} settings`}:
                  </p>
                  <ul className="text-foreground list-disc pl-5 font-mono text-xs break-words">
                    {missing.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                  <p>
                    Add {missing.length === 1 ? "it" : "them"} to this project in Vercel for the Production
                    environment, then redeploy.
                  </p>
                </>
              ) : (
                <p>
                  Booking isn’t connected to the meetings calendar yet. Add GOOGLE_CALENDAR_CLIENT_EMAIL,
                  GOOGLE_CALENDAR_PRIVATE_KEY and GOOGLE_CALENDAR_IMPERSONATE to this project in Vercel (the same
                  values the apply portal uses), then redeploy.
                </p>
              )}
            </div>
          ))}
      </DialogContent>
    </Dialog>
  )
}

function BookingForm({
  request,
  onClose,
  forAdvisor,
  rows,
  days,
  meetings,
}: {
  request: BookingRequest
  onClose: () => void
  forAdvisor: boolean
  rows: StudentRow[]
  days: MeetingSession[]
  meetings: ThesisMeeting[]
}) {
  const queryClient = useQueryClient()
  const [now] = useState(() => Date.now())
  // An advisor's own student is already chosen; staff pick from the class.
  const [studentId, setStudentId] = useState(
    () => request.studentId ?? (forAdvisor && rows[0] ? String(rows[0].student.id) : "")
  )
  const [date, setDate] = useState(() => request.date ?? days[0]?.date ?? "")
  const [picked, setPicked] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const row = rows.find((r) => String(r.student.id) === studentId) ?? null
  const day = days.find((d) => d.date === date) ?? null
  // A day opened from the schedule may not be in the list (the calendar is
  // still loading); it is still offered.
  const dayOptions = date && !day ? [{ date, conflict: false, isToday: false }, ...days] : days

  const times = useMemo(
    () =>
      bookingStartTimes().map((minutes) => {
        const start = date ? schoolInstant(date, minutes) : 0
        const end = start + MEETING_MINUTES * 60_000
        const sameTime = date
          ? meetings.filter((m) => !m.canceled && overlaps(m.start, m.end, start, end))
          : []
        return {
          minutes,
          past: Boolean(date) && start <= now,
          // One student can't be in two meetings at once.
          taken: Boolean(row) && sameTime.some((m) => meetingIncludes(m, row!.student.studentEmail)),
          others: sameTime.length,
        }
      }),
    [date, meetings, row, now]
  )
  const open = times.filter((t) => !t.past && !t.taken)
  const startMinutes = picked !== null && open.some((t) => t.minutes === picked) ? picked : (open[0]?.minutes ?? null)
  const chosen = times.find((t) => t.minutes === startMinutes) ?? null

  const first = row?.student.firstName || "the student"
  const guests = !row
    ? null
    : forAdvisor
      ? `Google Calendar emails an invitation to ${first}, you and the thesis supervisor.`
      : row.advisors.length
        ? `Google Calendar emails an invitation to ${first}, ${row.advisors.map(advisorName).join(" and ")}, the thesis supervisor and you.`
        : `${first} has no thesis advisor yet, so the invitation goes to ${first}, the thesis supervisor and you.`

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!row || !date || startMinutes === null || saving) return
    setSaving(true)
    setError(null)
    const result = await bookThesisMeeting({ studentId, date, startMinutes })
    if (!result.ok) {
      setSaving(false)
      setError(result.error)
      return
    }
    // Show it at once, then let the calendar confirm.
    queryClient.setQueryData<ThesisMeetingsResponse>(["thesis-meetings"], (old) =>
      old?.ok ? { ...old, meetings: [...old.meetings, result.meeting].sort((a, b) => a.start - b.start) } : old
    )
    void queryClient.invalidateQueries({ queryKey: ["thesis-meetings"] })
    toast.success(`Booked with ${studentName(row.student)}`, {
      description: `${formatCalendarDate(date)}, ${formatSlot(startMinutes)}. Invitations are on their way.`,
    })
    onClose()
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {forAdvisor ? "No Business Thesis students are assigned to you yet." : "No seniors on the roster yet."}
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="booking-student">Student</Label>
        {rows.length === 1 && row ? (
          <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2">
            <Avatar className="size-7">
              <AvatarImage src={row.student.profileImage || undefined} alt="" />
              <AvatarFallback className="text-[10px]">{initialsOf(row.student)}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{studentName(row.student)}</span>
          </div>
        ) : (
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger id="booking-student" className="w-full">
              <SelectValue placeholder="Choose a student" />
            </SelectTrigger>
            <SelectContent>
              {[...rows]
                .sort((a, b) => studentName(a.student).localeCompare(studentName(b.student)))
                .map((r) => (
                  <SelectItem key={r.student.id} value={String(r.student.id)}>
                    {studentName(r.student)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="booking-day">Class day</Label>
        {dayOptions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No class days are left on the school calendar.</p>
        ) : (
          <Select value={date} onValueChange={setDate}>
            <SelectTrigger id="booking-day" className="w-full">
              <SelectValue placeholder="Choose a class day" />
            </SelectTrigger>
            <SelectContent>
              {dayOptions.map((d) => (
                <SelectItem key={d.date} value={d.date}>
                  {formatCalendarDate(d.date)}
                  {d.isToday && " · today"}
                  {d.conflict && " · school event during class"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label id="booking-time-label">Time</Label>
        <div role="radiogroup" aria-labelledby="booking-time-label" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {times.map((t) => {
            const selected = t.minutes === startMinutes
            const unavailable = t.past || t.taken
            return (
              <Button
                key={t.minutes}
                type="button"
                role="radio"
                aria-checked={selected}
                variant={selected ? "default" : "outline"}
                disabled={unavailable || !date}
                title={t.taken ? `${first} already has a meeting then` : t.past ? "Already passed" : undefined}
                className="tabular-nums"
                onClick={() => setPicked(t.minutes)}
              >
                {formatSlot(t.minutes)}
              </Button>
            )
          })}
        </div>
        <p className="text-muted-foreground text-xs">
          {open.length === 0 && date
            ? times.some((t) => t.taken)
              ? `${first} is already booked for this class. Pick another day.`
              : "This class has passed. Pick another day."
            : chosen && chosen.others > 0
              ? `${chosen.others} other ${chosen.others === 1 ? "meeting is" : "meetings are"} booked at this time, which is fine.`
              : "Every meeting is an hour."}
        </p>
      </div>

      {guests && <p className="text-muted-foreground text-sm">{guests}</p>}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Not now
        </Button>
        <Button type="submit" disabled={!row || !date || startMinutes === null || saving}>
          {saving ? "Booking…" : "Book meeting"}
        </Button>
      </DialogFooter>
    </form>
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
 * One class day: what's already booked on it, and a button to book an hour
 * on that day.
 */
function DaySheet({
  day,
  onClose,
  meetings,
  studentsByEmail,
  loading,
  configured,
  onBook,
}: {
  day: MeetingSession | null
  onClose: () => void
  meetings: ThesisMeeting[]
  studentsByEmail: Map<string, RosterStudent>
  loading: boolean
  configured: boolean
  /** Opens booking on this day; undefined until the meetings have loaded. */
  onBook: ((date: string) => void) | undefined
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
            {day?.conflict && " A school event runs during class this day."}
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
          {day && day.events.length > 0 && (
            <section>
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                Event conflict
              </p>
              <ul className="mt-2 divide-y overflow-hidden rounded-lg border">
                {day.events.map((e) => {
                  return (
                    <li key={e.id} className="flex items-start gap-3 bg-amber-50/60 px-4 py-3 dark:bg-amber-500/5">
                      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", eventCategory(e).dot)} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{e.title}</span>
                        <span className="text-muted-foreground block text-xs">
                          {formatEventTime(e)}
                          {e.location && ` · ${e.location}`}
                          {e.mandatory && " · Mandatory"}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
          {day && !day.isPast && (
            <section>
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                Book a time
              </p>
              <p className="text-muted-foreground mt-1 mb-3 text-sm">
                An hour with a student during this class. The student, their advisor and the
                thesis supervisor get a calendar invitation.
              </p>
              <BookButton label="Book a time" onBook={onBook && (() => onBook(day.date))} />
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Every upcoming booking, as a table: when, who and with which
 * advisor. A row with a student on it opens that student's meetings.
 */
function UpcomingCard({
  forAdvisor,
  onBook,
  meetings,
  rows,
  loading,
  configured,
  failed,
  onOpenStudent,
}: {
  forAdvisor: boolean
  onBook: (() => void) | undefined
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
        <div className="flex flex-wrap items-center gap-3">
          <IconTile icon={Calendar03Icon} />
          <div className="min-w-0 flex-1">
            <CardTitle>Upcoming meetings</CardTitle>
            <CardDescription>
              From the shared Senior Thesis Meetings calendar. Select a meeting to see that
              student&rsquo;s meetings.
            </CardDescription>
          </div>
          <BookButton onBook={onBook} />
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
            Nothing booked yet.
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
 * One student's thesis meetings: a row per meeting on the shared calendar
 * (upcoming first, then past), booking another, and links into their thesis.
 */
function StudentMeetingsSheet({
  row,
  meetings,
  now,
  forAdvisor,
  viewerEmail,
  canCancel,
  onBook,
  onClose,
}: {
  row: StudentRow | null
  meetings: ThesisMeeting[]
  now: number
  forAdvisor: boolean
  /** An advisor's own email: they cancel only meetings they are on. Null for staff. */
  viewerEmail: string | null
  canCancel: boolean
  onBook: ((studentId: string) => void) | undefined
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
  const id = student ? String(student.id) : ""
  const [canceling, setCanceling] = useState<ThesisMeeting | null>(null)
  const cancelable = (m: ThesisMeeting, state: MeetingState) =>
    canCancel && state === "Upcoming" && (viewerEmail === null || meetingIncludes(m, viewerEmail))
  const anyCancelable = list.some((m) => cancelable(m, meetingState(m, email, now)))

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
              <BookButton size="sm" label="Book a meeting" onBook={onBook && (() => onBook(id))} />
              <Button asChild size="sm" variant="outline">
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
                    <TableHead className="pr-4">Status</TableHead>
                    {anyCancelable && <TableHead className="w-0 pr-4" />}
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
                        {anyCancelable && (
                          <TableCell className="pr-4 text-right">
                            {cancelable(mt, state) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Cancel the meeting on ${formatDay(mt.start)}`}
                                onClick={() => setCanceling(mt)}
                              >
                                Cancel
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <CancelMeetingDialog
          meeting={canceling}
          studentName={student ? studentName(student) : "this student"}
          onClose={() => setCanceling(null)}
        />
      </SheetContent>
    </Sheet>
  )
}

/** Confirms before a meeting leaves the calendar, since Google tells the guests. */
function CancelMeetingDialog({
  meeting,
  studentName: name,
  onClose,
}: {
  meeting: ThesisMeeting | null
  studentName: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [working, setWorking] = useState(false)

  async function confirm(e: React.MouseEvent) {
    e.preventDefault()
    if (!meeting || working) return
    setWorking(true)
    const error = await cancelThesisMeeting(meeting.id)
    setWorking(false)
    if (error) {
      toast.error(error)
      return
    }
    queryClient.setQueryData<ThesisMeetingsResponse>(["thesis-meetings"], (old) =>
      old?.ok ? { ...old, meetings: old.meetings.filter((m) => m.id !== meeting.id) } : old
    )
    void queryClient.invalidateQueries({ queryKey: ["thesis-meetings"] })
    toast.success("Meeting canceled")
    onClose()
  }

  return (
    <AlertDialog open={meeting !== null} onOpenChange={(o) => !o && !working && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this meeting?</AlertDialogTitle>
          <AlertDialogDescription>
            {meeting
              ? `${formatDay(meeting.start)}, ${clock(meeting.start)} – ${clock(meeting.end)} with ${name}. It comes off the shared calendar and Google tells everyone invited.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={working}>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={working}>
            {working ? "Canceling…" : "Cancel meeting"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Shown until the meetings calendar is connected on the server. */
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
          Copy the calendar&rsquo;s secret iCal address into THESIS_MEETINGS_ICS_URL in Vercel.
        </li>
        <li>
          Add GOOGLE_CALENDAR_CLIENT_EMAIL, GOOGLE_CALENDAR_PRIVATE_KEY and
          GOOGLE_CALENDAR_IMPERSONATE (the same values the apply portal uses), and make sure the
          impersonated account can make changes to the calendar. Supervisors and advisors then
          book from this page; students don&rsquo;t book.
        </li>
      </ol>
    </div>
  )
}
