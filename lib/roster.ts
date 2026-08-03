import { ADVISORS_ENDPOINT, type Advisor } from "@/lib/advisors"

const STUDENT_LOGIN_CHECK_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/student_login_check"

const TEACHER_LOGIN_CHECK_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/teacher_login_check"

const ADVISOR_LOGIN_CHECK_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/advisor_login_check"

export interface XanoStudent {
  id: string
  studentEmail: string
  firstName: string
  lastName: string
  profileImage: string
}

export interface XanoTeacher {
  id: string
  email: string
  firstName: string
  lastName: string
  profileImage?: string
  [key: string]: unknown
}

/**
 * Role and school identifiers resolved from the Xano roster. Stored on the
 * Clerk user's publicMetadata so it travels with the session instead of being
 * looked up on every request.
 */
export interface RosterMetadata {
  role: "student" | "admin" | "advisor"
  students_id?: string
  teachers_id?: string
  advisors_id?: number
  firstName: string
  lastName: string
  profileImage: string
}

export async function lookupStudent(email: string): Promise<XanoStudent | null> {
  try {
    const url = new URL(STUDENT_LOGIN_CHECK_ENDPOINT)
    url.searchParams.set("email", email)

    const res = await fetch(url.toString())
    if (!res.ok) return null

    const data = await res.json()
    if (!data || data === "null") return null

    return data as XanoStudent
  } catch {
    return null
  }
}

export async function lookupTeacher(email: string): Promise<XanoTeacher | null> {
  try {
    const url = new URL(TEACHER_LOGIN_CHECK_ENDPOINT)
    url.searchParams.set("email", email)

    const res = await fetch(url.toString())
    if (!res.ok) return null

    const data = await res.json()
    if (!data || data === "null") return null

    return data as XanoTeacher
  } catch {
    return null
  }
}

/**
 * Looks an email up in the advisors table. Prefers the dedicated
 * `advisor_login_check` endpoint (same contract as the student/teacher
 * checks); until that exists in Xano, falls back to filtering the advisors
 * list server-side. Deactivated advisors never match.
 */
export async function lookupAdvisor(email: string): Promise<Advisor | null> {
  const normalized = email.trim().toLowerCase()

  try {
    const url = new URL(ADVISOR_LOGIN_CHECK_ENDPOINT)
    url.searchParams.set("email", normalized)

    const res = await fetch(url.toString())
    if (res.ok) {
      const data = await res.json()
      if (data && data !== "null") {
        const advisor = data as Advisor
        return advisor.isActive === false ? null : advisor
      }
      return null
    }
    // Endpoint missing (404) or erroring: fall through to the list scan.
  } catch {
    // Network failure: fall through to the list scan.
  }

  try {
    const res = await fetch(ADVISORS_ENDPOINT)
    if (!res.ok) return null
    const rows = await res.json()
    if (!Array.isArray(rows)) return null
    const advisor = (rows as Advisor[]).find(
      (a) => a.email?.trim().toLowerCase() === normalized
    )
    if (!advisor || advisor.isActive === false) return null
    return advisor
  } catch {
    return null
  }
}

/**
 * Resolves a signed-in email address against the roster. Returns null when the
 * address belongs to no enrolled student, staff member, or active advisor,
 * which is what gates access to the dashboard.
 */
export async function lookupRoster(email: string): Promise<RosterMetadata | null> {
  const student = await lookupStudent(email)
  if (student) {
    return {
      role: "student",
      students_id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      profileImage: student.profileImage ?? "",
    }
  }

  const teacher = await lookupTeacher(email)
  if (teacher) {
    return {
      role: "admin",
      teachers_id: teacher.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      profileImage: teacher.profileImage ?? "",
    }
  }

  const advisor = await lookupAdvisor(email)
  if (advisor) {
    return {
      role: "advisor",
      advisors_id: advisor.id,
      firstName: advisor.firstName,
      lastName: advisor.lastName,
      profileImage: advisor.profileImage ?? "",
    }
  }

  return null
}
