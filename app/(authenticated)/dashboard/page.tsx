"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { MapsIcon, BookOpen02Icon } from "@hugeicons/core-free-icons"
import { TeacherDashboard } from "@/components/teacher-dashboard"
import { fetchSections, titleToSlug } from "@/lib/lifemap-sections"
import { LIFEMAP_API_CONFIG, BUSINESSTHESIS_API_CONFIG } from "@/lib/form-api-config"

function StudentDashboard() {
  const [lifeMapUrl, setLifeMapUrl] = useState("/life-map")
  const [lmSections, setLmSections] = useState(0)
  const [lmQuestions, setLmQuestions] = useState(0)
  const [btSections, setBtSections] = useState(0)
  const [btQuestions, setBtQuestions] = useState(0)

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
      setBtSections(btSec.length)
      setBtQuestions((btTpl as { isArchived?: boolean }[]).filter((q) => !q.isArchived).length)
    }).catch(() => {})
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
          <Card className="transition-all hover:border-foreground/20 hover:shadow-md hover:-translate-y-0.5">
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
              <p className="text-muted-foreground text-sm">{lmSections} sections &middot; {lmQuestions} questions</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/business-thesis" className="block">
          <Card className="transition-all hover:border-foreground/20 hover:shadow-md hover:-translate-y-0.5">
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
              <p className="text-muted-foreground text-sm">{btSections} sections &middot; {btQuestions} questions</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
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
