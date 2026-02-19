"use client"

import type { SectionStatus } from "@/lib/form-types"
import { cn } from "@/lib/utils"

const dotColors: Record<SectionStatus, string> = {
  empty: "bg-red-500",
  "in-progress": "bg-yellow-500",
  complete: "bg-green-500",
}

export function SectionStatusDot({ status }: { status: SectionStatus }) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", dotColors[status])}
      aria-label={`Status: ${status}`}
    />
  )
}
