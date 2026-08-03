const STUDENT_LOGIN_CHECK_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/student_login_check"

const TEACHER_LOGIN_CHECK_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/teacher_login_check"

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
  role: "student" | "admin"
  students_id?: string
  teachers_id?: string
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
 * Resolves a signed-in email address against the roster. Returns null when the
 * address belongs to neither an enrolled student nor a staff member, which is
 * what gates access to the dashboard.
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

  return null
}
