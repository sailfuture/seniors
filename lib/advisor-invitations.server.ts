import { clerkClient } from "@clerk/nextjs/server"
import { Resend } from "resend"
import { APP_URL, escapeHtml, renderBrandedEmail } from "@/lib/email-template"
import type { AdvisorAccess } from "@/lib/advisor-invitations"

/** Clerk's Invitation resource, typed off the client (the backend package
 *  isn't a direct dependency). Server-only: it holds the secret-key client. */
type ClerkClient = Awaited<ReturnType<typeof clerkClient>>
type Invitation = Awaited<ReturnType<ClerkClient["invitations"]["createInvitation"]>>
type ClerkUser = Awaited<ReturnType<ClerkClient["users"]["getUserList"]>>["data"][number]

/** Where the invitation link lands: the sign-up card that reads the ticket. */
export const ACCEPT_INVITATION_URL = `${APP_URL}/accept-invitation`

/** Clerk's default; mirrored so the UI can show an expiry when the API omits it. */
const INVITATION_DAYS = 30

const FROM =
  process.env.ADVISOR_EMAIL_FROM ??
  "SailFuture Academy <noreply@sailfutureacademy.org>"

const REPLY_TO = "hthompson@sailfuture.org"

function expiresAtOf(inv: Invitation): number {
  // The SDK's typed resource omits expires_at, but the API returns it.
  const raw = inv.raw as { expires_at?: number } | null
  return raw?.expires_at ?? inv.createdAt + INVITATION_DAYS * 24 * 60 * 60 * 1000
}

/**
 * Every non-revoked Clerk invitation, newest first. The instance only ever
 * invites advisors, so the list is small; paginate anyway so it stays right.
 */
async function listInvitations(): Promise<Invitation[]> {
  const client = await clerkClient()
  const all: Invitation[] = []
  const limit = 500
  for (let offset = 0; ; offset += limit) {
    const page = await client.invitations.getInvitationList({ limit, offset })
    all.push(...page.data)
    if (page.data.length < limit || all.length >= page.totalCount) break
  }
  return all
}

/** Clerk users for the given emails, in chunks of the API's 100-email cap. */
async function listUsersByEmail(emails: string[]) {
  const client = await clerkClient()
  const out: ClerkUser[] = []
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100)
    const page = await client.users.getUserList({ emailAddress: chunk, limit: 500 })
    out.push(...page.data)
  }
  return out
}

/**
 * Resolves where each advisor email stands: an existing Clerk account wins
 * (they're in), otherwise the newest live invitation decides pending vs.
 * expired, and no invitation at all is "none".
 */
export async function resolveAdvisorAccess(emails: string[]): Promise<AdvisorAccess[]> {
  const wanted = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)))
  if (wanted.length === 0) return []

  const [users, invitations] = await Promise.all([listUsersByEmail(wanted), listInvitations()])

  const userByEmail = new Map<string, ClerkUser>()
  for (const u of users) {
    for (const addr of u.emailAddresses) {
      const key = addr.emailAddress.toLowerCase()
      if (wanted.includes(key) && !userByEmail.has(key)) userByEmail.set(key, u)
    }
  }

  // Newest first already; keep the first live one per email.
  const inviteByEmail = new Map<string, Invitation>()
  for (const inv of invitations) {
    const key = inv.emailAddress.toLowerCase()
    if (inv.revoked || inv.status === "revoked") continue
    if (!inviteByEmail.has(key)) inviteByEmail.set(key, inv)
  }

  const now = Date.now()
  return wanted.map((email): AdvisorAccess => {
    const user = userByEmail.get(email)
    if (user) {
      return { email, state: "accepted", lastSignInAt: user.lastSignInAt }
    }
    const inv = inviteByEmail.get(email)
    // An accepted invitation whose account was later deleted needs a new one.
    if (!inv || inv.status === "accepted") return { email, state: "none" }
    const expiresAt = expiresAtOf(inv)
    const expired = inv.status === "expired" || expiresAt <= now
    return {
      email,
      state: expired ? "expired" : "pending",
      invitationId: inv.id,
      invitedAt: inv.createdAt,
      expiresAt,
    }
  })
}

/** Revokes every live invitation for the email. Returns how many it revoked. */
export async function revokeInvitationsFor(email: string): Promise<number> {
  const client = await clerkClient()
  const key = email.trim().toLowerCase()
  const { data } = await client.invitations.getInvitationList({ query: key, limit: 100 })
  let revoked = 0
  for (const inv of data) {
    if (inv.emailAddress.toLowerCase() !== key) continue
    if (inv.revoked || inv.status !== "pending") continue
    await client.invitations.revokeInvitation(inv.id)
    revoked += 1
  }
  return revoked
}

/**
 * Creates the Clerk invitation without Clerk's own email: we send the link
 * inside the branded template instead, so the advisor's first contact looks
 * like the rest of SailFuture's mail and replies reach a person.
 */
export async function createInvitationFor(email: string): Promise<Invitation> {
  const client = await clerkClient()
  return client.invitations.createInvitation({
    emailAddress: email.trim().toLowerCase(),
    redirectUrl: ACCEPT_INVITATION_URL,
    notify: false,
    // A previous (accepted, then deleted) invitation must not block a new one.
    ignoreExisting: true,
    expiresInDays: INVITATION_DAYS,
  })
}

function inviteHtml(firstName: string, email: string, inviteUrl: string) {
  return renderBrandedEmail({
    title: "Welcome, Thesis Advisor",
    subtitle: "You've been invited to the SailFuture Academy Senior Dashboard",
    preheader: `Accept your invitation to start reviewing your students' work.`,
    greeting: `Dear ${firstName},`,
    paragraphs: [
      `You've been added as a <strong>thesis advisor</strong> on the <strong>SailFuture Academy Senior Dashboard</strong>. Seniors at SailFuture Academy develop a business thesis and a life map as part of their graduation requirements, and advisors like you review and guide that work.`,
      `Use the button below to create your account for <strong>${escapeHtml(email)}</strong>. Your email is already confirmed by the invitation, so you'll just set a password and you're in. Once a student is assigned to you, their work will appear on your dashboard.`,
    ],
    tilesIntro: "Here's what you'll be able to do:",
    tiles: [
      {
        label: "Your invitation",
        body: `This link is just for you and works for ${INVITATION_DAYS} days. If it expires, ask us to send a new one.`,
      },
      {
        label: "Your students only",
        body: "Your dashboard shows just the seniors you've been assigned to advise.",
      },
      {
        label: "Business thesis",
        body: "Review a complete business plan: market analysis, operations, and financials.",
      },
      {
        label: "Life map",
        body: "Review each senior's plan for career, education, housing, and finances.",
      },
    ],
    cta: { label: "Accept your invitation", url: inviteUrl },
    footnote: `Questions? Reply to this email or contact <a href="mailto:${REPLY_TO}" style="color:#0d2345;">${REPLY_TO}</a>.`,
  })
}

/**
 * Mails the invitation link. Returns an error message when it can't; the
 * caller decides whether that's fatal (the invitation exists either way).
 */
export async function sendInvitationEmail(
  email: string,
  firstName: string,
  inviteUrl: string
): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return "Email is not configured (RESEND_API_KEY is missing)"

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    replyTo: REPLY_TO,
    subject: "You're invited as a thesis advisor — SailFuture Academy",
    html: inviteHtml(firstName.trim() || "there", email, inviteUrl),
  })
  return error ? error.message : null
}
