"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  Calendar03Icon,
  CalendarBlock01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import {
  CLASS_MEETING,
  formatCalendarDate,
  meetingOutlook,
  type MeetingSession,
  type SchoolCalendarDay,
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

/** How far ahead the schedule table looks. */
const OUTLOOK_WEEKS = 8

export function useSchoolCalendar() {
  return useQuery<SchoolCalendarDay[]>({
    queryKey: ["school-calendar"],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const res = await fetch("/api/school-calendar")
      if (!res.ok) throw new Error(`school calendar returned ${res.status}`)
      const body = (await res.json()) as { days?: SchoolCalendarDay[] }
      return Array.isArray(body.days) ? body.days : []
    },
  })
}

/**
 * When the senior class meets: every Thursday and Friday session over the
 * coming weeks as a table, with the ones the school calendar rules out
 * (holidays, breaks, closures) marked and explained.
 */
export function ScheduleCard({
  days,
  status,
  onSelectDay,
}: {
  days: SchoolCalendarDay[] | undefined
  status: "pending" | "error" | "success"
  /** When set, every class day is a button that opens that day's bookings. */
  onSelectDay?: (session: MeetingSession) => void
}) {
  const outlook = useMemo(() => (days ? meetingOutlook(days, OUTLOOK_WEEKS) : null), [days])
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
                  {outlook.sessions.map((session) => {
                    const isNext = outlook.nextSession?.date === session.date
                    const open = onSelectDay && session.status !== "off" ? () => onSelectDay(session) : undefined
                    return (
                      <TableRow
                        key={session.date}
                        className={cn(
                          session.status === "off" && "bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-500/5",
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
                            <span className="flex items-center gap-2">
                              <HugeiconsIcon
                                icon={CheckmarkCircle02Icon}
                                strokeWidth={2}
                                className="size-4 shrink-0 text-emerald-600"
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
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
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
