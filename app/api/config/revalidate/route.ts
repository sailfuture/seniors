import { revalidatePath } from "next/cache"
import { getApiSession } from "@/lib/api-auth"
import { isStaffRole } from "@/lib/roles"

/**
 * Called by the template editors after a save: drops Vercel's cached setup
 * data for both products so the next page load rebuilds it from Xano.
 */
export async function POST() {
  const session = await getApiSession()
  if (!session || !isStaffRole(session.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
  revalidatePath("/api/config/lifemap")
  revalidatePath("/api/config/businessthesis")
  return Response.json({ revalidated: true })
}
