/**
 * Thesis advisors get into the dashboard through a Clerk invitation: adding
 * an advisor creates a one-time Clerk invitation link for their email, which
 * we mail with the branded welcome template. Following it lands them on the
 * sign-up card with the email already verified, so all they do is create
 * the account. Clerk is the record of where each invitation stands; this
 * module is the browser-side view of that record (types + fetchers for the
 * server route under /api/advisors/invitations).
 */

export type AdvisorAccessState =
  /** A Clerk account exists for this email: they have signed up. */
  | "accepted"
  /** Invitation sent and still valid. */
  | "pending"
  /** Invitation sent but past its expiry — needs a resend. */
  | "expired"
  /** No account and no live invitation (never invited, or canceled). */
  | "none"

export interface AdvisorAccess {
  /** Lower-cased advisor email the record is keyed by. */
  email: string
  state: AdvisorAccessState
  /** Clerk invitation id for pending/expired, so it can be canceled. */
  invitationId?: string
  /** When the latest invitation was created (ms epoch). */
  invitedAt?: number
  /** When the latest invitation expires (ms epoch). */
  expiresAt?: number
  /** When the account last signed in (ms epoch), for accepted advisors. */
  lastSignInAt?: number | null
}

export interface AdvisorAccessResponse {
  access: AdvisorAccess[]
  /** False when the server can't reach Clerk; the UI then hides the column. */
  ok: boolean
}

export async function fetchAdvisorAccess(): Promise<AdvisorAccessResponse> {
  try {
    const res = await fetch("/api/advisors/invitations")
    if (!res.ok) return { access: [], ok: false }
    return (await res.json()) as AdvisorAccessResponse
  } catch {
    return { access: [], ok: false }
  }
}

/** Index the access list by email for row lookups. */
export function accessByEmail(list: AdvisorAccess[]): Map<string, AdvisorAccess> {
  return new Map(list.map((a) => [a.email, a]))
}

export interface InviteResult {
  access?: AdvisorAccess
  /** Set when the invitation was created but the email didn't go out. */
  emailError?: string
  error?: string
}

/**
 * Sends (or resends) the invitation for one advisor: revokes any live
 * invitation for that email, creates a fresh one, and emails the link.
 */
export async function sendAdvisorInvitation(advisorId: number): Promise<InviteResult> {
  try {
    const res = await fetch("/api/advisors/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advisorId }),
    })
    const body = (await res.json().catch(() => null)) as InviteResult | null
    if (!res.ok) {
      // A 409 ("already has an account") still carries the current access.
      return {
        error: body?.error ?? "Couldn't send the invitation — please try again.",
        access: body?.access,
      }
    }
    return body ?? {}
  } catch {
    return { error: "Couldn't send the invitation — please try again." }
  }
}

/** Revokes the advisor's live invitation. Returns an error message or null. */
export async function cancelAdvisorInvitation(advisorId: number): Promise<string | null> {
  try {
    const res = await fetch("/api/advisors/invitations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advisorId }),
    })
    if (res.ok) return null
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    return body?.error ?? "Couldn't cancel the invitation — please try again."
  } catch {
    return "Couldn't cancel the invitation — please try again."
  }
}
