"use client"

import { useState } from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { HugeiconsIcon } from "@hugeicons/react"
import { LegalDocumentIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { Comment } from "@/lib/form-types"

interface CommentPopoverProps {
  fieldName: string
  comments: Comment[]
  onMarkRead?: (commentIds: number[]) => void
}

export function CommentPopover({ fieldName, comments, onMarkRead }: CommentPopoverProps) {
  const [open, setOpen] = useState(false)

  const fieldComments = comments.filter((c) => c.field_name === fieldName)
  if (fieldComments.length === 0) return null

  const hasUnread = fieldComments.some((c) => !c.isOld)

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && hasUnread && onMarkRead) {
      const unreadIds = fieldComments
        .filter((c) => !c.isOld && c.id)
        .map((c) => c.id!)
      if (unreadIds.length > 0) onMarkRead(unreadIds)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative inline-flex size-6 items-center justify-center rounded-md transition-colors hover:bg-accent",
            hasUnread ? "text-primary" : "text-muted-foreground"
          )}
        >
          <HugeiconsIcon icon={LegalDocumentIcon} strokeWidth={2} className="size-3.5" />
          {hasUnread && (
            <span className="bg-primary absolute -right-0.5 -top-0.5 size-1.5 rounded-full" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <p className="text-sm font-medium">Teacher Feedback</p>
          <div className="space-y-2">
            {fieldComments.map((comment, i) => (
              <div
                key={comment.id ?? i}
                className={cn(
                  "rounded-md border p-2 text-sm",
                  !comment.isOld && "border-primary/30 bg-primary/5"
                )}
              >
                {comment.teacher_name && (
                  <p className="text-muted-foreground mb-1 text-xs font-medium">
                    {comment.teacher_name}
                  </p>
                )}
                <p>{comment.note}</p>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
