"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { LicenseDraftIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { extractPlainText, richTextWordCount } from "@/lib/rich-text"

const SNIPPET_WORDS = 50

interface PlagiarismData {
  class_probability_ai?: number | string
  class_probability_human?: number | string
  mixed?: number | string
  [key: string]: unknown
}

function toPercent(val: unknown): number {
  const n = typeof val === "string" ? parseFloat(val) : typeof val === "number" ? val : 0
  if (isNaN(n)) return 0
  return n <= 1 ? Math.round(n * 100) : Math.round(n)
}

/** Compact GPTZero score report — shown after a submission so the student can
 *  see why an AI-flagged essay was rejected. */
function AiScoreReport({ data }: { data: PlagiarismData }) {
  const ai = toPercent(data.class_probability_ai ?? 0)
  const human = toPercent(data.class_probability_human ?? 0)
  const mixed = toPercent(data.mixed ?? 0)
  const max = Math.max(ai, human, mixed)
  const aiIsMax = ai === max && ai > 0
  const rejected = ai > 50

  return (
    <div
      className={`shrink-0 rounded-md border px-2.5 py-1.5 text-right text-[11px] ${
        rejected ? "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10" : "bg-muted/40"
      }`}
    >
      <p className={`font-semibold ${rejected ? "text-red-600" : "text-muted-foreground"}`}>
        {rejected ? "AI content detected" : "Originality check"}
      </p>
      <div className="mt-0.5 flex items-center justify-end gap-2">
        <span className={aiIsMax ? "font-bold text-red-600" : "text-muted-foreground"}>AI {ai}%</span>
        <span className="text-muted-foreground/40">&bull;</span>
        <span className={human === max && human > 0 ? "font-bold text-green-600" : "text-muted-foreground"}>
          Human {human}%
        </span>
        <span className="text-muted-foreground/40">&bull;</span>
        <span className={mixed === max && mixed > 0 && !aiIsMax ? "font-bold text-amber-600" : "text-muted-foreground"}>
          Mixed {mixed}%
        </span>
      </div>
    </div>
  )
}

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
  plagiarism,
}: {
  questionId: number
  value: string
  minWords?: number
  disabled?: boolean
  plagiarism?: PlagiarismData
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
      <div className="mt-3 flex items-end justify-between gap-3">
        {/* Left: the action, with the word count directly beneath it. */}
        <div className="flex flex-col items-start gap-1.5">
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
        {/* Lower-right: the AI score report once a submission has been checked. */}
        {plagiarism && <AiScoreReport data={plagiarism} />}
      </div>
    </div>
  )
}
