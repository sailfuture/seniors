import { verifyWebhook } from "@clerk/nextjs/webhooks"
import { NextRequest, NextResponse } from "next/server"
import { ADVISORS_ENDPOINT, type Advisor } from "@/lib/advisors"

export const runtime = "nodejs"

/**
 * Keeps the Xano advisors table in sync with Clerk:
 *
 * - user.created / user.updated: stamp the Clerk user id onto the matching
 *   advisor row (by email). The user.deleted payload carries no email, so this
 *   stamp is what lets a later deletion be traced back to its advisor.
 * - user.deleted (e.g. removed in the Clerk dashboard): deactivate the advisor
 *   row bearing that Clerk id. Deactivation (not deletion) so their past
 *   feedback keeps its author, and because a dashboard-side delete may not
 *   mean "erase" — the full teardown lives in DELETE /api/advisors/[id].
 *
 * Requires CLERK_WEBHOOK_SIGNING_SECRET, and needs the `clerk_user_id` text
 * column on the Xano advisors table; without the column the stamp PATCH is
 * ignored and user.deleted simply finds no match.
 *
 * The route must stay outside middleware.ts's protected matchers — Svix calls
 * it unauthenticated and is verified by signature instead.
 */
export async function POST(req: NextRequest) {
  let evt
  try {
    evt = await verifyWebhook(req)
  } catch (err) {
    console.error("Clerk webhook verification failed:", err)
    return NextResponse.json({ error: "Verification failed" }, { status: 400 })
  }

  try {
    if (evt.type === "user.created" || evt.type === "user.updated") {
      const email = evt.data.email_addresses?.[0]?.email_address?.trim().toLowerCase()
      if (email) {
        const advisor = await findAdvisor((a) => a.email?.trim().toLowerCase() === email)
        if (advisor && advisor.clerk_user_id !== evt.data.id) {
          await fetch(`${ADVISORS_ENDPOINT}/${advisor.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clerk_user_id: evt.data.id }),
          })
        }
      }
    }

    if (evt.type === "user.deleted" && evt.data.id) {
      const clerkId = evt.data.id
      const advisor = await findAdvisor((a) => a.clerk_user_id === clerkId)
      if (advisor && advisor.isActive !== false) {
        await fetch(`${ADVISORS_ENDPOINT}/${advisor.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        })
      }
    }
  } catch (err) {
    // Non-2xx makes Svix retry on its backoff schedule — right for transient
    // Xano failures, and harmless to replay since both handlers are idempotent.
    console.error("Clerk webhook processing failed:", err)
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

async function findAdvisor(match: (a: Advisor) => boolean): Promise<Advisor | null> {
  const res = await fetch(ADVISORS_ENDPOINT)
  if (!res.ok) throw new Error(`advisors list ${res.status}`)
  const rows = await res.json()
  if (!Array.isArray(rows)) return null
  return (rows as Advisor[]).find(match) ?? null
}
