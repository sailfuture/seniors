"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  CircleIcon,
  Comment01Icon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

const STATUS_COUNT = {
  complete: { icon: CheckmarkCircle02Icon, strokeWidth: 2, iconClass: "text-green-600", label: "complete" },
  ready: { icon: SentIcon, strokeWidth: 2, iconClass: "text-blue-500", label: "ready for review" },
  revision: { icon: AlertCircleIcon, strokeWidth: 2, iconClass: "text-red-500", label: "need revision" },
  blank: { icon: CircleIcon, strokeWidth: 1.5, iconClass: "text-muted-foreground/50", label: "not started" },
  comment: { icon: Comment01Icon, strokeWidth: 2, iconClass: "text-muted-foreground", label: "comments" },
} as const

export type StatusCountKind = keyof typeof STATUS_COUNT

/**
 * A status tally: the status icon with its count beside it, in a small
 * bordered box. Used on review-page group headers and the advisor home so
 * the same status always looks the same. Renders nothing at zero.
 */
export function StatusCount({
  kind,
  count,
  size = "default",
}: {
  kind: StatusCountKind
  count: number
  size?: "default" | "sm"
}) {
  if (count <= 0) return null
  const k = STATUS_COUNT[kind]
  return (
    <span
      className={cn(
        "bg-background inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 text-xs font-semibold tabular-nums",
        size === "sm" ? "h-7" : "h-8"
      )}
      title={`${count} ${k.label}`}
    >
      <HugeiconsIcon icon={k.icon} strokeWidth={k.strokeWidth} className={cn("size-4", k.iconClass)} />
      {count}
    </span>
  )
}
