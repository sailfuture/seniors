"use client"

import { Fragment, useMemo } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  Call02Icon,
  Calendar03Icon,
  ContactBookIcon,
  Mail01Icon,
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
import { cachedFetch, studentFetch } from "@/lib/cached-fetch"
import { StatusCount } from "@/components/status-count"
import {
  openCommentsBySection,
  reviewCountsBySection,
  reviewCountsByStudent,
  sectionCountsKey,
  type ReviewCounts,
} from "@/lib/review-counts"
import { btTitleToSlug } from "@/lib/businessthesis-sections"
import { titleToSlug } from "@/lib/lifemap-sections"
import {
  CLASS_MEETING,
  formatCalendarDate,
  meetingOutlook,
  type SchoolCalendarDay,
} from "@/lib/school-calendar"
import { cn } from "@/lib/utils"
import { ADVISOR_CONTACTS, telHref } from "@/lib/advisor-contacts"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const API_CONFIG: Record<AdvisorProduct, FormApiConfig> = {
  "business-thesis": BUSINESSTHESIS_API_CONFIG,
  "life-map": LIFEMAP_API_CONFIG,
}

/** How far ahead the schedule table looks. */
const OUTLOOK_WEEKS = 8

/** As many columns as fit at 24rem+, so a short list spreads across the
    full width of the schedule band below and a long one packs three to a row. */
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

/** A section students can work on now (unlocked), in template order. */
interface OpenSection {
  id: number
  title: string
  slug: string
}

interface AdvisorReviewData {
  /** Per student, keyed by countsKey. */
  counts: CountsByKey
  /** Per student section, keyed by `${product}:${sectionCountsKey(studentId, sectionId)}`. */
  bySection: CountsByKey
  /** Open comments per student section, same keys as bySection. */
  comments: Map<string, number>
  openSections: Partial<Record<AdvisorProduct, OpenSection[]>>
}

const SECTION_SLUG: Record<AdvisorProduct, (title: string) => string> = {
  "business-thesis": btTitleToSlug,
  "life-map": titleToSlug,
}

function sectionReviewHref(product: AdvisorProduct, studentId: string, slug: string) {
  return `/admin/${product}/${studentId}/${slug}`
}

/**
 * One review-queue read per product the advisor covers (the queue holds only
 * rows awaiting action, so it's small), reduced to counts per student. A
 * product whose read fails just shows no counts; the rest still render.
 */
function useReviewCounts(products: AdvisorProduct[], studentsByProduct: Partial<Record<AdvisorProduct, string[]>>) {
  return useQuery<AdvisorReviewData>({
    queryKey: ["advisor-review-counts", products, studentsByProduct],
    enabled: products.length > 0,
    queryFn: async () => {
      const result: AdvisorReviewData = { counts: new Map(), bySection: new Map(), comments: new Map(), openSections: {} }
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
              result.counts.set(countsKey(product, studentId), counts)
            }
            for (const [key, counts] of reviewCountsBySection(rows, template, sections, cfg.fields)) {
              result.bySection.set(`${product}:${key}`, counts)
            }
            // Open comments per section, from each student's comments (the
            // same shared request their review pages use).
            await Promise.all(
              (studentsByProduct[product] ?? []).map(async (studentId) => {
                try {
                  const res = await studentFetch(`${cfg.commentsEndpoint}?students_id=${studentId}`)
                  if (!res.ok) return
                  const rows = await res.json()
                  const mine = Array.isArray(rows)
                    ? rows.filter((c: { students_id?: unknown }) => String(c.students_id) === String(studentId))
                    : []
                  for (const [sectionId, n] of openCommentsBySection(mine, template, sections, cfg.fields)) {
                    result.comments.set(`${product}:${sectionCountsKey(studentId, sectionId)}`, n)
                  }
                } catch {
                  /* this student just shows no comment counts */
                }
              })
            )
            if (Array.isArray(sections)) {
              result.openSections[product] = (
                sections as { id: number; section_title: string; isLocked?: boolean; order?: number }[]
              )
                .filter((sec) => !sec.isLocked)
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((sec) => ({ id: sec.id, title: sec.section_title, slug: SECTION_SLUG[product](sec.section_title) }))
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
  const studentsByProduct = useMemo(() => {
    const map: Partial<Record<AdvisorProduct, string[]>> = {}
    for (const entry of advised ?? []) {
      for (const product of entry.products) (map[product] ??= []).push(String(entry.student.id))
    }
    return map
  }, [advised])
  const countsQuery = useReviewCounts(products, studentsByProduct)

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

      <section className="min-w-0">
          {advised === null ? (
            <div className={STUDENT_GRID}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
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
                  data={countsQuery.data}
                  countsLoading={products.length > 0 && countsQuery.isPending}
                />
              ))}
            </div>
          )}
      </section>

      <ContactsCard />

      <ScheduleCard days={calendarQuery.data} status={calendarQuery.status} />
    </div>
  )
}

function StudentCard({
  student,
  products,
  data,
  countsLoading,
}: {
  student: RosterStudent
  products: AdvisorProduct[]
  data: AdvisorReviewData | undefined
  countsLoading: boolean
}) {
  const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase()
  const detail =
    [student.yearGroup, student.crewName].filter(Boolean).join(" · ") || student.studentEmail

  return (
    <Card className="h-full">
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
        {products.map((product) => (
          <div key={product} className="flex flex-col gap-2">
            {products.length > 1 && (
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {PRODUCT_LABEL[product]}
              </p>
            )}
            <OpenSections product={product} studentId={student.id} data={data} loading={countsLoading} />
          </div>
        ))}
      </CardContent>
      {products.length > 0 && (
        <CardFooter className="flex flex-wrap gap-2">
          {products.map((product) => (
            <Fragment key={product}>
              <Button asChild>
                <Link href={reviewHref(product, student.id)}>
                  View {PRODUCT_LABEL[product]}
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

/**
 * The sections the student can work on right now, each a link straight to
 * that section's review page, with what is waiting on a reviewer there.
 */
function OpenSections({
  product,
  studentId,
  data,
  loading,
}: {
  product: AdvisorProduct
  studentId: string
  data: AdvisorReviewData | undefined
  loading: boolean
}) {
  const sections = data?.openSections[product]
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Open sections</p>
      {loading ? (
        <div className="mt-1.5 space-y-1.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-md" />
          ))}
        </div>
      ) : !sections ? (
        <p className="text-muted-foreground mt-1.5 text-sm">Sections couldn&rsquo;t be loaded.</p>
      ) : sections.length === 0 ? (
        <p className="text-muted-foreground mt-1.5 text-sm">No sections are open right now.</p>
      ) : (
        <ul className="mt-1.5 divide-y overflow-hidden rounded-lg border">
          {sections.map((sec) => {
            const key = `${product}:${sectionCountsKey(studentId, sec.id)}`
            const c = data?.bySection.get(key)
            const commentCount = data?.comments.get(key) ?? 0
            return (
              <li key={sec.id}>
                <Link
                  href={sectionReviewHref(product, studentId, sec.slug)}
                  className="hover:bg-muted/50 flex items-center gap-2 px-3 py-2 text-sm transition-colors"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{sec.title}</span>
                  <StatusCount kind="ready" count={c?.pending ?? 0} size="sm" />
                  <StatusCount kind="revision" count={c?.revisions ?? 0} size="sm" />
                  <StatusCount kind="comment" count={commentCount} size="sm" />
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
    </div>
  )
}

/** Who advisors reach at SailFuture Academy, with email and phone links. */
function ContactsCard() {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
            <HugeiconsIcon icon={ContactBookIcon} strokeWidth={2} className="text-primary size-5" />
          </div>
          <div>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>Questions about a student, the thesis or scheduling? Reach out directly.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {ADVISOR_CONTACTS.map((c) => (
          <div key={c.email} className="rounded-lg border px-4 py-3">
            <p className="text-sm font-semibold">{c.name}</p>
            <p className="text-muted-foreground text-xs">{c.title}</p>
            <div className="mt-2.5 space-y-1.5 text-sm">
              <a href={`mailto:${c.email}`} className="hover:text-primary flex items-center gap-2 break-all transition-colors">
                <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="text-muted-foreground size-4 shrink-0" />
                {c.email}
              </a>
              {c.phone && (
                <a href={telHref(c.phone)} className="hover:text-primary flex items-center gap-2 tabular-nums transition-colors">
                  <HugeiconsIcon icon={Call02Icon} strokeWidth={2} className="text-muted-foreground size-4 shrink-0" />
                  {c.phone}
                </a>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/**
 * When the senior class meets: every Thursday and Friday session over the
 * coming weeks as a table, with the ones the school calendar rules out
 * (holidays, breaks, closures) marked and explained.
 */
function ScheduleCard({
  days,
  status,
}: {
  days: SchoolCalendarDay[] | undefined
  status: "pending" | "error" | "success"
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
                    return (
                      <TableRow
                        key={session.date}
                        className={cn(
                          session.status === "off" && "bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-500/5"
                        )}
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
