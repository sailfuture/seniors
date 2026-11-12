"use client"

import { useMemo, useRef, useState, type RefObject } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowDown01Icon,
  Calendar03Icon,
  CalendarAdd01Icon,
  CalendarDownload01Icon,
  Copy01Icon,
  Delete02Icon,
  Tick02Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"
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
  type CalendarSubscription,
  type ThesisMeetingsResponse,
} from "@/lib/thesis-meetings"
import { relativeTime } from "@/lib/format-time"
import {
  CLASS_MEETING,
  addDays,
  defaultTerm,
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
import { Badge } from "@/components/ui/badge"
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
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import { InputGroupAddon } from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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

  // Every class day left in the current term (or the coming weeks when the
  // calendar can't say), including the ones that can't be booked: the day
  // picker shows those too, with the reason. A day opened from a later term's
  // schedule brings that term's days instead.
  const askedDate = booking?.date
  const bookableDays = useMemo(() => {
    const cal = calendarQuery.data
    let from = today
    let through = addDays(today, BOOKING_WEEKS * 7 - 1)
    if (cal) {
      const year = defaultYear(yearsWithDays(cal), today)
      const terms = (year ? termsOfYear(cal, year.id) : []).filter((t) => t.end >= today)
      const term =
        (askedDate ? terms.find((t) => t.start <= askedDate && askedDate <= t.end) : undefined) ??
        defaultTerm(terms, today)
      if (term) {
        if (term.start > today) from = term.start
        through = term.end
      }
    }
    return meetingOutlook(cal?.days ?? [], { from, through }, undefined, cal?.events ?? []).sessions
  }, [calendarQuery.data, today, askedDate])

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
        rows={rows}
        loading={meetingsQuery.isPending}
        configured={configured}
        onBook={canBook === null ? undefined : (date) => setBooking({ date })}
      />

      <UpcomingCard
        forAdvisor={forAdvisor}
        onBook={canBook === null ? undefined : () => setBooking({})}
        subscribe={data?.subscribe}
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
        rows={rows}
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
  /** Null while the roster is still loading. */
  rows: StudentRow[] | null
  days: MeetingSession[]
  meetings: ThesisMeeting[]
}) {
  // The student picker's popup mounts inside the dialog; a modal dialog
  // blocks clicks and scrolling anywhere else.
  const dialogRef = useRef<HTMLDivElement>(null)
  return (
    <Dialog open={request !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent ref={dialogRef} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>Book a thesis meeting</DialogTitle>
          <DialogDescription>
            An hour during the senior class, {CLASS_MEETING.startLabel} – {CLASS_MEETING.endLabel} Eastern.
            More than one meeting can run at the same time.
          </DialogDescription>
        </DialogHeader>
        {request &&
          (canBook && rows === null ? (
            // The form picks its student as it opens, so it waits for the roster.
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">Loading students…</p>
          ) : canBook && rows ? (
            <BookingForm
              request={request}
              onClose={onClose}
              container={dialogRef}
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

/** Why a class day can't be booked, or null when it can: school is closed,
    or a school event runs during class. */
function blockReason(s: MeetingSession): string | null {
  if (s.status === "off") return s.title ?? "No class"
  if (s.conflict) return s.events[0]?.title ?? "School event during class"
  return null
}

const utcDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d || 1))
}
/** "November 2026" for a "2026-11" key. */
const monthLabel = (key: string) =>
  utcDay(`${key}-01`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" })
/** "Thu, Nov 12" */
const dayLabel = (iso: string) =>
  utcDay(iso).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })
/** The reason in as few words as a dropdown row has room for. */
const shortReason = (s: MeetingSession): string | null =>
  s.status === "off" ? (s.kind === "holiday" ? "Holiday" : s.kind === "break" ? "School break" : "No class") : blockReason(s)

/** The closed face of a dropdown field: the chosen value, a note and a chevron. */
const FIELD_TRIGGER =
  "border-input bg-background dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 data-[state=open]:border-ring flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"

/** One choice in a dropdown list: the value, a note on the right, a tick when chosen. */
const FIELD_OPTION =
  "focus-visible:bg-accent flex w-full min-w-0 items-center gap-2 rounded-md py-1.5 pr-2 pl-2.5 text-left text-sm outline-none"

/**
 * The class day as a dropdown: the chosen day on its face, every class day
 * left behind it, month by month. A day that can't be booked stays in the
 * list, struck out, with the reason beside it.
 */
function ClassDayField({
  id,
  sessions,
  value,
  onChange,
  meetings,
  disabled,
}: {
  id: string
  sessions: MeetingSession[]
  value: string
  onChange: (date: string) => void
  meetings: ThesisMeeting[]
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const chosenRef = useRef<HTMLButtonElement>(null)
  const chosen = sessions.find((s) => s.date === value)

  const months = useMemo(() => {
    const byMonth = new Map<string, MeetingSession[]>()
    for (const s of sessions) {
      const key = s.date.slice(0, 7)
      byMonth.set(key, [...(byMonth.get(key) ?? []), s])
    }
    return [...byMonth.entries()]
  }, [sessions])

  // How many meetings each day already holds.
  const booked = useMemo(() => {
    const count = new Map<string, number>()
    for (const m of meetings) {
      if (m.canceled) continue
      const date = schoolNow(new Date(m.start)).date
      count.set(date, (count.get(date) ?? 0) + 1)
    }
    return count
  }, [meetings])

  return (
    // Modal, so the list scrolls: inside a dialog, a plain popover's wheel
    // events are swallowed by the dialog's scroll lock.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button type="button" id={id} disabled={disabled} className={FIELD_TRIGGER}>
          <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>
            {value ? dayLabel(value) : "Choose a class day"}
          </span>
          {chosen?.isToday && <span className="text-muted-foreground shrink-0 text-xs">Today</span>}
          <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="text-muted-foreground size-4 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-72 gap-0 p-0"
        // Open on the chosen day rather than the top of the list.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          chosenRef.current?.focus()
        }}
      >
        <div role="radiogroup" aria-label="Class day" className="max-h-72 overflow-y-auto overscroll-contain p-1">
          {months.map(([key, days]) => (
            <div key={key} role="presentation">
              <p className="bg-popover text-muted-foreground sticky -top-1 z-10 px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
                {monthLabel(key)}
              </p>
              {days.map((s) => {
                const reason = blockReason(s)
                const selected = s.date === value
                const count = booked.get(s.date) ?? 0
                const note = shortReason(s) ?? (s.isToday ? "Today" : count ? `${count} booked` : "")
                return (
                  <button
                    key={s.date}
                    ref={selected ? chosenRef : undefined}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${formatCalendarDate(s.date)}${reason ? `, can’t be booked: ${reason}` : ""}`}
                    title={reason ? `Can’t be booked: ${reason}` : undefined}
                    disabled={Boolean(reason)}
                    onClick={() => {
                      onChange(s.date)
                      setOpen(false)
                    }}
                    className={cn(
                      FIELD_OPTION,
                      reason ? "text-muted-foreground cursor-not-allowed" : "hover:bg-accent cursor-pointer"
                    )}
                  >
                    <span className={cn("shrink-0 tabular-nums", reason && "line-through", selected && "font-medium")}>
                      {dayLabel(s.date)}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-right text-xs",
                        reason && s.conflict ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground"
                      )}
                    >
                      {note}
                    </span>
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      strokeWidth={2}
                      className={cn("size-4 shrink-0", !selected && "invisible")}
                      aria-hidden
                    />
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface TimeOption {
  minutes: number
  /** Already gone by. */
  past: boolean
  /** The student is in another meeting then. */
  taken: boolean
  /** Other meetings booked at the same time. */
  others: number
}

/** The hour as a dropdown: the chosen time on its face, every start time
    behind it with what's already booked then. */
function TimeField({
  id,
  times,
  value,
  onChange,
  disabled,
  studentFirst,
}: {
  id: string
  times: TimeOption[]
  value: number | null
  onChange: (minutes: number) => void
  disabled?: boolean
  studentFirst: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" id={id} disabled={disabled} className={FIELD_TRIGGER}>
          <span className={cn("min-w-0 flex-1 truncate tabular-nums", value === null && "text-muted-foreground")}>
            {value === null ? "No times open" : formatSlot(value)}
          </span>
          <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="text-muted-foreground size-4 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 gap-0 p-1">
        <div role="radiogroup" aria-label="Time" className="flex flex-col">
          {times.map((t) => {
            const selected = t.minutes === value
            const unavailable = t.past || t.taken
            const note = t.past
              ? "Already passed"
              : t.taken
                ? `${studentFirst} is booked then`
                : t.others
                  ? `${t.others} other${t.others === 1 ? "" : "s"} booked`
                  : ""
            return (
              <button
                key={t.minutes}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={unavailable}
                onClick={() => {
                  onChange(t.minutes)
                  setOpen(false)
                }}
                className={cn(
                  FIELD_OPTION,
                  unavailable ? "text-muted-foreground cursor-not-allowed" : "hover:bg-accent cursor-pointer"
                )}
              >
                <span className={cn("shrink-0 tabular-nums", unavailable && "line-through", selected && "font-medium")}>
                  {formatSlot(t.minutes)}
                </span>
                <span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-xs">{note}</span>
                <HugeiconsIcon
                  icon={Tick02Icon}
                  strokeWidth={2}
                  className={cn("size-4 shrink-0", !selected && "invisible")}
                  aria-hidden
                />
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Adds the shared meetings calendar to the viewer's own: Google Calendar by
 * its link, anything else by the calendar's public iCal address.
 */
function SubscribeButton({ links }: { links: CalendarSubscription }) {
  const [open, setOpen] = useState(false)
  const webcal = links.ical?.replace(/^https?:/, "webcal:")

  async function copy() {
    if (!links.ical) return
    try {
      await navigator.clipboard.writeText(links.ical)
      toast.success("Calendar address copied")
    } catch {
      toast.error("Couldn’t copy. Select the address and copy it by hand.")
    }
  }

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={CalendarDownload01Icon} strokeWidth={2} />
        Subscribe
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-8">
            <DialogTitle>Add the meetings calendar to yours</DialogTitle>
            <DialogDescription>
              Every thesis meeting then shows alongside your own events, and stays current as meetings are
              booked or canceled.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Google Calendar</p>
              <p className="text-muted-foreground text-sm">
                Opens Google Calendar and offers to add Senior Thesis Meetings to your list.
              </p>
              <Button asChild className="self-start">
                <a href={links.google} target="_blank" rel="noreferrer">
                  Add to Google Calendar
                </a>
              </Button>
            </section>
            {links.ical && webcal ? (
              <section className="flex flex-col gap-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Apple Calendar, Outlook and others</p>
                <p className="text-muted-foreground text-sm">
                  Open it in the calendar app on this device, or paste the address into any app that can
                  subscribe to a calendar. These apps check for changes every few hours, so a new booking can
                  take a while to appear.
                </p>
                <Button asChild variant="outline" className="self-start">
                  <a href={webcal}>Open in my calendar app</a>
                </Button>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={links.ical}
                    aria-label="Calendar address"
                    className="min-w-0 flex-1 text-xs"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button type="button" variant="outline" className="shrink-0 gap-2" onClick={copy}>
                    <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                    Copy
                  </Button>
                </div>
              </section>
            ) : (
              <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
                A link for Apple Calendar and Outlook appears here once the calendar is public. In Google
                Calendar, open Senior Thesis Meetings, then Settings and sharing, then Access permissions, and
                turn on &ldquo;Make available to public&rdquo;.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** A student's profile photo, or their initials when there isn't one. */
function StudentPhoto({ student, className }: { student: RosterStudent; className?: string }) {
  return (
    <Avatar className={cn("shrink-0", className)}>
      <AvatarImage src={student.profileImage || undefined} alt="" />
      <AvatarFallback className="text-[0.7em] font-medium">{initialsOf(student)}</AvatarFallback>
    </Avatar>
  )
}

function BookingForm({
  request,
  onClose,
  container,
  forAdvisor,
  rows,
  days,
  meetings,
}: {
  request: BookingRequest
  onClose: () => void
  /** The dialog's content element, where the student picker's popup mounts. */
  container: RefObject<HTMLDivElement | null>
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
  // The day asked for, unless it can't be booked; otherwise the next one that can.
  const [date, setDate] = useState(() => {
    const asked = request.date ? days.find((d) => d.date === request.date) : undefined
    if (request.date && (!asked || !blockReason(asked))) return request.date
    return days.find((d) => !blockReason(d))?.date ?? ""
  })
  const [picked, setPicked] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const row = rows.find((r) => String(r.student.id) === studentId) ?? null
  const students = useMemo(
    () => rows.map((r) => r.student).sort((a, b) => studentName(a).localeCompare(studentName(b))),
    [rows]
  )
  const advisorsOf = useMemo(() => new Map(rows.map((r) => [String(r.student.id), r.advisors])), [rows])
  const pickerAnchor = useComboboxAnchor()
  const day = days.find((d) => d.date === date) ?? null
  // A day opened from the schedule may not be in the list (the calendar is
  // still loading); it is still offered.
  const dayOptions = useMemo<MeetingSession[]>(
    () =>
      date && !day
        ? [{ date, session: "", isToday: false, isPast: false, status: "unknown", events: [], conflict: false }, ...days]
        : days,
    [date, day, days]
  )

  const times = useMemo(
    () =>
      bookingStartTimes().map((minutes) => {
        const start = date ? schoolInstant(date, minutes) : 0
        const end = start + MEETING_MINUTES * 60_000
        const live = date ? meetings.filter((m) => !m.canceled) : []
        return {
          minutes,
          past: Boolean(date) && start <= now,
          // One student can't be in two meetings at once, so any overlap rules a time out.
          taken:
            Boolean(row) &&
            live.some((m) => overlaps(m.start, m.end, start, end) && meetingIncludes(m, row!.student.studentEmail)),
          // "Others booked" means booked for this very start time, not merely overlapping it.
          others: live.filter((m) => m.start === start).length,
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
      description: `${formatCalendarDate(date)}, ${formatSlot(startMinutes)}. ${
        result.emailed ? "Invitations and a confirmation email are on their way." : "Invitations are on their way."
      }`,
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
            <StudentPhoto student={row.student} className="size-7" />
            <span className="text-sm font-medium">{studentName(row.student)}</span>
          </div>
        ) : (
          <Combobox
            items={students}
            value={row?.student ?? null}
            onValueChange={(s) => setStudentId(s ? String((s as RosterStudent).id) : "")}
            itemToStringLabel={(s: RosterStudent) => studentName(s)}
            disabled={saving}
          >
            <div ref={pickerAnchor}>
              <ComboboxInput id="booking-student" placeholder="Search students…" className="w-full" disabled={saving}>
                {/* The chosen student's photo sits in the field. */}
                {row && (
                  <InputGroupAddon align="inline-start" className="pl-1.5">
                    <StudentPhoto student={row.student} className="size-6" />
                  </InputGroupAddon>
                )}
              </ComboboxInput>
            </div>
            <ComboboxContent anchor={pickerAnchor} container={container}>
              <ComboboxEmpty className="py-6">No students found.</ComboboxEmpty>
              <ComboboxList className="max-h-[min(20rem,calc(var(--available-height)-1rem))]">
                {(s: RosterStudent) => {
                  const advisors = advisorsOf.get(String(s.id)) ?? []
                  return (
                    <ComboboxItem key={s.id} value={s} className="cursor-pointer gap-3 py-1.5 pr-9 pl-2">
                      <StudentPhoto student={s} className="size-8" />
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate font-medium">{studentName(s)}</span>
                        {!forAdvisor && (
                          <span className="text-muted-foreground truncate text-xs">
                            {advisors.length ? advisors.map(advisorName).join(", ") : "No thesis advisor yet"}
                          </span>
                        )}
                      </span>
                    </ComboboxItem>
                  )
                }}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="booking-day">Class day</Label>
            {dayOptions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No class days are left this term.</p>
            ) : (
              <ClassDayField
                id="booking-day"
                sessions={dayOptions}
                value={date}
                onChange={(d) => {
                  setDate(d)
                  setPicked(null)
                }}
                meetings={meetings}
                disabled={saving}
              />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="booking-time">Time</Label>
            <TimeField
              id="booking-time"
              times={times}
              value={startMinutes}
              onChange={setPicked}
              disabled={saving || !date}
              studentFirst={first}
            />
          </div>
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
  rows,
  loading,
  configured,
  onBook,
}: {
  day: MeetingSession | null
  onClose: () => void
  meetings: ThesisMeeting[]
  studentsByEmail: Map<string, RosterStudent>
  /** Each senior with their thesis advisors; null while loading. */
  rows: StudentRow[] | null
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
  const advisorsOf = useMemo(() => new Map((rows ?? []).map((r) => [String(r.student.id), r.advisors])), [rows])
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
              <div className="mt-2 overflow-hidden rounded-lg border">
                {/* Fixed columns, so a long name is cut short instead of wrapping the row. */}
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-[10.5rem] pl-4">Time</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead className="pr-4">Thesis advisor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {booked.map((m) => {
                      const who = [...studentsByEmail.entries()]
                        .filter(([email]) => email && meetingIncludes(m, email))
                        .map(([, s]) => s)
                      const names = who.map(studentName).join(", ")
                      const advisors = [
                        ...new Set(who.flatMap((s) => (advisorsOf.get(String(s.id)) ?? []).map(advisorName))),
                      ].join(", ")
                      return (
                        <TableRow key={m.id} className="hover:bg-transparent">
                          <TableCell className="pl-4 font-medium tabular-nums">
                            {clock(m.start)} – {clock(m.end)}
                          </TableCell>
                          <TableCell>
                            <span className="flex min-w-0 items-center gap-2.5">
                              {who[0] && <StudentPhoto student={who[0]} className="size-7" />}
                              <span className="truncate font-medium" title={names || undefined}>
                                {names || m.title || "Thesis meeting"}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground pr-4">
                            <span className="block truncate" title={advisors || undefined}>
                              {advisors || (who.length ? "No advisor yet" : "–")}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
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
              {blockReason(day) ? (
                <p className="text-muted-foreground mt-1 text-sm">
                  Meetings can&rsquo;t be booked on this day: {blockReason(day)}.
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground mt-1 mb-3 text-sm">
                    An hour with a student during this class. The student, their advisor and the
                    thesis supervisor get a calendar invitation.
                  </p>
                  <BookButton label="Book a time" onBook={onBook && (() => onBook(day.date))} />
                </>
              )}
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
  subscribe,
  meetings,
  rows,
  loading,
  configured,
  failed,
  onOpenStudent,
}: {
  forAdvisor: boolean
  onBook: (() => void) | undefined
  /** Links for adding the shared calendar to your own, when there are any. */
  subscribe: CalendarSubscription | undefined
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
          <div className="flex flex-wrap items-center gap-2">
            {subscribe && <SubscribeButton links={subscribe} />}
            <BookButton onBook={onBook} />
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

/** A meeting's state as a badge: navy to come, green held, red declined, gray canceled. */
function MeetingStateBadge({ state }: { state: MeetingState }) {
  if (state === "Declined") return <Badge variant="destructive">Declined</Badge>
  if (state === "Canceled") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Canceled
      </Badge>
    )
  }
  return (
    <Badge
      variant="secondary"
      className={
        state === "Upcoming"
          ? "bg-primary/10 text-primary"
          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
      }
    >
      {state}
    </Badge>
  )
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
                          <MeetingStateBadge state={state} />
                        </TableCell>
                        {anyCancelable && (
                          <TableCell className="pr-4 text-right">
                            {cancelable(mt, state) && (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                aria-label={`Cancel the meeting on ${formatDay(mt.start)}`}
                                title="Cancel meeting"
                                onClick={() => setCanceling(mt)}
                              >
                                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
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
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
          </AlertDialogMedia>
          <AlertDialogTitle>Cancel this meeting?</AlertDialogTitle>
          <AlertDialogDescription>
            {meeting ? (
              <>
                <span className="text-foreground font-medium">
                  {formatDay(meeting.start)}, {clock(meeting.start)} – {clock(meeting.end)} with {name}.
                </span>{" "}
                It comes off the shared calendar and Google emails everyone invited that it’s canceled. This can’t be
                undone.
              </>
            ) : (
              ""
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={working}>Keep meeting</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            disabled={working}
            // "!" because the button's own navy background otherwise wins.
            className="bg-destructive! hover:bg-destructive/90! text-white!"
          >
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
