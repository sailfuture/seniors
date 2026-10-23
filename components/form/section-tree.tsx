"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Pieces shared by the four overview tables (student and teacher views of the
 * Life Map and Business Thesis) that draw a section with its groups nested
 * underneath.
 */

/**
 * First cell of a group row. A rail drops from the section's lock icon and
 * threads through each group's status icon, so the groups read as steps inside
 * their section rather than as rows of their own. The rail stops at the last
 * group's icon.
 *
 * Offsets assume the section row's cells are `py-3.5` and group rows' `py-2.5`;
 * table cells don't clip, so the first rail reaches up across the row gap.
 */
export function GroupTreeCell({
  first,
  last,
  children,
}: {
  first: boolean
  last: boolean
  children: ReactNode
}) {
  return (
    <div className="relative flex h-7 items-center">
      <span
        aria-hidden
        className={cn(
          "bg-border absolute left-[13.5px] w-px",
          first ? "top-[-24px]" : "top-[-10px]",
          last ? (first ? "h-[calc(50%+24px)]" : "h-[calc(50%+10px)]") : "bottom-[-10px]"
        )}
      />
      {/* The status icon paints over the rail. */}
      <div className="relative [&>div]:bg-background">{children}</div>
    </div>
  )
}

/** Row classes for an expanded section header: no rule between it and its groups. */
export const SECTION_HEADER_ROW_EXPANDED = "border-b-0"
/** Row classes for a group row; the last one keeps the table's rule and a little more room. */
export const GROUP_ROW = "[&>td]:py-2.5 border-b-0"
export const GROUP_ROW_LAST = "[&>td]:py-2.5 [&>td]:pb-3.5"

/** Background for group rows: a step inside the section's surface. */
export function groupRowBackground(locked: boolean) {
  return locked
    ? "bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/30 dark:hover:bg-gray-900/50"
    : "bg-muted/30 hover:bg-muted/60 dark:bg-muted/10 dark:hover:bg-muted/20"
}

/** Section header count: "3 groups · 1 complete". */
export function describeGroups(total: number, complete: number): string {
  const base = `${total} group${total === 1 ? "" : "s"}`
  return complete > 0 ? `${base} · ${complete} complete` : base
}
