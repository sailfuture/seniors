"use client"

import { useSession } from "@/components/session-provider"
import { canApproveWork, canRequestRevision } from "@/lib/roles"

function useRole(): unknown {
  const { data: session } = useSession()
  return (session?.user as Record<string, unknown> | undefined)?.role
}

/** Whether the signed-in user may approve work (see canApproveWork). */
export function useCanApprove(): boolean {
  return canApproveWork(useRole())
}

/** Whether the signed-in user may request a revision or undo a review
    (staff and advisors). */
export function useCanRequestRevision(): boolean {
  return canRequestRevision(useRole())
}
