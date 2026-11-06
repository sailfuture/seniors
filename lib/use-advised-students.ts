"use client"

import { useMemo } from "react"
import {
  advisorProduct,
  PRODUCT_LABEL,
  type AdvisorAssignment,
  type AdvisorProduct,
} from "@/lib/advisors"
import { useAdvisorAssignments, useAdvisors, useAllStudents } from "@/lib/queries"
import type { RosterStudent } from "@/lib/students"

export interface AdvisedStudent {
  student: RosterStudent
  products: AdvisorProduct[]
}

export interface AdvisedStudents {
  /** The advisor's product, or null for a legacy advisor with no type set. */
  product: AdvisorProduct | null
  /** Sorted by last name; null until the shared caches have loaded. */
  advised: AdvisedStudent[] | null
}

/**
 * The students assigned to the signed-in advisor, from the same shared caches
 * the staff surfaces read (the advisor only ever sees their own slice).
 *
 * A business thesis advisor sees only business theses, a life map advisor
 * only life maps. Advisors from before types existed (no product on their
 * row) see whatever they were assigned. Graduated students stay listed so
 * their locked projects remain reachable.
 */
export function useAdvisedStudents(advisorsId: number | string | null | undefined): AdvisedStudents {
  const enabled = advisorsId != null
  const assignmentsQuery = useAdvisorAssignments({ enabled })
  const studentsQuery = useAllStudents({ enabled })
  const advisorsQuery = useAdvisors({ enabled })

  const product = useMemo<AdvisorProduct | null>(() => {
    const me = advisorsQuery.data?.find((a) => Number(a.id) === Number(advisorsId))
    return me ? advisorProduct(me) : null
  }, [advisorsQuery.data, advisorsId])

  const advised = useMemo<AdvisedStudent[] | null>(() => {
    if (advisorsId == null || !assignmentsQuery.data || !studentsQuery.data || !advisorsQuery.data) {
      return null
    }

    const byId = new Map(studentsQuery.data.map((s: RosterStudent) => [String(s.id), s]))

    const mine = assignmentsQuery.data.filter(
      (a: AdvisorAssignment) =>
        Number(a.advisors_id) === Number(advisorsId) && (product === null || a.type === product)
    )

    const grouped = new Map<string, AdvisedStudent>()
    for (const a of mine) {
      const student = byId.get(String(a.students_id))
      if (!student) continue
      const key = String(student.id)
      const entry = grouped.get(key) ?? { student, products: [] }
      const p = a.type as AdvisorProduct
      if (p in PRODUCT_LABEL && !entry.products.includes(p)) {
        entry.products.push(p)
      }
      grouped.set(key, entry)
    }

    return [...grouped.values()].sort((x, y) =>
      `${x.student.lastName} ${x.student.firstName}`.localeCompare(
        `${y.student.lastName} ${y.student.firstName}`
      )
    )
  }, [advisorsId, assignmentsQuery.data, studentsQuery.data, advisorsQuery.data, product])

  return { product, advised }
}
