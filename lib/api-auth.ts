import type { NextRequest } from "next/server"
import { getAppSession } from "@/lib/clerk-session"

export interface ApiSessionUser {
  role?: string
  students_id?: string
  teachers_id?: string
  advisors_id?: number
  email?: string
  name?: string
}

/**
 * Resolves the caller's identity for route handlers. Backed by Clerk, but kept
 * on the same signature and return shape the routes already used so the
 * handlers themselves did not change during the migration.
 *
 * The `req` argument is no longer needed — Clerk reads the request from async
 * context — but is retained so existing call sites keep compiling.
 */
export async function getApiSession(
  _req?: NextRequest
): Promise<ApiSessionUser | null> {
  const session = await getAppSession()
  if (!session) return null

  return {
    role: session.user.role,
    students_id: session.user.students_id,
    teachers_id: session.user.teachers_id,
    advisors_id: session.user.advisors_id,
    email: session.user.email ?? undefined,
    name: session.user.name ?? undefined,
  }
}
