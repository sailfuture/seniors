import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/api-auth"
import { canManageAdvisors } from "@/lib/roles"
import { ADVISORS_ENDPOINT, fetchAdvisors, type Advisor } from "@/lib/advisors"
import {
  createInvitationFor,
  resolveAdvisorAccess,
  revokeInvitationsFor,
  sendInvitationEmail,
} from "@/lib/advisor-invitations.server"
import type { AdvisorAccessResponse, InviteResult } from "@/lib/advisor-invitations"

export const runtime = "nodejs"

/**
 * Thesis-advisor invitations, backed by Clerk:
 *
 * - GET: where every advisor's access stands (account / pending / expired /
 *   none), for the Access column on the Users page.
 * - POST { advisorId }: send or resend — revoke any live invitation for the
 *   email, create a fresh one, and mail the link in the branded template.
 * - DELETE { advisorId }: cancel the live invitation.
 *
 * Only signed-in admins and thesis supervisors may call any of these, so the
 * route can't be used to spam or to probe who has an account.
 */

async function authorize(req: NextRequest) {
  const user = await getApiSession(req)
  if (!user) {
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) }
  }
  if (!canManageAdvisors(user.role)) {
    return {
      error: NextResponse.json(
        { error: "Admins and thesis supervisors only" },
        { status: 403 }
      ),
    }
  }
  return { user }
}

async function readAdvisorId(req: NextRequest): Promise<number | null> {
  try {
    const body = (await req.json()) as { advisorId?: unknown }
    const id = Number(body.advisorId)
    return Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

async function loadAdvisor(id: number): Promise<Advisor | null> {
  try {
    const res = await fetch(`${ADVISORS_ENDPOINT}/${id}`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data || data === "null") return null
    return data as Advisor
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { error } = await authorize(req)
  if (error) return error

  const advisors = await fetchAdvisors()
  try {
    const access = await resolveAdvisorAccess(advisors.map((a) => a.email ?? ""))
    const body: AdvisorAccessResponse = { access, ok: true }
    return NextResponse.json(body)
  } catch (err) {
    console.error("Clerk invitation lookup failed:", err)
    const body: AdvisorAccessResponse = { access: [], ok: false }
    return NextResponse.json(body, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const { error } = await authorize(req)
  if (error) return error

  const advisorId = await readAdvisorId(req)
  if (!advisorId) {
    return NextResponse.json({ error: "Invalid advisor id" }, { status: 400 })
  }
  const advisor = await loadAdvisor(advisorId)
  const email = advisor?.email?.trim().toLowerCase()
  if (!advisor || !email) {
    return NextResponse.json({ error: "Advisor not found" }, { status: 404 })
  }
  if (advisor.isActive === false) {
    return NextResponse.json(
      { error: "Reactivate the advisor before inviting them." },
      { status: 409 }
    )
  }

  // An email that already has an account can't be invited — and doesn't need
  // to be. Tell the caller where things stand instead of erroring.
  let current
  try {
    ;[current] = await resolveAdvisorAccess([email])
  } catch (err) {
    console.error("Clerk invitation lookup failed:", err)
    return NextResponse.json(
      { error: "Couldn't reach Clerk — please try again." },
      { status: 502 }
    )
  }
  if (current?.state === "accepted") {
    return NextResponse.json(
      { error: `${email} already has an account — they can sign in now.`, access: current },
      { status: 409 }
    )
  }

  let invitation
  try {
    // One live link per advisor: the old one dies when the new one is made.
    await revokeInvitationsFor(email)
    invitation = await createInvitationFor(email)
  } catch (err) {
    console.error("Clerk invitation create failed:", err)
    return NextResponse.json(
      { error: "Couldn't create the invitation — please try again." },
      { status: 502 }
    )
  }
  if (!invitation.url) {
    return NextResponse.json(
      { error: "Clerk returned an invitation without a link — please try again." },
      { status: 502 }
    )
  }

  const emailError = await sendInvitationEmail(email, advisor.firstName ?? "", invitation.url)

  const [access] = await resolveAdvisorAccess([email]).catch(() => [undefined])
  const body: InviteResult = {
    access: access ?? {
      email,
      state: "pending",
      invitationId: invitation.id,
      invitedAt: invitation.createdAt,
    },
    ...(emailError ? { emailError } : {}),
  }
  return NextResponse.json(body)
}

export async function DELETE(req: NextRequest) {
  const { error } = await authorize(req)
  if (error) return error

  const advisorId = await readAdvisorId(req)
  if (!advisorId) {
    return NextResponse.json({ error: "Invalid advisor id" }, { status: 400 })
  }
  const advisor = await loadAdvisor(advisorId)
  const email = advisor?.email?.trim().toLowerCase()
  if (!advisor || !email) {
    return NextResponse.json({ error: "Advisor not found" }, { status: 404 })
  }

  try {
    const revoked = await revokeInvitationsFor(email)
    return NextResponse.json({ ok: true, revoked })
  } catch (err) {
    console.error("Clerk invitation revoke failed:", err)
    return NextResponse.json(
      { error: "Couldn't cancel the invitation — please try again." },
      { status: 502 }
    )
  }
}
