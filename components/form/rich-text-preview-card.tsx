"use client"

import { AI_BLOCK_THRESHOLD, normalizeAiPercent } from "@/lib/ai-submission-check"
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

/** The GPTZero scores as one footer line, the same way every other question
 *  type shows them, so the student can see why an AI-flagged essay was
 *  rejected. */
function AiScoreReport({ data }: { data: PlagiarismData }) {
  const ai = toPercent(data.class_probability_ai ?? 0)
  const human = toPercent(data.class_probability_human ?? 0)
  const mixed = toPercent(data.mixed ?? 0)
  const max = Math.max(ai, human, mixed)
  const aiIsMax = ai === max && ai > 0
  const humanIsMax = human === max && human > 0
  // Same unrounded comparison as the submission gate, so the card agrees.
  const rejected = normalizeAiPercent(data.class_probability_ai) > AI_BLOCK_THRESHOLD

  return (
    <span className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 text-xs">
      {rejected && (
        <>
          <span className="font-semibold text-red-600">AI content detected</span>
          <span className="text-muted-foreground/40">&mdash;</span>
        </>
      )}
      <span className={aiIsMax ? "font-bold text-red-600" : "text-muted-foreground"}>AI: {ai}%</span>
      <span className="text-muted-foreground/40">&bull;</span>
      <span className={humanIsMax ? "font-bold text-green-600" : "text-muted-foreground"}>Human: {human}%</span>
      <span className="text-muted-foreground/40">&bull;</span>
      <span
        className={
          mixed === max && mixed > 0 && !aiIsMax && !humanIsMax ? "font-bold text-amber-600" : "text-muted-foreground"
        }
      >
        Mixed: {mixed}%
      </span>
    </span>
  )
}

/**
 * Shown in place of an input on the section form for rich-text questions.
 * The essay itself is written on the dedicated full-page editor at
 * `<current section route>/write/<questionId>`; this card just previews the
 * content and links there, so no TipTap code runs on the section page.
 */
export function RichTextPreviewCard({
  value,
  minWords,
  plagiarism,
}: {
  value: string
  minWords?: number
  plagiarism?: PlagiarismData
}) {
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
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {/* The button that opened the editor now lives in the question's
            header row, inline with the submission actions. */}
        {minWords ? (
          <span className="text-muted-foreground/60 text-xs">
            {wordCount} / {minWords} min words
          </span>
        ) : (
          <span className="text-muted-foreground/60 text-xs">
            {isEmpty ? "" : `${wordCount} ${wordCount === 1 ? "word" : "words"}`}
          </span>
        )}
        {/* Lower-right: the AI scores once a submission has been checked. */}
        {plagiarism && <AiScoreReport data={plagiarism} />}
      </div>
    </div>
  )
}
