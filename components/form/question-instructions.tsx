"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { HugeiconsIcon } from "@hugeicons/react"
import { HelpCircleIcon, Link01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

const SECTION_LABEL = "text-muted-foreground text-xs font-medium tracking-wide uppercase"

/** The template fields that make up a question's instructions. */
export interface QuestionInstructionsSource {
  field_label: string
  detailed_instructions?: string | null
  sentence_starters?: string[] | null
  examples?: string[] | null
  resources?: string[] | null
  min_words?: number | null
}

export function hasQuestionInstructions(q: QuestionInstructionsSource): boolean {
  return !!(
    q.detailed_instructions?.trim() ||
    q.sentence_starters?.length ||
    q.examples?.length ||
    q.resources?.length ||
    (q.min_words ?? 0) > 0
  )
}

/**
 * Question-circle button that opens everything the template tells the student
 * about a question — instructions, sentence starters, word count, examples,
 * resources — in a side sheet. Students use it while writing; reviewers use it
 * to check an answer against what was asked. Renders nothing when the
 * question has no instructions.
 */
export function QuestionInstructions({
  question,
  className,
}: {
  question: QuestionInstructionsSource
  className?: string
}) {
  const [open, setOpen] = useState(false)

  if (!hasQuestionInstructions(question)) return null

  const starters = question.sentence_starters ?? []
  const examples = question.examples ?? []
  const resources = question.resources ?? []
  const minWords = question.min_words ?? 0

  return (
    <>
      <button
        type="button"
        aria-label="Question instructions"
        title="Question instructions"
        onClick={(e) => {
          // Question headers collapse on click; opening the sheet shouldn't.
          e.stopPropagation()
          setOpen(true)
        }}
        className={cn(
          "text-muted-foreground hover:text-foreground hover:bg-accent inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors",
          className
        )}
      >
        <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={1.5} className="size-4" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        {/* React events bubble out of portals; keep sheet clicks away from
            the collapsible header this button sits in. */}
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          {/* The question itself heads the sheet, with the length target
              beside it, so the reader knows what they're answering first. */}
          <SheetHeader className="shrink-0 gap-2 border-b px-6 py-5 pr-12">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Question
            </p>
            <SheetTitle className="text-lg leading-snug font-semibold">{question.field_label}</SheetTitle>
            {minWords > 0 && (
              <span className="bg-muted w-fit rounded-full px-2.5 py-0.5 text-xs font-medium">
                {minWords} words minimum
              </span>
            )}
            <SheetDescription className="sr-only">
              What the question asks for and how the answer should be written
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 divide-y overflow-y-auto">
            {question.detailed_instructions?.trim() && (
              <section className="space-y-2 px-6 py-5">
                <h3 className={SECTION_LABEL}>Instructions</h3>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {question.detailed_instructions}
                </div>
              </section>
            )}
            {starters.length > 0 && (
              <section className="space-y-3 px-6 py-5">
                <h3 className={SECTION_LABEL}>Sentence starters</h3>
                <ul className="space-y-1.5">
                  {starters.map((s, i) => (
                    <li key={i} className="bg-muted/70 rounded-md px-3 py-2 text-sm">
                      {s}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {examples.length > 0 && (
              <section className="space-y-3 px-6 py-5">
                <h3 className={SECTION_LABEL}>{examples.length === 1 ? "Example" : "Examples"}</h3>
                <div className="space-y-4">
                  {examples.map((ex, i) => (
                    <blockquote
                      key={i}
                      className="border-primary/25 text-muted-foreground border-l-2 pl-4 text-sm leading-relaxed whitespace-pre-wrap"
                    >
                      {ex}
                    </blockquote>
                  ))}
                </div>
              </section>
            )}
            {resources.length > 0 && (
              <section className="space-y-3 px-6 py-5">
                <h3 className={SECTION_LABEL}>Resources</h3>
                <div className="space-y-2">
                  {resources.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:bg-muted/50 flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors"
                    >
                      <HugeiconsIcon icon={Link01Icon} strokeWidth={1.5} className="text-muted-foreground size-4 shrink-0" />
                      <span className="truncate text-sm text-blue-600 dark:text-blue-400">{url}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
