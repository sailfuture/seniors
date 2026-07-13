// Review status surfaced on the public pages so fields and groups show
// whether they are pending review, need a resubmission, or are complete.

export type FieldStatus = "revision" | "pending" | "complete"

interface StatusLike {
  isComplete?: boolean
  readyReview?: boolean
  revisionNeeded?: boolean
}

export function statusOf(r: StatusLike | null | undefined): FieldStatus | null {
  if (!r) return null
  if (r.revisionNeeded) return "revision"
  if (r.readyReview && !r.isComplete) return "pending"
  if (r.isComplete) return "complete"
  return null
}

/** Aggregate status across a group's responses (revision > pending > complete). */
export function groupStatusOf(responses: (StatusLike | null | undefined)[]): FieldStatus | null {
  const present = responses.filter(Boolean) as StatusLike[]
  if (present.length === 0) return null
  if (present.some((r) => r.revisionNeeded)) return "revision"
  if (present.some((r) => r.readyReview && !r.isComplete)) return "pending"
  if (present.every((r) => r.isComplete)) return "complete"
  return null
}

const STYLES: Record<FieldStatus, { label: string; className: string; dot: string }> = {
  revision: {
    label: "Revision requested",
    className: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
  pending: {
    label: "Pending review",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  complete: {
    label: "Complete",
    className: "border-green-200 bg-green-50 text-green-700",
    dot: "bg-green-500",
  },
}

export function StatusBadge({
  status,
  className = "",
}: {
  status: FieldStatus | null
  className?: string
}) {
  if (!status) return null
  const s = STYLES[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${s.className} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}
