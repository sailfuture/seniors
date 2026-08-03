"use client"

import { useMemo } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  CircleIcon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { FieldActivityStream } from "@/components/form/field-activity-stream"
import type { Comment } from "@/lib/form-types"
import type { ResponseEvent } from "@/lib/response-events"

export interface GroupActivityQuestion {
  id: number
  field_name: string
  field_label: string
}

export interface GroupActivityResponse {
  templateId: number
  isComplete?: boolean
  revisionNeeded?: boolean
  readyReview?: boolean
}

/**
 * Timeline sheet for one group of questions: every submission, comment,
 * revision request, and approval across the group's fields in one running
 * stream, with the group's aggregate status pinned in the header.
 */
export function GroupActivitySheet({
  open,
  onOpenChange,
  groupName,
  viewer,
  questions,
  responses,
  comments,
  events,
  loading = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupName: string
  viewer: "teacher" | "student"
  /** The group's questions, used for scoping and labeling. */
  questions: GroupActivityQuestion[]
  /** Current review state per question (missing = not started). */
  responses: GroupActivityResponse[]
  /** Comments already scoped to this group (field + group-level). */
  comments: Comment[]
  /** The student's full event log; filtered to the group's fields here. */
  events: ResponseEvent[]
  loading?: boolean
}) {
  const fieldNames = useMemo(
    () => new Set(questions.map((q) => q.field_name)),
    [questions]
  )
  const labelByField = useMemo(
    () => new Map(questions.map((q) => [q.field_name, q.field_label || q.field_name])),
    [questions]
  )
  const groupEvents = useMemo(
    () => events.filter((e) => fieldNames.has(e.field_name)),
    [events, fieldNames]
  )

  const statusByTemplate = new Map(responses.map((r) => [r.templateId, r]))
  const approved = questions.filter((q) => statusByTemplate.get(q.id)?.isComplete).length
  const revision = questions.filter((q) => {
    const r = statusByTemplate.get(q.id)
    return r?.revisionNeeded && !r?.isComplete
  }).length
  const submitted = questions.filter((q) => {
    const r = statusByTemplate.get(q.id)
    return r?.readyReview && !r?.isComplete && !r?.revisionNeeded
  }).length
  const notStarted = questions.length - approved - revision - submitted
  const isComplete = questions.length > 0 && approved === questions.length
  const pct = questions.length > 0 ? Math.round((approved / questions.length) * 100) : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle className="text-base">{groupName} — Activity</SheetTitle>
          <SheetDescription className="sr-only">
            Activity timeline for this group
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span
              className={cn(
                "font-semibold",
                isComplete ? "text-green-600" : "text-muted-foreground"
              )}
            >
              {isComplete ? "Completed" : `In progress · ${pct}%`}
            </span>
            <span className="inline-flex items-center gap-1">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3.5 text-green-600" />
              {approved} approved
            </span>
            {revision > 0 && (
              <span className="inline-flex items-center gap-1 text-red-600">
                <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-3.5" />
                {revision} awaiting revision
              </span>
            )}
            {submitted > 0 && (
              <span className="inline-flex items-center gap-1 text-blue-600">
                <HugeiconsIcon icon={SentIcon} strokeWidth={2} className="size-3.5" />
                {submitted} in review
              </span>
            )}
            {notStarted > 0 && (
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <HugeiconsIcon icon={CircleIcon} strokeWidth={1.5} className="size-3.5" />
                {notStarted} not submitted
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <FieldActivityStream
              comments={comments}
              events={groupEvents}
              viewer={viewer}
              fieldLabelFor={(fieldName) => labelByField.get(fieldName)}
              scrollToLatest
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
