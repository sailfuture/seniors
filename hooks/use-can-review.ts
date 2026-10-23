"use client"

import { useSession } from "@/components/session-provider"
import { canReviewWork } from "@/lib/roles"

/** Whether the signed-in user may change review status (see canReviewWork). */
export function useCanReview(): boolean {
  const { data: session } = useSession()
  return canReviewWork((session?.user as Record<string, unknown> | undefined)?.role)
}
