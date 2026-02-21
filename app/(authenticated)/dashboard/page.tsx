"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { MapsIcon, BookOpen02Icon } from "@hugeicons/core-free-icons"
import { TeacherDashboard } from "@/components/teacher-dashboard"
import { fetchSections, titleToSlug } from "@/lib/lifemap-sections"

function StudentDashboard() {
  const [lifeMapUrl, setLifeMapUrl] = useState("/life-map")
  const [sectionCount, setSectionCount] = useState(0)

  useEffect(() => {
    fetchSections().then((sections) => {
      setSectionCount(sections.length)
      if (sections.length > 0) {
        setLifeMapUrl(`/life-map/${titleToSlug(sections[0].section_title)}`)
      }
    })
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
          <Card className="transition-colors hover:border-foreground/20">
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
              <p className="text-muted-foreground text-sm">{sectionCount} sections</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/business-thesis/executive-summary" className="block">
          <Card className="transition-colors hover:border-foreground/20">
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
              <p className="text-muted-foreground text-sm">8 sections</p>
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
