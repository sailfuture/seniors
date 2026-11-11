"use client"

import { Fragment, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowRight01Icon,
  Calendar03Icon,
  CalendarBlock01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import {
  CLASS_MEETING,
  defaultTerm,
  defaultYear,
  formatCalendarDate,
  formatDateRange,
  formatEventTime,
  meetingOutlook,
  schoolNow,
  termsOfYear,
  weeksAhead,
  yearsWithDays,
  type DatedTerm,
  type DateWindow,
  type MeetingSession,
  type SchoolCalendar,
  type SchoolEvent,
} from "@/lib/school-calendar"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
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

/** The sessions grouped by the week (Monday to Sunday) they fall in. */
function weeksOf(sessions: MeetingSession[]): { start: string; label: string; sessions: MeetingSession[] }[] {
  const weeks: { start: string; label: string; sessions: MeetingSession[] }[] = []
  for (const session of sessions) {
    const [y, m, d] = session.date.split("-").map(Number)
    const day = new Date(Date.UTC(y, m - 1, d))
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7))
    const start = day.toISOString().slice(0, 10)
    let week = weeks[weeks.length - 1]
    if (!week || week.start !== start) {
      week = {
        start,
        label: day.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }),
        sessions: [],
      }
      weeks.push(week)
    }
    week.sessions.push(session)
  }
  return weeks
}

/** How far ahead the schedule looks when no term covers today. */
const OUTLOOK_WEEKS = 8

const EMPTY_CALENDAR: SchoolCalendar = { days: [], events: [], terms: [], years: [] }

async function fetchSchoolCalendar(): Promise<SchoolCalendar> {
  const res = await fetch("/api/school-calendar")
  if (!res.ok) throw new Error(`school calendar returned ${res.status}`)
  const body = (await res.json()) as Partial<SchoolCalendar>
  return {
    days: Array.isArray(body.days) ? body.days : EMPTY_CALENDAR.days,
    events: Array.isArray(body.events) ? body.events : EMPTY_CALENDAR.events,
    terms: Array.isArray(body.terms) ? body.terms : EMPTY_CALENDAR.terms,
    years: Array.isArray(body.years) ? body.years : EMPTY_CALENDAR.years,
  }
}

/** The whole school calendar: days, events, terms and years. */
export function useSchoolCalendarData() {
  return useQuery<SchoolCalendar>({
    queryKey: ["school-calendar"],
    queryFn: fetchSchoolCalendar,
    staleTime: 15 * 60_000,
  })
}

/**
 * The dates the schedule covers: what's left of the term from today (the
 * whole term when it hasn't started), never a day that has passed. When no
 * term covers today or later, the coming weeks.
 */
function scheduleWindow(term: DatedTerm | null, today: string): { range: DateWindow; term: DatedTerm | null } {
  if (term && term.end >= today) {
    return { range: { from: term.start > today ? term.start : today, through: term.end }, term }
  }
  return { range: weeksAhead(OUTLOOK_WEEKS, today), term: null }
}

/**
 * When the senior class meets: every Thursday and Friday session of the term
 * as a table, with the ones the school calendar rules out (holidays, breaks,
 * closures) marked and explained, and school events that land on a class day
 * called out. Only today and later is listed. On the Schedule page a term
 * picker switches between the current term and the ones still to come; on a
 * home page it's just the rest of the current term.
 */
export function ScheduleCard({
  calendar,
  status,
  onSelectDay,
  termPicker = false,
}: {
  calendar: SchoolCalendar | undefined
  status: "pending" | "error" | "success"
  /** When set, every class day is a button that opens that day's bookings. */
  onSelectDay?: (session: MeetingSession) => void
  /** Show the terms that haven't ended as tabs, each listing what's left of it. */
  termPicker?: boolean
}) {
  const [today] = useState(() => schoolNow().date)
  const [termPick, setTermPick] = useState<number | null>(null)

  const terms = useMemo(() => {
    if (!calendar) return []
    const year = defaultYear(yearsWithDays(calendar), today)
    // A term that has ended has nothing left to show.
    return year ? termsOfYear(calendar, year.id).filter((t) => t.end >= today) : []
  }, [calendar, today])
  const { range, term } = useMemo(() => {
    const picked = termPicker ? terms.find((t) => t.id === termPick) : undefined
    return scheduleWindow(picked ?? defaultTerm(terms, today), today)
  }, [terms, termPicker, termPick, today])

  const outlook = useMemo(
    () => (calendar ? meetingOutlook(calendar.days, range, undefined, calendar.events) : null),
    [calendar, range]
  )
  // A later term's first session isn't "next" while today's term is running.
  const nextSession = range.from <= today && today <= range.through ? outlook?.nextSession ?? null : null
  const time = `${CLASS_MEETING.startLabel} – ${CLASS_MEETING.endLabel}`
  const scope = term
    ? termPicker
      ? "Pick a term to see when the class meets, from the school calendar."
      : `Sessions through the end of ${term.name}, from the school calendar.`
    : `Sessions over the next ${OUTLOOK_WEEKS} weeks, from the school calendar.`

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
            <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="text-primary size-5" />
          </div>
          <div>
            <CardTitle>Class schedule</CardTitle>
            <CardDescription>
              The senior class meets Thursdays and Fridays, {time} Eastern, at SailFuture Academy. {scope}
              {onSelectDay && " Select a class day to see its bookings and book a time."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {termPicker && term && terms.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Tabs value={String(term.id)} onValueChange={(v) => setTermPick(Number(v))}>
              <TabsList aria-label="Academic term">
                {terms.map((t) => (
                  <TabsTrigger key={t.id} value={String(t.id)}>
                    {t.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium">{formatDateRange(term.start, term.end)}</span>
              {outlook && (
                <>
                  {" · "}
                  {outlook.sessions.length} {outlook.sessions.length === 1 ? "session" : "sessions"}
                  {term.start < today && " left"}
                </>
              )}
            </p>
          </div>
        )}

        {nextSession && (
          <p className="text-sm">
            Next session:{" "}
            <span className="font-medium">
              {nextSession.isToday ? "today" : formatCalendarDate(nextSession.date)}, {time}
            </span>
          </p>
        )}

        {status === "pending" ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-md" />
            ))}
          </div>
        ) : status === "error" || !outlook ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
            The school calendar couldn&rsquo;t be loaded. Check back later, or confirm a session
            with SailFuture Academy staff.
          </p>
        ) : outlook.sessions.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
            {term ? `No sessions left in ${term.name}.` : `No sessions in the next ${OUTLOOK_WEEKS} weeks.`}
          </p>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[38%] pl-4">Date</TableHead>
                    <TableHead className="w-[24%]">Time</TableHead>
                    <TableHead className="pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeksOf(outlook.sessions).map((week) => (
                    <Fragment key={week.start}>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell
                          colSpan={3}
                          className="text-muted-foreground py-1.5 pl-4 text-[11px] font-semibold tracking-wide uppercase"
                        >
                          Week of {week.label}
                        </TableCell>
                      </TableRow>
                      {week.sessions.map((session) => {
                        const isNext = nextSession?.date === session.date
                        const open = onSelectDay && session.status !== "off" ? () => onSelectDay(session) : undefined
                        const flagged = !session.isPast && (session.status === "off" || session.conflict)
                        return (
                          <TableRow
                            key={session.date}
                            className={cn(
                              flagged && "bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-500/5",
                              session.isPast && "bg-muted/60 text-muted-foreground hover:bg-muted/70",
                              open && "focus-visible:bg-muted/60 cursor-pointer outline-none"
                            )}
                            {...(open
                              ? {
                                  role: "button",
                                  tabIndex: 0,
                                  "aria-label": `${formatCalendarDate(session.date)}: bookings`,
                                  onClick: open,
                                  onKeyDown: (e: React.KeyboardEvent) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault()
                                      open()
                                    }
                                  },
                                }
                              : {})}
                          >
                            <TableCell className="pl-4 font-medium">
                              {formatCalendarDate(session.date)}
                              {session.isToday && <span className="text-muted-foreground font-normal"> · today</span>}
                            </TableCell>
                            <TableCell
                              className={cn("tabular-nums", session.status === "off" && "text-muted-foreground line-through")}
                            >
                              {time}
                            </TableCell>
                            <TableCell className="pr-4 whitespace-normal">
                              {session.status === "off" ? (
                                <span className="flex items-start gap-2">
                                  <HugeiconsIcon
                                    icon={CalendarBlock01Icon}
                                    strokeWidth={2}
                                    className={cn("mt-0.5 size-4 shrink-0", session.isPast ? "text-muted-foreground" : "text-amber-600")}
                                  />
                                  <span>
                                    <span className="font-medium">No class</span>
                                    <span className="text-muted-foreground"> · {session.title}</span>
                                  </span>
                                </span>
                              ) : session.status === "unknown" ? (
                                <span className="text-muted-foreground">Not on the school calendar yet</span>
                              ) : (
                                <span className="flex flex-col gap-1">
                                  <span className="flex items-center gap-2">
                                    <HugeiconsIcon
                                      icon={session.conflict ? Alert02Icon : CheckmarkCircle02Icon}
                                      strokeWidth={2}
                                      className={cn(
                                        "size-4 shrink-0",
                                        session.isPast
                                          ? "text-muted-foreground"
                                          : session.conflict
                                            ? "text-amber-600"
                                            : "text-emerald-600"
                                      )}
                                    />
                                    {session.conflict ? "Event conflict" : session.isPast ? "Class met" : "Class meets"}
                                    {isNext && <Badge variant="secondary">Next</Badge>}
                                    {open && (
                                      <HugeiconsIcon
                                        icon={ArrowRight01Icon}
                                        strokeWidth={2}
                                        className="text-muted-foreground ml-auto size-4 shrink-0"
                                      />
                                    )}
                                  </span>
                                  <SessionEvents events={session.events} past={session.isPast} />
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
            {!outlook.coversWindow && outlook.calendarThrough && outlook.calendarThrough < range.through && (
              <p className="text-muted-foreground text-xs">
                The calendar is published through {formatCalendarDate(outlook.calendarThrough)};
                sessions after that aren&rsquo;t confirmed yet.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** The school events that collide with a class session. */
function SessionEvents({ events, past }: { events: SchoolEvent[]; past: boolean }) {
  if (events.length === 0) return null
  return (
    <span className={cn("flex flex-col gap-0.5 text-xs", past ? "text-muted-foreground" : "text-amber-800 dark:text-amber-300")}>
      {events.map((e) => (
        <span key={e.id}>
          <span className="font-medium">{e.title}</span>
          <span className="opacity-80"> · {formatEventTime(e)}</span>
        </span>
      ))}
    </span>
  )
}
