/** Application roles resolved from the Xano roster (see lib/roster.ts).
 *
 *  Staff tiers come from the teachers table: a row in this app's own
 *  `senior_staff_roles` table wins, otherwise Toddle's `role` column decides
 *  ("Admin" → admin, anything else → teacher).
 *
 *  - admin: everything, including the Users page (staff roles + advisors).
 *  - teacher: rosters, reviews, and the two templates.
 *  - supervisor: oversees the business thesis advisors and their students —
 *    the Business Thesis roster and reviews plus the advisor directory, but
 *    never the templates and never the Life Map.
 *  - advisor: an outside thesis advisor; sees only their assigned students'
 *    work for the one product they advise on (business thesis or life map).
 */
export type AppRole = "student" | "admin" | "teacher" | "supervisor" | "advisor"

export type StaffRole = "admin" | "teacher" | "supervisor"

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Admin",
  teacher: "Teacher",
  supervisor: "Thesis supervisor",
}

export function isStaffRole(role: unknown): role is StaffRole {
  return role === "admin" || role === "teacher" || role === "supervisor"
}

/** The Life Map in every form: the staff roster, a student's Life Map, its
 *  review page, and Life Map advisors. Thesis supervisors only oversee the
 *  business thesis. */
export function canAccessLifeMap(role: unknown): boolean {
  return role !== "supervisor"
}

/** Life Map / Business Thesis template editors. */
export function canEditTemplates(role: unknown): boolean {
  return role === "admin" || role === "teacher"
}

/** The thesis-advisor directory: adding, assigning, deactivating advisors. */
export function canManageAdvisors(role: unknown): boolean {
  return role === "admin" || role === "supervisor"
}

/** Changing other staff members' roles. */
export function canManageStaff(role: unknown): boolean {
  return role === "admin"
}

/** Marking work complete (approving), deleting comments, restoring versions,
 *  and editing a student's essay text: SailFuture staff only. */
export function canApproveWork(role: unknown): boolean {
  return isStaffRole(role)
}

/** Sending work back for revision and undoing a review. Thesis advisors can
 *  do both alongside commenting; every change is logged with who made it and
 *  when. */
export function canRequestRevision(role: unknown): boolean {
  return isStaffRole(role) || role === "advisor"
}
