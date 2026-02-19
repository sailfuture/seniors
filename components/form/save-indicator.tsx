"use client"

import type { SaveStatus } from "@/lib/form-types"
import { cn } from "@/lib/utils"

const statusConfig: Record<SaveStatus, { text: string; className: string }> = {
  idle: { text: "", className: "opacity-0" },
  saving: { text: "Saving...", className: "text-muted-foreground opacity-100" },
  saved: { text: "All changes saved \u2713", className: "text-green-600 opacity-100" },
  error: { text: "Save failed \u2014 retry", className: "text-destructive opacity-100" },
}

export function SaveIndicator({ status }: { status: SaveStatus }) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        "text-xs font-medium transition-opacity duration-300",
        config.className
      )}
    >
      {config.text}
    </span>
  )
}
