/** Where a question stands, shown as its card's border on both the student and
    staff pages so unfinished work stands apart from approved answers. */
export type CardTone = "complete" | "revision" | "ready" | "draft" | "empty"

export const CARD_TONE_BORDER: Record<Exclude<CardTone, "complete">, string> = {
  revision: "border-red-300 dark:border-red-500/50",
  ready: "border-blue-300 dark:border-blue-500/50",
  draft: "border-amber-300 dark:border-amber-500/50",
  empty: "border-dashed border-gray-300 dark:border-gray-600",
}

export function cardTone(status: {
  isComplete?: boolean
  revisionNeeded?: boolean
  readyReview?: boolean
  hasContent: boolean
}): CardTone {
  if (status.isComplete) return "complete"
  if (status.revisionNeeded) return "revision"
  if (status.readyReview) return "ready"
  return status.hasContent ? "draft" : "empty"
}
