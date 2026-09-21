"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { HugeiconsIcon } from "@hugeicons/react"
import { HelpCircleIcon, Link01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

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
          <SheetHeader className="shrink-0 border-b px-6 py-4">
            <SheetTitle className="text-base">Question Instructions</SheetTitle>
            <SheetDescription className="sr-only">
              What the question asks for and how the answer should be written
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {question.detailed_instructions?.trim() && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Instructions</Label>
                <div className="text-sm whitespace-pre-wrap">{question.detailed_instructions}</div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Question</Label>
              <p className="text-sm font-medium">{question.field_label}</p>
            </div>
            {starters.length > 0 && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Sentence Starters</Label>
                <div className="space-y-1.5">
                  {starters.map((s, i) => (
                    <p key={i} className="text-muted-foreground text-sm italic">&ldquo;{s}&rdquo;</p>
                  ))}
                </div>
              </div>
            )}
            {minWords > 0 && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Word Count</Label>
                <p className="text-sm">Minimum {minWords} words required</p>
              </div>
            )}
            {examples.length > 0 && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Examples</Label>
                <div className="space-y-2">
                  {examples.map((ex, i) => (
                    <div key={i} className="bg-muted/30 rounded-md border border-dashed px-3 py-2.5">
                      <p className="text-sm">{ex}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {resources.length > 0 && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Resources</Label>
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
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
