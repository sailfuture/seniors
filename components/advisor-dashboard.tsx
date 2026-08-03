"use client"

import { useEffect, useState } from "react"
import { useSession } from "@/components/session-provider"
import {
  fetchAdvisorAssignments,
  type AdvisorAssignment,
  type AdvisorProduct,
} from "@/lib/advisors"
import { fetchActiveStudents, type RosterStudent } from "@/lib/students"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const PRODUCT_LABEL: Record<AdvisorProduct, string> = {
  "business-thesis": "Business Thesis",
  "life-map": "Life Map",
}

function productHref(product: AdvisorProduct, studentId: string) {
  return `/public/${product}/${studentId}`
}

interface AdvisedStudent {
  student: RosterStudent
  products: AdvisorProduct[]
}

export function AdvisorDashboard() {
  const { data: session } = useSession()
  const advisorsId = session?.user?.advisors_id
  const [advised, setAdvised] = useState<AdvisedStudent[] | null>(null)

  useEffect(() => {
    if (advisorsId == null) return
    let cancelled = false

    async function load() {
      const [assignments, students] = await Promise.all([
        fetchAdvisorAssignments(),
        fetchActiveStudents(),
      ])
      if (cancelled) return

      const byId = new Map(students.map((s: RosterStudent) => [String(s.id), s]))

      const mine = assignments.filter(
        (a: AdvisorAssignment) => Number(a.advisors_id) === Number(advisorsId)
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

      setAdvised(
        [...grouped.values()].sort((x, y) =>
          `${x.student.lastName} ${x.student.firstName}`.localeCompare(
            `${y.student.lastName} ${y.student.firstName}`
          )
        )
      )
    }

    load()
    return () => {
      cancelled = true
    }
  }, [advisorsId])

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Your students</h1>
        <p className="text-muted-foreground mt-1">
          Students you advise, with links to their current work.
        </p>
      </div>

      {advised === null ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
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
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {advised.map(({ student, products }) => (
            <Card key={student.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarImage src={student.profileImage || undefined} />
                    <AvatarFallback>
                      {`${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">
                      {student.firstName} {student.lastName}
                    </CardTitle>
                    <CardDescription>
                      {[student.yearGroup, student.crewName]
                        .filter(Boolean)
                        .join(" · ") || student.studentEmail}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                {products.map((product) => (
                  <Button key={product} asChild variant="outline" size="sm">
                    <a
                      href={productHref(product, student.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View {PRODUCT_LABEL[product]}
                    </a>
                  </Button>
                ))}
                {products.length === 0 && (
                  <Badge variant="secondary">No projects assigned</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
