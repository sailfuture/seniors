/** Application roles resolved from the Xano roster (see lib/roster.ts).
 *
 *  Staff tiers come from the teachers table: a row in this app's own
 *  `senior_staff_roles` table wins, otherwise Toddle's `role` column decides
 *  ("Admin" → admin, anything else → teacher).
 *
 *  - admin: everything, including the Users page (staff roles + advisors).
 *  - teacher: rosters, reviews, and the two templates.
 *  - supervisor: oversees the thesis advisors — rosters, reviews, and the
 *    advisor directory, but never the templates.
 *  - advisor: an outside thesis advisor; sees only their assigned students'
 *    work for the one product they advise on (business thesis or life map).
 */
export type AppRole = "student" | "admin" | "teacher" | "supervisor" | "advisor"

export type StaffRole = "admin" | "teacher" | "supervisor"

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Admin",
  teacher: "Teacher",
  supervisor: "Advisor supervisor",
}

export function isStaffRole(role: unknown): role is StaffRole {
  return role === "admin" || role === "teacher" || role === "supervisor"
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

/** Marking work complete, requesting revisions, undoing a review, and
 *  deleting comments. Advisors can read everything and leave comments, but
 *  the review status stays with SailFuture staff. */
export function canReviewWork(role: unknown): boolean {
  return isStaffRole(role)
}
