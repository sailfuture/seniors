import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export interface ApiSessionUser {
  role?: string
  students_id?: string
  teachers_id?: string
  email?: string
  name?: string
}

export async function getApiSession(req: NextRequest): Promise<ApiSessionUser | null> {
  const secret = process.env.NEXTAUTH_SECRET
  const isSecure = req.nextUrl.protocol === "https:"
  const cookieName = isSecure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token"

  let token = await getToken({ req, secret, cookieName, secureCookie: isSecure })
  if (!token) {
    // Fall back: try the opposite cookie name in case NEXTAUTH_URL doesn't match host.
    token = await getToken({
      req,
      secret,
      cookieName: isSecure ? "next-auth.session-token" : "__Secure-next-auth.session-token",
      secureCookie: !isSecure,
    })
  }
  if (!token) return null
  return {
    role: token.role as string | undefined,
    students_id: token.students_id as string | undefined,
    teachers_id: token.teachers_id as string | undefined,
    email: token.email ?? undefined,
    name: token.name ?? undefined,
  }
}
