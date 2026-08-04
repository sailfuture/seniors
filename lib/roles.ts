/** Application roles resolved from the Xano roster (see lib/roster.ts).
 *  "admin" and "teacher" both come from the teachers table — its `role`
 *  column decides which. */
export type AppRole = "student" | "admin" | "teacher" | "advisor"

/**
 * Staff — admins and teachers — share the teacher dashboard, the student
 * rosters, review tools, and templates. The only staff surface reserved for
 * admins is the thesis-advisor directory (adding, editing, deleting advisors).
 */
export function isStaffRole(role: unknown): role is "admin" | "teacher" {
  return role === "admin" || role === "teacher"
}
