import { NextRequest, NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { getApiSession } from "@/lib/api-auth"
import {
  ADVISORS_ENDPOINT,
  ADVISOR_ASSIGNMENTS_ENDPOINT,
  type Advisor,
  type AdvisorAssignment,
} from "@/lib/advisors"

export const runtime = "nodejs"

/**
 * Permanently removes a thesis advisor: their Clerk account (which revokes any
 * active sessions — roster metadata is cached on the Clerk user, so deleting
 * only the Xano row would leave them signed in), their student assignments,
 * and finally the advisors row itself.
 *
 * Ordered so every failure is retriable: the Xano row is deleted last, and a
 * partial run leaves the advisor deactivatable/deletable rather than orphaned.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiSession(req)
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 })
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 })
  }

  const { id } = await params
  const advisorId = Number(id)
  if (!Number.isInteger(advisorId) || advisorId <= 0) {
    return NextResponse.json({ error: "Invalid advisor id" }, { status: 400 })
  }

  // The row is the source of the email that links Xano to the Clerk account.
  let advisor: Advisor | null = null
  try {
    const res = await fetch(`${ADVISORS_ENDPOINT}/${advisorId}`)
    if (res.ok) {
      const data = await res.json()
      if (data && data !== "null") advisor = data as Advisor
    }
  } catch {
    /* fall through to the 404 below */
  }
  if (!advisor) {
    return NextResponse.json({ error: "Advisor not found" }, { status: 404 })
  }

  // Delete the Clerk account(s) for that email first: it revokes sessions and
  // blocks sign-in even while the rest of the cleanup is still running.
  let clerkDeleted = 0
  const email = advisor.email?.trim().toLowerCase()
  if (email) {
    try {
      const client = await clerkClient()
      const matches = await client.users.getUserList({ emailAddress: [email] })
      for (const u of matches.data) {
        // Same email but a staff/student account (e.g. a teacher who was also
        // listed as advisor) must survive — only advisor identities go.
        const role = (u.publicMetadata as Record<string, unknown> | null)?.role
        if (role !== undefined && role !== "advisor") continue
        await client.users.deleteUser(u.id)
        clerkDeleted += 1
      }
    } catch {
      return NextResponse.json(
        { error: "Couldn't remove the Clerk account — nothing was deleted. Please try again." },
        { status: 502 }
      )
    }
  }

  // Their student assignments; Xano ignores query filters, so filter here.
  let assignmentsRemoved = 0
  try {
    const res = await fetch(ADVISOR_ASSIGNMENTS_ENDPOINT)
    const rows = res.ok ? await res.json() : []
    const mine = (Array.isArray(rows) ? (rows as AdvisorAssignment[]) : []).filter(
      (a) => a.advisors_id === advisorId
    )
    const results = await Promise.all(
      mine.map((a) =>
        fetch(`${ADVISOR_ASSIGNMENTS_ENDPOINT}/${a.id}`, { method: "DELETE" }).then(
          (r) => r.ok,
          () => false
        )
      )
    )
    assignmentsRemoved = results.filter(Boolean).length
    if (results.some((ok) => !ok)) throw new Error()
  } catch {
    return NextResponse.json(
      { error: "The sign-in account was removed, but clearing assignments failed. Please try again." },
      { status: 502 }
    )
  }

  try {
    const res = await fetch(`${ADVISORS_ENDPOINT}/${advisorId}`, { method: "DELETE" })
    if (!res.ok) throw new Error()
  } catch {
    return NextResponse.json(
      { error: "The sign-in account was removed, but deleting the advisor record failed. Please try again." },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, clerkDeleted, assignmentsRemoved })
}
