"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { SquareLock01Icon } from "@hugeicons/core-free-icons"

/** Shown on student surfaces while their project is locked: everything is
    view-only until a teacher unlocks it. */
export function ProjectLockedBanner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 ${className}`}
    >
      <HugeiconsIcon icon={SquareLock01Icon} strokeWidth={2} className="size-4 shrink-0 text-amber-600" />
      <span>
        This project has been locked by your teacher and is view-only. Ask your teacher to unlock it
        if something needs to change.
      </span>
    </div>
  )
}
