"use client"

import { createContext, useContext } from "react"
import type { AppSession } from "@/lib/clerk-session"

export type SessionStatus = "loading" | "authenticated" | "unauthenticated"

const AppSessionContext = createContext<AppSession | null>(null)

/**
 * Carries the session resolved on the server (Clerk identity + Xano roster
 * metadata) down to client components, so they never have to wait on a
 * client-side session fetch or re-read Clerk's publicMetadata themselves.
 */
export function SessionProvider({
  session,
  children,
}: {
  session: AppSession | null
  children: React.ReactNode
}) {
  return (
    <AppSessionContext.Provider value={session}>
      {children}
    </AppSessionContext.Provider>
  )
}

/**
 * Drop-in replacement for next-auth's `useSession`. Returns the same
 * `{ data, status }` shape the app already consumed.
 */
export function useSession(): {
  data: AppSession | null
  status: SessionStatus
} {
  const session = useContext(AppSessionContext)
  return {
    data: session,
    status: session ? "authenticated" : "unauthenticated",
  }
}
