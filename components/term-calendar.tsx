"use client"

import { useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, ArrowRight01Icon, CalendarBlock01Icon, School01Icon } from "@hugeicons/core-free-icons"
import {
  CLASS_MEETING,
  closureOf,
  defaultTerm,
  defaultYear,
  eventCategory,
  eventConflictsWithClass,
  EVENT_CATEGORIES,
  formatCalendarDate,
  formatDateRange,
  formatEventTime,
  isSeniorEvent,
  schoolNow,
  termsOfYear,
  termView,
  yearsWithDays,
  type MeetingSession,
  type SchoolCalendar,
  type SchoolEvent,
  type TermDayCell,
  type TermEventRow,
  type TermView,
} from "@/lib/school-calendar"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const WEEKDAY_SHORT = ["S", "M", "T", "W", "T", "F", "S"]

/**
 * The school year one term at a time: each of the term's months as a grid
 * with every school day, weekend, break and holiday, the events the front
 * office has put on the calendar, and the Thursday/Friday thesis sessions.
 * A session that collides with an event or a closure is flagged, and the
 * term's events are listed underneath with what each means for class.
 */
export function TermCalendar({
  data,
  status,
  onSelectDay,
}: {
  data: SchoolCalendar | undefined
  status: "pending" | "error" | "success"
  /** When set, class days open that day's bookings. */
  onSelectDay?: (session: MeetingSession) => void
}) {
  const [today] = useState(() => schoolNow().date)
  const [yearPick, setYearPick] = useState<number | null>(null)
  const [termPick, setTermPick] = useState<number | null>(null)

  const years = useMemo(() => (data ? yearsWithDays(data) : []), [data])
  const year = years.find((y) => y.id === yearPick) ?? defaultYear(years, today)
  const terms = useMemo(() => (data && year ? termsOfYear(data, year.id) : []), [data, year])
  const term = terms.find((t) => t.id === termPick) ?? defaultTerm(terms, today)
  const view = useMemo(
    () => (data && term ? termView(data, term, terms, today) : null),
    [data, term, terms, today]
  )

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
            <HugeiconsIcon icon={School01Icon} strokeWidth={2} className="text-primary size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle>School calendar</CardTitle>
            <CardDescription>
              SailFuture Academy&rsquo;s calendar{year ? ` for the ${year.name} school year` : ""}, as the
              front office publishes it: school days, breaks, holidays and events, one term at a time.
              Thursday and Friday thesis sessions that collide with an event or a closure are flagged.
            </CardDescription>
          </div>
          {years.length > 1 && year && (
            <Select
              value={String(year.id)}
              onValueChange={(v) => {
                setYearPick(Number(v))
                setTermPick(null)
              }}
            >
              <SelectTrigger className="w-40" aria-label="School year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y.id} value={String(y.id)}>
                    {y.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {status === "pending" ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-80 max-w-full rounded-lg" />
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </div>
          </div>
        ) : status === "error" || !data ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
            The school calendar couldn&rsquo;t be loaded. Check back later.
          </p>
        ) : !year || terms.length === 0 || !view ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
            The school calendar hasn&rsquo;t been published for this year yet.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Tabs value={String(view.term.id)} onValueChange={(v) => setTermPick(Number(v))}>
                <TabsList aria-label="Academic term">
                  {terms.map((t) => (
                    <TabsTrigger key={t.id} value={String(t.id)}>
                      {t.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <TermSummary view={view} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {view.months.map((month) => (
                <section key={month.key} aria-label={month.label}>
                  <h3 className="mb-2 text-sm font-semibold">{month.label}</h3>
                  <div className="overflow-hidden rounded-lg border">
                    <div className="bg-muted/40 text-muted-foreground grid grid-cols-7 text-center text-[11px] font-medium">
                      {WEEKDAY_SHORT.map((d, i) => (
                        <div key={i} className="py-1">
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7">
                      {month.cells.map((cell, i) =>
                        cell ? (
                          <DayCell key={cell.date} cell={cell} onSelectDay={onSelectDay} />
                        ) : (
                          <div key={`pad-${i}`} className="bg-muted/20 min-h-14 border-t border-l lg:min-h-20" />
                        )
                      )}
                    </div>
                  </div>
                </section>
              ))}
            </div>

            <Legend />

            <TermEvents view={view} onSelectDay={onSelectDay} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** "Aug 24 – Oct 9, 2026 · 34 school days · 14 thesis sessions, 1 off, 2 with an event during class". */
function TermSummary({ view }: { view: TermView }) {
  const parts = [`${view.schoolDays} school ${view.schoolDays === 1 ? "day" : "days"}`]
  let sessions = `${view.sessions} thesis ${view.sessions === 1 ? "session" : "sessions"}`
  const notes: string[] = []
  if (view.sessionsOff) notes.push(`${view.sessionsOff} off for a closure`)
  if (view.sessionsWithConflicts) notes.push(`${view.sessionsWithConflicts} with an event during class`)
  if (notes.length) sessions += ` (${notes.join(", ")})`
  parts.push(sessions)
  return (
    <p className="text-muted-foreground text-sm">
      <span className="text-foreground font-medium">{formatDateRange(view.start, view.end)}</span>
      {" · "}
      {parts.join(" · ")}
    </p>
  )
}

function DayCell({
  cell,
  onSelectDay,
}: {
  cell: TermDayCell
  onSelectDay?: (session: MeetingSession) => void
}) {
  const { day, session } = cell
  const closure = day ? closureOf(day) : null
  const weekend = day ? day.type === "Weekend" : [0, 6].includes(new Date(cell.date + "T00:00:00Z").getUTCDay())
  const flagged = session?.status === "off" || session?.conflict
  const open = onSelectDay && session && session.status !== "off" ? () => onSelectDay(session) : undefined
  const dayNumber = Number(cell.date.slice(8, 10))
  const Tag = open ? "button" : "div"

  return (
    <Tag
      {...(open ? { type: "button" as const, onClick: open, "aria-label": `${formatCalendarDate(cell.date)}: bookings` } : {})}
      className={cn(
        "relative flex min-h-14 flex-col gap-0.5 border-t border-l p-1 text-left align-top text-xs lg:min-h-20",
        "[&:nth-child(7n+1)]:border-l-0",
        weekend && "bg-muted/40",
        closure && "bg-sky-50 dark:bg-sky-500/10",
        flagged && "bg-amber-50 dark:bg-amber-500/10",
        !cell.inTerm && "opacity-50",
        open && "hover:bg-muted/60 focus-visible:ring-ring/50 cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full tabular-nums",
            cell.isToday && "bg-primary text-primary-foreground font-semibold",
            !cell.isToday && day?.holiday && "font-semibold text-rose-600"
          )}
        >
          {dayNumber}
        </span>
        {session?.status === "off" ? (
          <HugeiconsIcon icon={CalendarBlock01Icon} strokeWidth={2} className="size-3.5 text-amber-600" aria-label="No class" />
        ) : session?.conflict ? (
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-3.5 text-amber-600" aria-label="Event during class" />
        ) : session?.status === "on" ? (
          <span className="bg-primary/10 text-primary rounded px-1 text-[10px] font-semibold leading-4">Class</span>
        ) : null}
      </div>
      {day?.firstDayOfTerm && <span className="text-muted-foreground hidden text-[10px] leading-tight lg:block">First day</span>}
      {day?.lastDayOfTerm && <span className="text-muted-foreground hidden text-[10px] leading-tight lg:block">Last day</span>}
      {day?.holiday && <span className="hidden text-[10px] leading-tight text-rose-600 lg:block">Holiday</span>}
      {cell.events.length > 0 && (
        <>
          <div className="mt-auto flex flex-wrap gap-0.5 lg:hidden">
            {cell.events.map((e) => (
              <span key={e.id} className={cn("size-1.5 rounded-full", eventCategory(e).dot)} aria-hidden />
            ))}
          </div>
          <div className="mt-auto hidden flex-col gap-0.5 lg:flex">
            {cell.events.slice(0, 2).map((e) => (
              <EventChip key={e.id} event={e} conflict={session?.status === "on" && eventConflictsWithClass(e)} />
            ))}
            {cell.events.length > 2 && (
              <span className="text-muted-foreground text-[10px] leading-tight">+{cell.events.length - 2} more</span>
            )}
          </div>
        </>
      )}
    </Tag>
  )
}

function EventChip({ event, conflict }: { event: SchoolEvent; conflict: boolean }) {
  const category = eventCategory(event)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "block truncate rounded px-1 text-[10px] leading-4",
            category.chip,
            conflict && "ring-1 ring-amber-500/60"
          )}
        >
          {event.title}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-xs">
        <EventDetails event={event} />
      </TooltipContent>
    </Tooltip>
  )
}

function EventDetails({ event }: { event: SchoolEvent }) {
  const category = eventCategory(event)
  return (
    <div className="grid gap-0.5">
      <p className="font-medium">{event.title}</p>
      <p className="opacity-80">
        {formatCalendarDate(event.date)} · {formatEventTime(event)}
        {event.location && ` · ${event.location}`}
      </p>
      <p className="opacity-80">
        {category.label}
        {event.mandatory && " · Mandatory"}
      </p>
      {event.description && <p className="mt-1 whitespace-pre-line opacity-90">{event.description}</p>}
    </div>
  )
}

function Legend() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
      <span className="inline-flex items-center gap-1.5">
        <span className="bg-primary/10 text-primary rounded px-1 text-[10px] font-semibold leading-4">Class</span>
        Thesis session, {CLASS_MEETING.startLabel} – {CLASS_MEETING.endLabel}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-3.5 text-amber-600" />
        Event during class
      </span>
      <span className="inline-flex items-center gap-1.5">
        <HugeiconsIcon icon={CalendarBlock01Icon} strokeWidth={2} className="size-3.5 text-amber-600" />
        No class
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-sm border bg-sky-50 dark:bg-sky-500/10" />
        Break or holiday
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="bg-muted/40 size-3 rounded-sm border" />
        Weekend
      </span>
      {Object.entries(EVENT_CATEGORIES).map(([slug, c]) => (
        <span key={slug} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", c.dot)} />
          {c.label}
        </span>
      ))}
    </div>
  )
}

/**
 * Every event from the term's first day through the break after it, with
 * what it means for the thesis class that day.
 */
function TermEvents({ view, onSelectDay }: { view: TermView; onSelectDay?: (session: MeetingSession) => void }) {
  const rows = view.events
  const breakAfter = rows.findIndex((r) => !r.inTerm)
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">Events in {view.term.name}</h3>
        <p className="text-muted-foreground text-sm">
          From the school calendar, through the break after the term. The last column says what each
          means for the Thursday/Friday thesis session that day.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
          No events on the school calendar for this term yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="pr-4">Thesis class</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <EventRow
                  key={row.event.id}
                  row={row}
                  divider={i === breakAfter ? `Break after ${view.term.name}` : null}
                  onSelectDay={onSelectDay}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}

function EventRow({
  row,
  divider,
  onSelectDay,
}: {
  row: TermEventRow
  divider: string | null
  onSelectDay?: (session: MeetingSession) => void
}) {
  const { event, session } = row
  const category = eventCategory(event)
  const open = onSelectDay && session && session.status !== "off" ? () => onSelectDay(session) : undefined
  return (
    <>
      {divider && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell
            colSpan={4}
            className="text-muted-foreground py-1.5 pl-4 text-[11px] font-semibold tracking-wide uppercase"
          >
            {divider}
          </TableCell>
        </TableRow>
      )}
      <TableRow
        className={cn(
          row.conflict && "bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-500/5",
          open && "focus-visible:bg-muted/60 cursor-pointer outline-none"
        )}
        {...(open
          ? {
              role: "button",
              tabIndex: 0,
              "aria-label": `${formatCalendarDate(event.date)}: bookings`,
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
        <TableCell className="pl-4 font-medium whitespace-nowrap">{formatCalendarDate(event.date)}</TableCell>
        <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">{formatEventTime(event)}</TableCell>
        <TableCell className="whitespace-normal">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("size-2 shrink-0 rounded-full", category.dot)} aria-hidden />
            <span className="font-medium">{event.title}</span>
            {event.mandatory && <Badge variant="outline">Mandatory</Badge>}
            {isSeniorEvent(event) && <Badge variant="secondary">Seniors</Badge>}
          </div>
          {(event.location || event.description) && (
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
              {[event.location, event.description].filter(Boolean).join(" · ")}
            </p>
          )}
        </TableCell>
        <TableCell className="pr-4 whitespace-normal">
          <ClassImpact row={row} clickable={Boolean(open)} />
        </TableCell>
      </TableRow>
    </>
  )
}

/** What an event means for the thesis session on its day. */
function ClassImpact({ row, clickable }: { row: TermEventRow; clickable: boolean }) {
  const { session, timing } = row
  if (!session) return <span className="text-muted-foreground">Not a class day</span>
  if (session.status === "off") {
    return (
      <span className="text-muted-foreground flex items-start gap-2">
        <HugeiconsIcon icon={CalendarBlock01Icon} strokeWidth={2} className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <span>No class · {session.title}</span>
      </span>
    )
  }
  if (session.status === "unknown") {
    return <span className="text-muted-foreground">Not on the school calendar yet</span>
  }
  if (row.conflict) {
    return (
      <span className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
        <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4 shrink-0 text-amber-600" />
        {timing === "during" ? "During class" : "All day, mandatory"}
        {clickable && (
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="text-muted-foreground ml-auto size-4 shrink-0" />
        )}
      </span>
    )
  }
  return (
    <span className="text-muted-foreground flex items-center gap-2">
      {timing === "before" ? "Before class" : timing === "after" ? "After class" : "All day, class meets"}
      {clickable && (
        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="ml-auto size-4 shrink-0" />
      )}
    </span>
  )
}
