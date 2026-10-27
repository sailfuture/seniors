import { getAppSession } from "@/lib/clerk-session"
import { isStaffRole } from "@/lib/roles"
import { THESIS_BOOKING_URL, bookingEmbedUrl, bookingSourceUrl } from "@/lib/thesis-meetings"

/**
 * The booking page as a URL Google lets us frame. A short booking link
 * (calendar.app.google/…) can't be framed itself, so it is followed here to
 * the full appointments page it points at, which can be, with `gv=true`.
 */
export const dynamic = "force-dynamic"

const APPOINTMENTS_IN_HTML = /https:\/\/calendar\.google\.com\/calendar\/(?:u\/\d+\/)?appointments\/schedules\/[A-Za-z0-9_-]+/

export async function GET() {
  const session = await getAppSession()
  const role = session?.user.role
  if (!session || !(isStaffRole(role) || role === "advisor")) {
    return Response.json({ embedUrl: null }, { status: 403 })
  }

  const source = bookingSourceUrl(THESIS_BOOKING_URL)
  if (!source) return Response.json({ embedUrl: null })
  const direct = bookingEmbedUrl(source)
  if (direct) return Response.json({ embedUrl: direct })

  try {
    const res = await fetch(source, { redirect: "follow", next: { revalidate: 86_400 } })
    const followed = bookingEmbedUrl(res.url)
    if (followed) return Response.json({ embedUrl: followed })
    const inPage = (await res.text()).match(APPOINTMENTS_IN_HTML)?.[0]
    return Response.json({ embedUrl: inPage ? bookingEmbedUrl(inPage) : null })
  } catch {
    return Response.json({ embedUrl: null }, { status: 502 })
  }
}
