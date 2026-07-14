"use client"

import { useCallback, useRef, useState } from "react"
import { RichTextEditor, type RichTextCommentConfig } from "./rich-text-editor"

/**
 * Teacher-facing view of a student's rich-text essay that permits inline
 * comment highlights but NOT prose edits (annotate-only). Adding or resolving a
 * highlight changes the stored document, so this persists student_response —
 * but deliberately leaves last_edited/wordCount alone, since annotating is not
 * a student edit and must not reorder the review queue.
 *
 * The teacher writes to the same field the student edits; treat commenting as
 * an async review action (don't annotate while the student is actively typing).
 */
export function TeacherEssayAnnotator({
  initialValue,
  patchUrl,
  comments,
}: {
  initialValue: string
  /** Full URL of the response to PATCH, e.g. `${responsePatchBase}/${id}`. */
  patchUrl: string
  comments: RichTextCommentConfig
}) {
  const [value, setValue] = useState(initialValue)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(initialValue)

  const persist = useCallback(async () => {
    try {
      await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_response: latest.current }),
      })
    } catch {
      /* best-effort; the highlight stays locally until the next change */
    }
  }, [patchUrl])

  const handleChange = useCallback(
    (v: string) => {
      setValue(v)
      latest.current = v
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(persist, 600)
    },
    [persist]
  )

  return (
    <RichTextEditor
      className="rounded-lg border bg-white dark:bg-card"
      value={value}
      onChange={handleChange}
      annotateOnly
      minHeightClass="min-h-0"
      comments={comments}
    />
  )
}
