"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { LicenseDraftIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { extractPlainText, richTextWordCount } from "@/lib/rich-text"

const SNIPPET_WORDS = 50

/**
 * Shown in place of an input on the section form for rich-text questions.
 * The essay itself is written on the dedicated full-page editor at
 * `<current section route>/write/<questionId>`; this card just previews the
 * content and links there, so no TipTap code runs on the section page.
 */
export function RichTextPreviewCard({
  questionId,
  value,
  minWords,
  disabled = false,
}: {
  questionId: number
  value: string
  minWords?: number
  disabled?: boolean
}) {
  const pathname = usePathname()
  const href = `${pathname}/write/${questionId}`
  const text = extractPlainText(value)
  const wordCount = richTextWordCount(value)
  const words = text.split(/\s+/).filter(Boolean)
  const snippet = words.slice(0, SNIPPET_WORDS).join(" ")
  const isEmpty = wordCount === 0

  return (
    <div className="rounded-lg border border-dashed px-4 py-3">
      {isEmpty ? (
        <p className="text-muted-foreground text-sm italic">
          No essay written yet.
        </p>
      ) : (
        <p className="text-sm">
          {snippet}
          {words.length > SNIPPET_WORDS && <span className="text-muted-foreground"> …</span>}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" asChild className="gap-2">
          <Link href={href}>
            <HugeiconsIcon icon={LicenseDraftIcon} strokeWidth={2} className="size-4" />
            {disabled ? "View Essay" : isEmpty ? "Open Essay Editor" : "Continue Writing"}
          </Link>
        </Button>
        {minWords ? (
          <span className="text-muted-foreground/60 text-xs">
            {wordCount} / {minWords} min words
          </span>
        ) : !isEmpty ? (
          <span className="text-muted-foreground/60 text-xs">
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
        ) : null}
      </div>
    </div>
  )
}
