// Review status surfaced on the public pages so fields and groups show
// whether they are pending review, need a resubmission, or haven't been
// submitted yet. Approved work shows no badge — done is the default state.

export type FieldStatus = "revision" | "pending" | "complete" | "empty"

interface StatusLike {
  isComplete?: boolean
  readyReview?: boolean
  revisionNeeded?: boolean
}

export function statusOf(r: StatusLike | null | undefined): FieldStatus | null {
  if (!r) return "empty"
  if (r.revisionNeeded) return "revision"
  if (r.readyReview && !r.isComplete) return "pending"
  if (r.isComplete) return "complete"
  return "empty"
}

/** Aggregate status across a group's responses (revision > pending > not submitted > complete). */
export function groupStatusOf(responses: (StatusLike | null | undefined)[]): FieldStatus | null {
  if (responses.length === 0) return null
  const statuses = responses.map(statusOf)
  if (statuses.some((s) => s === "revision")) return "revision"
  if (statuses.some((s) => s === "pending")) return "pending"
  if (statuses.some((s) => s === "empty")) return "empty"
  return "complete"
}

const STYLES: Record<Exclude<FieldStatus, "complete">, { label: string; className: string; dot: string }> = {
  revision: {
    label: "Revision requested",
    className: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
  pending: {
    label: "Pending review",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  empty: {
    label: "Not submitted",
    className: "border-gray-200 bg-gray-50 text-gray-500",
    dot: "bg-gray-400",
  },
}

export function StatusBadge({
  status,
  className = "",
}: {
  status: FieldStatus | null
  className?: string
}) {
  // Approved work renders clean — no badge.
  if (!status || status === "complete") return null
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
