"use client"

import { Fragment, useMemo } from "react"
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
  eventConflictsWithClass,
  formatCalendarDate,
  formatEventTime,
  meetingOutlook,
  type MeetingSession,
  type SchoolCalendar,
  type SchoolCalendarDay,
  type SchoolEvent,
} from "@/lib/school-calendar"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
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

/** How far ahead the schedule table looks. */
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

const CALENDAR_QUERY = {
  queryKey: ["school-calendar"] as const,
  queryFn: fetchSchoolCalendar,
  staleTime: 15 * 60_000,
}

/** The whole school calendar: days, events, terms and years. */
export function useSchoolCalendarData() {
  return useQuery<SchoolCalendar>(CALENDAR_QUERY)
}

/** Just the day rows, for the class-schedule outlook. Shares the one fetch
    with `useSchoolCalendarData`. */
export function useSchoolCalendar() {
  return useQuery<SchoolCalendar, Error, SchoolCalendarDay[]>({
    ...CALENDAR_QUERY,
    select: (cal) => cal.days,
  })
}

/**
 * When the senior class meets: every Thursday and Friday session over the
 * coming weeks as a table, with the ones the school calendar rules out
 * (holidays, breaks, closures) marked and explained, and school events that
 * land on a class day called out.
 */
export function ScheduleCard({
  days,
  events,
  status,
  onSelectDay,
}: {
  days: SchoolCalendarDay[] | undefined
  /** School events; when given, sessions with an event on the same day say so. */
  events?: SchoolEvent[]
  status: "pending" | "error" | "success"
  /** When set, every class day is a button that opens that day's bookings. */
  onSelectDay?: (session: MeetingSession) => void
}) {
  const outlook = useMemo(
    () => (days ? meetingOutlook(days, OUTLOOK_WEEKS, undefined, events ?? []) : null),
    [days, events]
  )
  const time = `${CLASS_MEETING.startLabel} – ${CLASS_MEETING.endLabel}`

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
              The senior class meets Thursdays and Fridays, {time} Eastern, at SailFuture Academy.
              Sessions over the next {OUTLOOK_WEEKS} weeks, from the school calendar.
              {onSelectDay && " Select a class day to see its bookings and book a time."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {outlook?.nextSession && (
          <p className="text-sm">
            Next session:{" "}
            <span className="font-medium">
              {outlook.nextSession.isToday ? "today" : formatCalendarDate(outlook.nextSession.date)}, {time}
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
            No sessions in the next {OUTLOOK_WEEKS} weeks.
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
                    const isNext = outlook.nextSession?.date === session.date
                    const open = onSelectDay && session.status !== "off" ? () => onSelectDay(session) : undefined
                    const flagged = session.status === "off" || session.conflict
                    return (
                      <TableRow
                        key={session.date}
                        className={cn(
                          flagged && "bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-500/5",
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
                                className="mt-0.5 size-4 shrink-0 text-amber-600"
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
                                  className={cn("size-4 shrink-0", session.conflict ? "text-amber-600" : "text-emerald-600")}
                                />
                                Class meets
                                {isNext && <Badge variant="secondary">Next</Badge>}
                                {open && (
                                  <HugeiconsIcon
                                    icon={ArrowRight01Icon}
                                    strokeWidth={2}
                                    className="text-muted-foreground ml-auto size-4 shrink-0"
                                  />
                                )}
                              </span>
                              <SessionEvents events={session.events} />
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
            {!outlook.coversWindow && outlook.calendarThrough && (
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

/** The school events on a class day: the ones colliding with class first. */
function SessionEvents({ events }: { events: SchoolEvent[] }) {
  if (events.length === 0) return null
  return (
    <span className="flex flex-col gap-0.5 text-xs">
      {events.map((e) => {
        const conflict = eventConflictsWithClass(e)
        return (
          <span key={e.id} className={cn(conflict ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground")}>
            <span className={cn(conflict && "font-medium")}>{conflict ? "During class: " : "Also this day: "}</span>
            {e.title}
            <span className="opacity-80"> · {formatEventTime(e)}</span>
          </span>
        )
      })}
    </span>
  )
}
