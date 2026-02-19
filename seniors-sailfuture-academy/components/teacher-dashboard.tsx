"use client"

import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { MapsIcon, BookOpen02Icon } from "@hugeicons/core-free-icons"

export function TeacherDashboard() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Review and manage student submissions.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Link href="/admin/life-map" className="block">
          <Card className="transition-colors hover:border-foreground/20">
            <CardHeader>
              <div className="bg-primary/10 mb-2 flex size-10 items-center justify-center rounded-lg">
                <HugeiconsIcon icon={MapsIcon} strokeWidth={2} className="text-primary size-5" />
              </div>
              <CardTitle>Life Map</CardTitle>
              <CardDescription>
                Review student Life Map submissions — career, education, housing, transportation, finance, and more.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">9 sections per student</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/business-thesis" className="block">
          <Card className="transition-colors hover:border-foreground/20">
            <CardHeader>
              <div className="bg-primary/10 mb-2 flex size-10 items-center justify-center rounded-lg">
                <HugeiconsIcon icon={BookOpen02Icon} strokeWidth={2} className="text-primary size-5" />
              </div>
              <CardTitle>Business Thesis</CardTitle>
              <CardDescription>
                Review student Business Thesis submissions — executive summary, market analysis, financial plan, and more.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">8 sections per student</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
