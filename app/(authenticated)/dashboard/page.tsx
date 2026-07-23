"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import { MapsIcon, BookOpen02Icon, SquareLock01Icon } from "@hugeicons/core-free-icons"
import { TeacherDashboard } from "@/components/teacher-dashboard"
import { ProductStatusCard } from "@/components/status-overview"
import { fetchSections, titleToSlug } from "@/lib/lifemap-sections"
import { btTitleToSlug } from "@/lib/businessthesis-sections"
import { LIFEMAP_API_CONFIG, BUSINESSTHESIS_API_CONFIG } from "@/lib/form-api-config"
import { useProjectLock } from "@/lib/project-lock"

function StudentDashboard() {
  const { data: session, status: sessionStatus } = useSession()
  const studentId =
    sessionStatus === "loading"
      ? undefined
      : (((session?.user as Record<string, unknown>)?.students_id as string | undefined) ?? null)

  const [lifeMapUrl, setLifeMapUrl] = useState("/life-map")
  const [lmSections, setLmSections] = useState(0)
  const [lmQuestions, setLmQuestions] = useState(0)
  const [btSections, setBtSections] = useState(0)
  const [btQuestions, setBtQuestions] = useState(0)
  // Counts render as a skeleton until loaded, so the cards never flash "0
  // sections · 0 questions" during the (concurrency-throttled) fetches.
  const [countsLoading, setCountsLoading] = useState(true)

  const lmLock = useProjectLock(LIFEMAP_API_CONFIG.locksEndpoint, studentId ?? undefined)
  const btLock = useProjectLock(BUSINESSTHESIS_API_CONFIG.locksEndpoint, studentId ?? undefined)

  useEffect(() => {
    fetchSections().then((sections) => {
      setLmSections(sections.length)
      if (sections.length > 0) {
        setLifeMapUrl(`/life-map/${titleToSlug(sections[0].section_title)}`)
      }
    })
    Promise.all([
      fetch(LIFEMAP_API_CONFIG.templateEndpoint).then((r) => r.ok ? r.json() : []),
      fetch(BUSINESSTHESIS_API_CONFIG.sectionsEndpoint).then((r) => r.ok ? r.json() : []),
      fetch(BUSINESSTHESIS_API_CONFIG.templateEndpoint).then((r) => r.ok ? r.json() : []),
    ]).then(([lmTpl, btSec, btTpl]) => {
      setLmQuestions((lmTpl as { isArchived?: boolean }[]).filter((q) => !q.isArchived).length)
      setBtSections((btSec as unknown[]).length)
      setBtQuestions((btTpl as { isArchived?: boolean }[]).filter((q) => !q.isArchived).length)
    }).catch(() => {}).finally(() => setCountsLoading(false))
  }, [])

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground mt-1">
          Choose a project to continue working on.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Link href={lifeMapUrl} className="block">
          <Card className="relative transition-all hover:border-foreground/20 hover:shadow-md hover:-translate-y-0.5">
            {lmLock && <LockedBadge />}
            <CardHeader>
              <div className="bg-primary/10 mb-2 flex size-10 items-center justify-center rounded-lg">
                <HugeiconsIcon icon={MapsIcon} strokeWidth={2} className="text-primary size-5" />
              </div>
              <CardTitle>Life Map</CardTitle>
              <CardDescription>
                Plan your personal path — career, education, housing, transportation, finance, and more.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {countsLoading ? (
                <Skeleton className="h-5 w-44" />
              ) : (
                <p className="text-muted-foreground text-sm">{lmSections} sections &middot; {lmQuestions} questions</p>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link href="/business-thesis" className="block">
          <Card className="relative transition-all hover:border-foreground/20 hover:shadow-md hover:-translate-y-0.5">
            {btLock && <LockedBadge />}
            <CardHeader>
              <div className="bg-primary/10 mb-2 flex size-10 items-center justify-center rounded-lg">
                <HugeiconsIcon icon={BookOpen02Icon} strokeWidth={2} className="text-primary size-5" />
              </div>
              <CardTitle>Business Thesis</CardTitle>
              <CardDescription>
                Build your business plan — executive summary, market analysis, financial plan, and more.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {countsLoading ? (
                <Skeleton className="h-5 w-44" />
              ) : (
                <p className="text-muted-foreground text-sm">{btSections} sections &middot; {btQuestions} questions</p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ProductStatusCard
          title="Life Map"
          description="Revisions, pending reviews, and unread comments."
          apiConfig={LIFEMAP_API_CONFIG}
          slugify={titleToSlug}
          studentId={studentId}
          basePath="/life-map"
          viewAllHref="/life-map/status"
        />
        <ProductStatusCard
          title="Business Thesis"
          description="Revisions, pending reviews, and unread comments."
          apiConfig={BUSINESSTHESIS_API_CONFIG}
          slugify={btTitleToSlug}
          studentId={studentId}
          basePath="/business-thesis"
          viewAllHref="/business-thesis/status"
        />
      </div>
    </div>
  )
}

/** Amber lock chip in a card's upper-right: the project is frozen (view-only)
    by a teacher. Sits above the card's Link so it reads as a status badge. */
function LockedBadge() {
  return (
    <span
      title="Locked by your teacher — view only"
      className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
    >
      <HugeiconsIcon icon={SquareLock01Icon} strokeWidth={2} className="size-3.5" />
      Locked
    </span>
  )
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const role = (session?.user as Record<string, unknown>)?.role as string | undefined

  if (role === "admin") {
    return <TeacherDashboard />
  }

  return <StudentDashboard />
}
