const ADVISORS_BASE = "https://xsc3-mvx7-r86m.n7e.xano.io/api:psozOWLd"

export const ADVISORS_ENDPOINT = `${ADVISORS_BASE}/advisors`
export const ADVISOR_ASSIGNMENTS_ENDPOINT = `${ADVISORS_BASE}/advisor_assignments`

/** Which product an assignment grants access to (the table's `type` field). */
export type AdvisorProduct = "business-thesis" | "life-map"

export interface Advisor {
  id: number
  email: string
  firstName: string
  lastName: string
  profileImage?: string | null
  isActive?: boolean
  created_at?: number
}

export interface AdvisorAssignment {
  id: number
  students_id: string
  advisors_id: number
  type: string
  created_at?: number
}

export function advisorName(a: Advisor): string {
  return `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() || a.email
}

export function advisorInitials(a: Advisor): string {
  const f = (a.firstName ?? "").charAt(0)
  const l = (a.lastName ?? "").charAt(0)
  return (f + l).toUpperCase() || a.email.charAt(0).toUpperCase()
}

export async function fetchAdvisors(): Promise<Advisor[]> {
  try {
    const res = await fetch(ADVISORS_ENDPOINT)
    if (!res.ok) return []
    const rows = await res.json()
    return Array.isArray(rows) ? (rows as Advisor[]) : []
  } catch {
    return []
  }
}

export async function fetchAdvisorAssignments(): Promise<AdvisorAssignment[]> {
  try {
    const res = await fetch(ADVISOR_ASSIGNMENTS_ENDPOINT)
    if (!res.ok) return []
    const rows = await res.json()
    return Array.isArray(rows) ? (rows as AdvisorAssignment[]) : []
  } catch {
    return []
  }
}

export async function createAdvisor(
  data: Pick<Advisor, "email" | "firstName" | "lastName"> & { isActive?: boolean }
): Promise<Advisor | null> {
  try {
    const res = await fetch(ADVISORS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.email.trim().toLowerCase(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        profileImage: null,
        isActive: data.isActive ?? true,
      }),
    })
    if (!res.ok) return null
    return (await res.json()) as Advisor
  } catch {
    return null
  }
}

export async function updateAdvisor(id: number, patch: Partial<Advisor>): Promise<boolean> {
  try {
    const res = await fetch(`${ADVISORS_ENDPOINT}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Grant one advisor access to one student's product. */
export async function assignAdvisor(
  studentId: string,
  advisorId: number,
  product: AdvisorProduct
): Promise<AdvisorAssignment | null> {
  try {
    const res = await fetch(ADVISOR_ASSIGNMENTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ students_id: studentId, advisors_id: advisorId, type: product }),
    })
    if (!res.ok) return null
    return (await res.json()) as AdvisorAssignment
  } catch {
    return null
  }
}

export async function unassignAdvisor(assignmentId: number): Promise<boolean> {
  try {
    const res = await fetch(`${ADVISOR_ASSIGNMENTS_ENDPOINT}/${assignmentId}`, { method: "DELETE" })
    return res.ok
  } catch {
    return false
  }
}

/** Assignments for one student+product (Xano ignores query filters, so the
    caller holds the full list and this narrows it client-side). */
export function assignmentsFor(
  all: AdvisorAssignment[],
  studentId: string,
  product: AdvisorProduct
): AdvisorAssignment[] {
  return all.filter(
    (a) => String(a.students_id ?? "") === String(studentId) && a.type === product
  )
}
