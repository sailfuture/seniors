import { auth, currentUser, clerkClient } from "@clerk/nextjs/server"
import { lookupRoster, ROSTER_METADATA_VERSION, type RosterMetadata } from "@/lib/roster"
import type { AppRole } from "@/lib/roles"

/**
 * The session shape the app has always consumed. Kept identical to the old
 * NextAuth session so call sites did not have to change during the migration.
 */
export interface AppSessionUser {
  name?: string | null
  email?: string | null
  image?: string | null
  role?: AppRole
  students_id?: string
  teachers_id?: string
  advisors_id?: number
}

export interface AppSession {
  user: AppSessionUser
}

function isRosterMetadata(value: unknown): value is RosterMetadata {
  if (!value || typeof value !== "object") return false
  const role = (value as Record<string, unknown>).role
  return role === "student" || role === "admin" || role === "teacher" || role === "advisor"
}

/**
 * Cached metadata is only trusted at the current version. Older metadata
 * (e.g. v1 staff, all written as "admin" before the admin/teacher split) is
 * re-resolved against Xano so the role tiers take effect without manually
 * resetting every Clerk user.
 */
function isCurrentRosterMetadata(value: unknown): value is RosterMetadata {
  return isRosterMetadata(value) && value.v === ROSTER_METADATA_VERSION
}

/**
 * Reads roster metadata out of the session token when the Clerk instance has
 * been configured to include `{"metadata": "{{user.public_metadata}}"}` in its
 * session token, which avoids a round trip to the Clerk API on every request.
 */
function metadataFromClaims(sessionClaims: unknown): RosterMetadata | null {
  if (!sessionClaims || typeof sessionClaims !== "object") return null
  const claims = sessionClaims as Record<string, unknown>
  const candidate = claims.metadata ?? claims.publicMetadata
  return isCurrentRosterMetadata(candidate) ? candidate : null
}

/**
 * Resolves the signed-in user's roster metadata, writing it to Clerk's
 * publicMetadata the first time so later requests can read it straight off the
 * session token.
 *
 * Returns null when nobody is signed in, or when the signed-in email is not on
 * the SailFuture roster — the check that replaces the old NextAuth `signIn`
 * callback.
 */
export async function resolveRosterUser(): Promise<
  { userId: string; email: string; metadata: RosterMetadata } | null
> {
  const { userId, sessionClaims } = await auth()
  if (!userId) return null

  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress
  if (!email) return null

  const cached = metadataFromClaims(sessionClaims)
  if (cached) return { userId, email, metadata: cached }

  if (isCurrentRosterMetadata(user?.publicMetadata)) {
    return { userId, email, metadata: user.publicMetadata }
  }

  // No metadata, or metadata from before the current version: resolve fresh.
  // A roster miss here also revokes users whose stale metadata no longer has
  // a backing row (e.g. an archived teacher).
  const metadata = await lookupRoster(email)
  if (!metadata) return null

  const client = await clerkClient()
  await client.users.updateUser(userId, { publicMetadata: { ...metadata } })

  return { userId, email, metadata }
}

/**
 * Server-side equivalent of the old `getServerSession`, in the same shape the
 * client components expect.
 */
export async function getAppSession(): Promise<AppSession | null> {
  const resolved = await resolveRosterUser()
  if (!resolved) return null

  const { email, metadata } = resolved
  return {
    user: {
      name: `${metadata.firstName} ${metadata.lastName}`.trim(),
      email,
      image: metadata.profileImage || null,
      role: metadata.role,
      students_id: metadata.students_id,
      teachers_id: metadata.teachers_id,
      advisors_id: metadata.advisors_id,
    },
  }
}
