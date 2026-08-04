"use client"

import { useMemo } from "react"
import { useSession } from "@/components/session-provider"
import {
  type AdvisorAssignment,
  type AdvisorProduct,
} from "@/lib/advisors"
import { type RosterStudent } from "@/lib/students"
import { useAdvisorAssignments, useStudents } from "@/lib/queries"
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
  const assignmentsQuery = useAdvisorAssignments()
  const studentsQuery = useStudents()

  // Same shared caches the staff surfaces use; the advisor only ever sees
  // their own slice of them.
  const advised = useMemo<AdvisedStudent[] | null>(() => {
    if (advisorsId == null || !assignmentsQuery.data || !studentsQuery.data) return null

    const byId = new Map(studentsQuery.data.map((s: RosterStudent) => [String(s.id), s]))

    const mine = assignmentsQuery.data.filter(
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

    return [...grouped.values()].sort((x, y) =>
      `${x.student.lastName} ${x.student.firstName}`.localeCompare(
        `${y.student.lastName} ${y.student.firstName}`
      )
    )
  }, [advisorsId, assignmentsQuery.data, studentsQuery.data])

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
