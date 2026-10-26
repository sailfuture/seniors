import { redirect } from "next/navigation"
import { getAppSession } from "@/lib/clerk-session"
import { canAccessLifeMap } from "@/lib/roles"

/**
 * Server-side gate for every Life Map page. Thesis supervisors only oversee
 * the business thesis, so they go to their dashboard instead. Middleware does
 * the same when the session token carries the role; this holds when it
 * doesn't.
 */
export async function LifeMapGate({ children }: { children: React.ReactNode }) {
  const session = await getAppSession()
  if (!canAccessLifeMap(session?.user.role)) redirect("/dashboard")
  return <>{children}</>
}
