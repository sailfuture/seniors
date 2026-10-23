import { redirect } from "next/navigation"
import { getAppSession } from "@/lib/clerk-session"
import { isStaffRole } from "@/lib/roles"
import { advisorCanViewStudent, type AdvisorProduct } from "@/lib/advisors"

/**
 * Server-side gate for a student's staff pages. Staff pass straight through;
 * an advisor only gets in when they're assigned to this student for this
 * product, and anyone else goes home. Middleware lets advisors into these
 * routes at all; this is where the per-student check happens, and it holds
 * even when the session token carries no role claim.
 */
export async function AdvisorStudentGuard({
  product,
  studentId,
  children,
}: {
  product: AdvisorProduct
  studentId: string
  children: React.ReactNode
}) {
  const session = await getAppSession()
  const role = session?.user.role
  if (isStaffRole(role)) return <>{children}</>

  const advisorId = session?.user.advisors_id
  const allowed =
    role === "advisor" &&
    advisorId != null &&
    (await advisorCanViewStudent(advisorId, studentId, product))
  if (!allowed) redirect("/dashboard")
  return <>{children}</>
}
