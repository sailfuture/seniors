"use client"

import { Fragment, useMemo } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  CalendarBlock01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { useSession } from "@/components/session-provider"
import {
  advisorProduct,
  PRODUCT_LABEL,
  type AdvisorAssignment,
  type AdvisorProduct,
} from "@/lib/advisors"
import { type RosterStudent } from "@/lib/students"
import { useAdvisorAssignments, useAdvisors, useAllStudents } from "@/lib/queries"
import {
  BUSINESSTHESIS_API_CONFIG,
  LIFEMAP_API_CONFIG,
  type FormApiConfig,
} from "@/lib/form-api-config"
import { cachedFetch } from "@/lib/cached-fetch"
import { reviewCountsByStudent, type ReviewCounts } from "@/lib/review-counts"
import {
  CLASS_MEETING,
  formatCalendarDate,
  meetingOutlook,
  type SchoolCalendarDay,
} from "@/lib/school-calendar"
import { cn } from "@/lib/utils"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const API_CONFIG: Record<AdvisorProduct, FormApiConfig> = {
  "business-thesis": BUSINESSTHESIS_API_CONFIG,
  "life-map": LIFEMAP_API_CONFIG,
}

/** How far ahead the schedule card looks for days school is closed. */
const OUTLOOK_WEEKS = 8

/** As many columns as fit at 24rem+, so a short list spreads into wide
    cards (capped per card) and a long one packs three to a row. */
const STUDENT_GRID = "grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr))]"

/** The staff view of a student's work: every response, comment thread,
    revision, and version, read-only for review status. */
function reviewHref(product: AdvisorProduct, studentId: string) {
  return `/admin/${product}/${studentId}`
}

function publicHref(product: AdvisorProduct, studentId: string) {
  return `/public/${product}/${studentId}`
}

interface AdvisedStudent {
  student: RosterStudent
  products: AdvisorProduct[]
}

/** Review counts keyed by `${product}:${studentId}`. */
type CountsByKey = Map<string, ReviewCounts>

const countsKey = (product: AdvisorProduct, studentId: string) => `${product}:${studentId}`

/**
 * One review-queue read per product the advisor covers (the queue holds only
 * rows awaiting action, so it's small), reduced to counts per student. A
 * product whose read fails just shows no counts; the rest still render.
 */
function useReviewCounts(products: AdvisorProduct[]) {
  return useQuery<CountsByKey>({
    queryKey: ["advisor-review-counts", products],
    enabled: products.length > 0,
    queryFn: async () => {
      const result: CountsByKey = new Map()
      await Promise.all(
        products.map(async (product) => {
          const cfg = API_CONFIG[product]
          try {
            const [sectionsRes, templateRes, queueRes] = await Promise.all([
              cachedFetch(cfg.sectionsEndpoint),
              cachedFetch(cfg.templateEndpoint),
              fetch(cfg.reviewQueueEndpoint),
            ])
            if (!sectionsRes.ok || !templateRes.ok || !queueRes.ok) return
            const [sections, template, rows] = await Promise.all([
              sectionsRes.json(),
              templateRes.json(),
              queueRes.json(),
            ])
            for (const [studentId, counts] of reviewCountsByStudent(rows, template, sections, cfg.fields)) {
              result.set(countsKey(product, studentId), counts)
            }
          } catch {
            /* leave this product without counts */
          }
        })
      )
      return result
    },
  })
}

function useSchoolCalendar() {
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

export function AdvisorDashboard() {
  const { data: session } = useSession()
  const advisorsId = session?.user?.advisors_id
  const assignmentsQuery = useAdvisorAssignments()
  // Graduated students stay listed so their locked projects remain reachable.
  const studentsQuery = useAllStudents()
  const advisorsQuery = useAdvisors()
  const calendarQuery = useSchoolCalendar()

  // A business thesis advisor sees only business theses, a life map advisor
  // only life maps. Advisors from before types existed (no product on their
  // row) see whatever they were assigned.
  const myProduct = useMemo<AdvisorProduct | null>(() => {
    const me = advisorsQuery.data?.find((a) => Number(a.id) === Number(advisorsId))
    return me ? advisorProduct(me) : null
  }, [advisorsQuery.data, advisorsId])

  // Same shared caches the staff surfaces use; the advisor only ever sees
  // their own slice of them.
  const advised = useMemo<AdvisedStudent[] | null>(() => {
    if (advisorsId == null || !assignmentsQuery.data || !studentsQuery.data || !advisorsQuery.data) {
      return null
    }

    const byId = new Map(studentsQuery.data.map((s: RosterStudent) => [String(s.id), s]))

    const mine = assignmentsQuery.data.filter(
      (a: AdvisorAssignment) =>
        Number(a.advisors_id) === Number(advisorsId) && (myProduct === null || a.type === myProduct)
    )

    const grouped = new Map<string, AdvisedStudent>()
    for (const a of mine) {
      const student = byId.get(String(a.students_id))
      if (!student) continue
      const key = String(student.id)
      const entry = grouped.get(key) ?? { student, products: [] }
      const product = a.type as AdvisorProduct
      if (product in PRODUCT_LABEL && !entry.products.includes(product)) {
        entry.products.push(product)
      }
      grouped.set(key, entry)
    }

    return [...grouped.values()].sort((x, y) =>
      `${x.student.lastName} ${x.student.firstName}`.localeCompare(
        `${y.student.lastName} ${y.student.firstName}`
      )
    )
  }, [advisorsId, assignmentsQuery.data, studentsQuery.data, advisorsQuery.data, myProduct])

  // Every product on the advisor's list, so the counts are read once per
  // product rather than once per student.
  const products = useMemo<AdvisorProduct[]>(() => {
    const set = new Set<AdvisorProduct>()
    for (const entry of advised ?? []) entry.products.forEach((p) => set.add(p))
    return [...set]
  }, [advised])
  const countsQuery = useReviewCounts(products)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Your students</h1>
        <p className="text-muted-foreground mt-1">
          {myProduct
            ? `Students whose ${PRODUCT_LABEL[myProduct]} you advise on. Open one to read every response, comment, and revision.`
            : "Students you advise. Open one to read every response, comment, and revision."}
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="min-w-0">
          {advised === null ? (
            <div className={STUDENT_GRID}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64 max-w-2xl rounded-xl" />
              ))}
            </div>
          ) : advised.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No students assigned yet</CardTitle>
                <CardDescription>
                  Once SailFuture Academy staff assign you to a student&rsquo;s
                  project, it will show up here.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className={STUDENT_GRID}>
              {advised.map(({ student, products }) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  products={products}
                  counts={countsQuery.data}
                  countsLoading={products.length > 0 && countsQuery.isPending}
                />
              ))}
            </div>
          )}
        </section>

        <ScheduleCard days={calendarQuery.data} status={calendarQuery.status} />
      </div>
    </div>
  )
}

function StudentCard({
  student,
  products,
  counts,
  countsLoading,
}: {
  student: RosterStudent
  products: AdvisorProduct[]
  counts: CountsByKey | undefined
  countsLoading: boolean
}) {
  const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase()
  const detail =
    [student.yearGroup, student.crewName].filter(Boolean).join(" · ") || student.studentEmail

  return (
    <Card className="h-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-4">
          <Avatar className="size-16 text-lg">
            <AvatarImage src={student.profileImage || undefined} alt="" />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="truncate text-lg font-semibold">
              {student.firstName} {student.lastName}
            </CardTitle>
            <CardDescription className="truncate">{detail}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {products.length === 0 && <Badge variant="secondary">No projects assigned</Badge>}
        {products.map((product) => {
          const c = counts?.get(countsKey(product, student.id))
          // The queue only lists students with something waiting, so a
          // missing entry after loading means nothing is waiting.
          const loaded = counts !== undefined
          return (
            <div key={product} className="flex flex-col gap-2">
              {products.length > 1 && (
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {PRODUCT_LABEL[product]}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <StatTile
                  label="Ready for review"
                  value={loaded ? (c?.pending ?? 0) : undefined}
                  loading={countsLoading}
                  dot="bg-blue-500"
                />
                <StatTile
                  label="Revisions open"
                  value={loaded ? (c?.revisions ?? 0) : undefined}
                  loading={countsLoading}
                  dot="bg-red-500"
                />
              </div>
            </div>
          )
        })}
      </CardContent>
      {products.length > 0 && (
        <CardFooter className="flex flex-wrap gap-2">
          {products.map((product) => (
            <Fragment key={product}>
              <Button asChild>
                <Link href={reviewHref(product, student.id)}>
                  Review {PRODUCT_LABEL[product]}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a
                  href={publicHref(product, student.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Public page
                </a>
              </Button>
            </Fragment>
          ))}
        </CardFooter>
      )}
    </Card>
  )
}

function StatTile({
  label,
  value,
  loading,
  dot,
}: {
  label: string
  value: number | undefined
  loading: boolean
  dot: string
}) {
  return (
    <div className="bg-muted/40 rounded-lg border px-3 py-2.5">
      {loading ? (
        <Skeleton className="h-7 w-10" />
      ) : (
        <p
          className={cn(
            "text-2xl leading-7 font-semibold tabular-nums",
            value === 0 && "text-muted-foreground"
          )}
        >
          {value ?? "–"}
        </p>
      )}
      <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
        <span className={cn("size-1.5 shrink-0 rounded-full", dot)} />
        {label}
      </p>
    </div>
  )
}

/**
 * When the senior class meets, and which of the coming Thursday/Friday
 * sessions the school calendar rules out (holidays, breaks, closures).
 */
function ScheduleCard({
  days,
  status,
}: {
  days: SchoolCalendarDay[] | undefined
  status: "pending" | "error" | "success"
}) {
  const outlook = useMemo(() => (days ? meetingOutlook(days, OUTLOOK_WEEKS) : null), [days])

  return (
    <Card className="xl:sticky xl:top-6">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
            <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="text-primary size-5" />
          </div>
          <div>
            <CardTitle>Class schedule</CardTitle>
            <CardDescription>When the senior class meets and you can join.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="bg-muted/40 rounded-lg border p-4">
          <p className="text-sm font-medium">Thursdays &amp; Fridays</p>
          <p className="text-2xl font-semibold tabular-nums">
            {CLASS_MEETING.startLabel} – {CLASS_MEETING.endLabel}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">Eastern time, at SailFuture Academy.</p>
          {outlook?.nextSession && (
            <p className="mt-3 text-sm">
              Next session:{" "}
              <span className="font-medium">
                {outlook.nextSession.isToday ? "today" : formatCalendarDate(outlook.nextSession.date)}
              </span>
            </p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold">Sessions that won&rsquo;t happen</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Days school is closed over the next {OUTLOOK_WEEKS} weeks, from the school calendar.
          </p>

          {status === "pending" ? (
            <div className="mt-3 flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-11 rounded-lg" />
              ))}
            </div>
          ) : status === "error" || !outlook ? (
            <p className="text-muted-foreground mt-3 rounded-lg border border-dashed p-3 text-sm">
              The school calendar couldn&rsquo;t be loaded. Check back later, or confirm a session
              with SailFuture Academy staff.
            </p>
          ) : !outlook.coversWindow && outlook.conflicts.length === 0 && !outlook.nextSession ? (
            <p className="text-muted-foreground mt-3 rounded-lg border border-dashed p-3 text-sm">
              The school calendar hasn&rsquo;t been published for these weeks yet.
            </p>
          ) : (
            <>
              {outlook.conflicts.length === 0 ? (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm">
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    strokeWidth={2}
                    className="mt-0.5 size-4 shrink-0 text-emerald-600"
                  />
                  <span>No closures: every Thursday and Friday session is on.</span>
                </p>
              ) : (
                <ul className="mt-3 divide-y rounded-lg border">
                  {outlook.conflicts.map((c) => (
                    <li key={c.date} className="flex items-center gap-3 px-3 py-2.5">
                      <HugeiconsIcon
                        icon={CalendarBlock01Icon}
                        strokeWidth={2}
                        className="size-4 shrink-0 text-amber-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {formatCalendarDate(c.date)}
                          {c.date === outlook.from && (
                            <span className="text-muted-foreground font-normal"> · today</span>
                          )}
                        </p>
                        <p className="text-muted-foreground text-xs">{c.title}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {c.session}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              {!outlook.coversWindow && outlook.calendarThrough && (
                <p className="text-muted-foreground mt-2 text-xs">
                  The calendar is published through {formatCalendarDate(outlook.calendarThrough)};
                  later weeks aren&rsquo;t known yet.
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
