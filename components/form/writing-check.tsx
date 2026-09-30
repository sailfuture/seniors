"use client"

import { useCallback, useState } from "react"
import { Loader2 } from "lucide-react"
import { HugeiconsIcon } from "@hugeicons/react"
import { DocumentValidationIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  MUST_FIX_LABEL,
  WRITING_CATEGORIES,
  WRITING_CHECK_MAX_CHARS,
  WRITING_ISSUES,
  blocksSubmission,
  excerptAround,
  flagKey,
  type WritingIssue,
} from "@/lib/writing-check"

const CHECK_FAILED = "The check couldn't be completed. Please try again."

/** A finished check: the exact text that was sent, and what came back. */
export interface WritingCheckRun {
  text: string
  issues: WritingIssue[]
}

/** Runs the writing check. Throws with a student-facing message when it can't. */
export async function fetchWritingCheck(text: string): Promise<WritingCheckRun> {
  let res: Response
  try {
    res = await fetch("/api/essay/writing-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
  } catch {
    throw new Error(CHECK_FAILED)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok || !Array.isArray(data?.issues)) {
    throw new Error(typeof data?.error === "string" ? data.error : CHECK_FAILED)
  }
  return { text, issues: data.issues as WritingIssue[] }
}

// Flags the student marked "It's correct", kept in this browser — and in
// memory too, so a mark still counts for this visit where storage is blocked.
const CONFIRMED_KEY = "writing-check:confirmed"
const confirmedThisVisit = new Set<string>()

function loadConfirmed(): Set<string> {
  const keys = new Set(confirmedThisVisit)
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(CONFIRMED_KEY) ?? "[]")
    if (Array.isArray(stored)) for (const key of stored) keys.add(String(key))
  } catch {
    // Unreadable storage: the in-memory marks still apply.
  }
  return keys
}

function saveConfirmed(key: string, correct: boolean): Set<string> {
  const keys = loadConfirmed()
  if (correct) {
    keys.add(key)
    confirmedThisVisit.add(key)
  } else {
    keys.delete(key)
    confirmedThisVisit.delete(key)
  }
  try {
    // Newest last; the cap keeps a long-forgotten list from growing forever.
    localStorage.setItem(CONFIRMED_KEY, JSON.stringify([...keys].slice(-500)))
  } catch {
    // Private mode or storage full: the mark lasts for this visit only.
  }
  return keys
}

/** The must-fix flags (spelling, capitalization, punctuation) still standing
 *  between the text and submitting. */
function unresolvedBlocking(run: WritingCheckRun, confirmed: Set<string>): WritingIssue[] {
  return run.issues.filter((i) => blocksSubmission(i.kind) && !confirmed.has(flagKey(run.text, i)))
}

/**
 * The submission gate: `ok` unless must-fix flags remain that the student
 * hasn't marked correct. Fails open — if the checker can't run, the
 * submission goes ahead; this is a writing step, not an integrity check.
 */
export async function runWritingGate(
  text: string
): Promise<{ ok: boolean; run: WritingCheckRun | null }> {
  try {
    const run = await fetchWritingCheck(text)
    return { ok: unresolvedBlocking(run, loadConfirmed()).length === 0, run }
  } catch {
    return { ok: true, run: null }
  }
}

/** State behind one Check Writing button and its checklist. */
export function useWritingCheck() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState<WritingCheckRun | null>(null)
  const [done, setDone] = useState<Set<number>>(() => new Set())
  const [confirmed, setConfirmed] = useState<Set<string>>(() => new Set())
  // The checklist opened because a submission was held back; it says so.
  const [heldBack, setHeldBack] = useState(false)

  const show = useCallback((next: WritingCheckRun, opts: { heldBack?: boolean } = {}) => {
    setRun(next)
    setDone(new Set())
    setConfirmed(loadConfirmed())
    setError(null)
    setHeldBack(!!opts.heldBack)
    setOpen(true)
  }, [])

  const check = useCallback(
    async (text: string) => {
      setOpen(true)
      setLoading(true)
      setError(null)
      try {
        show(await fetchWritingCheck(text))
      } catch (err) {
        setError(err instanceof Error ? err.message : CHECK_FAILED)
      } finally {
        setLoading(false)
      }
    },
    [show]
  )

  /** For submit handlers: true when the text may be submitted; otherwise
   *  opens the checklist on what's left to fix. */
  const gate = useCallback(
    async (text: string): Promise<boolean> => {
      setLoading(true)
      try {
        const { ok, run: result } = await runWritingGate(text)
        if (!ok && result) show(result, { heldBack: true })
        return ok
      } finally {
        setLoading(false)
      }
    },
    [show]
  )

  const toggleDone = useCallback((index: number) => {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const markCorrect = useCallback((key: string, correct: boolean) => {
    setConfirmed(saveConfirmed(key, correct))
  }, [])

  return { open, setOpen, loading, error, run, done, confirmed, heldBack, show, check, gate, toggleDone, markCorrect }
}

export type WritingCheckState = ReturnType<typeof useWritingCheck>

/** Check Writing button. A red count shows the must-fix items still open from
 *  the latest check. */
export function WritingCheckButton({
  writing,
  text,
  disabled = false,
  compact = false,
}: {
  writing: WritingCheckState
  /** The plain text to check, as it currently reads. */
  text: string
  disabled?: boolean
  /** Smaller, for the footer of a response box. */
  compact?: boolean
}) {
  const tooLong = text.length > WRITING_CHECK_MAX_CHARS
  const toFix =
    writing.run && writing.run.text === text
      ? unresolvedBlocking(writing.run, writing.confirmed).length
      : 0
  const iconClass = compact ? "size-3.5" : "size-4"

  return (
    <button
      type="button"
      onClick={() => writing.check(text)}
      disabled={disabled || writing.loading || !text.trim() || tooLong}
      title={tooLong ? "Too long to check in one go" : "Check spelling, grammar, and punctuation"}
      className={cn(
        "hover:bg-accent text-foreground inline-flex shrink-0 items-center gap-1.5 rounded-md border font-medium transition-colors disabled:opacity-50",
        compact ? "h-6 px-1.5 text-[11px]" : "h-8 px-2 text-xs"
      )}
    >
      {writing.loading ? (
        <Loader2 className={cn("animate-spin", iconClass)} />
      ) : (
        <HugeiconsIcon icon={DocumentValidationIcon} strokeWidth={2} className={iconClass} />
      )}
      Check Writing
      {toFix > 0 && (
        <span className="rounded-full bg-red-600 px-1.5 text-[10px] leading-4 font-semibold text-white">
          {toFix}
        </span>
      )}
    </button>
  )
}

/** The checklist in a side sheet that stays open while the student edits. */
export function WritingCheckSheet({ writing, text }: { writing: WritingCheckState; text: string }) {
  return (
    <Sheet modal={false} open={writing.open} onOpenChange={writing.setOpen}>
      <SheetContent
        className="flex flex-col gap-0 p-0 sm:max-w-md"
        showOverlay={false}
        // Stays open while the student edits beside it; the X closes it.
        onInteractOutside={(e) => e.preventDefault()}
        // React events bubble out of portals; keep sheet clicks away from the
        // question this sheet belongs to.
        onClick={(e) => e.stopPropagation()}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle className="text-base">Writing Check</SheetTitle>
          <SheetDescription>
            Things to check in your writing. Make each fix yourself, then check it off.
          </SheetDescription>
        </SheetHeader>
        <WritingCheckPanel writing={writing} text={text} className="min-h-0 flex-1" />
      </SheetContent>
    </Sheet>
  )
}

/** The checklist body and footer — in the sheet, or inline where another
 *  sheet is already open. */
export function WritingCheckPanel({
  writing,
  text,
  inline = false,
  className,
}: {
  writing: WritingCheckState
  text: string
  inline?: boolean
  className?: string
}) {
  const { run, loading, error } = writing
  const pad = inline ? "px-3" : "px-6"
  return (
    <div className={cn("flex flex-col", className)}>
      <div className={cn("py-4", pad, !inline && "min-h-0 flex-1 overflow-y-auto")}>
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
            <p className="text-sm font-medium">Checking your writing…</p>
          </div>
        ) : error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : run ? (
          <Checklist writing={writing} run={run} stale={run.text !== text} />
        ) : null}
      </div>
      <div className={cn("flex shrink-0 items-center justify-between gap-3 border-t py-3", pad)}>
        {/* The free LanguageTool API requires this visible credit. */}
        <a
          href="https://languagetool.org"
          target="_blank"
          rel="noopener"
          className="text-muted-foreground text-xs underline-offset-2 hover:underline"
        >
          Checked by LanguageTool
        </a>
        <Button
          variant="outline"
          size="sm"
          onClick={() => writing.check(text)}
          disabled={writing.loading || !text.trim() || text.length > WRITING_CHECK_MAX_CHARS}
        >
          Check Again
        </Button>
      </div>
    </div>
  )
}

function Checklist({
  writing,
  run,
  stale,
}: {
  writing: WritingCheckState
  run: WritingCheckRun
  stale: boolean
}) {
  const { done, confirmed, heldBack, toggleDone, markCorrect } = writing

  if (run.issues.length === 0) {
    return (
      <div className="space-y-1 py-6 text-center">
        <p className="text-sm font-medium">Nothing flagged</p>
        <p className="text-muted-foreground text-sm">
          No spelling, grammar, or punctuation issues found. Give it one last read yourself.
        </p>
      </div>
    )
  }

  const items = run.issues.map((issue, index) => ({ issue, index, key: flagKey(run.text, issue) }))
  const groups = WRITING_CATEGORIES.map((category) => ({
    category,
    items: items.filter(({ issue }) => WRITING_ISSUES[issue.kind].category === category),
  })).filter((group) => group.items.length > 0)
  const left = items.filter(({ index, key }) => !done.has(index) && !confirmed.has(key)).length
  const toFix = unresolvedBlocking(run, confirmed).length

  return (
    <div className="space-y-5">
      {heldBack &&
        (toFix > 0 ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            Not submitted yet. Fix the {toFix} {MUST_FIX_LABEL}{" "}
            {toFix === 1 ? "item" : "items"} marked &ldquo;Must fix&rdquo; first. If one is
            correct as written, like a name, choose &ldquo;It&rsquo;s correct.&rdquo;
          </p>
        ) : (
          <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400">
            Nothing is holding up your submission now. You can submit.
          </p>
        ))}
      {stale && (
        <p className="bg-muted/50 text-muted-foreground rounded-md px-3 py-2 text-xs">
          You&rsquo;ve edited since this check. Check again to update the list.
        </p>
      )}
      <div className="space-y-0.5">
        <p className="text-sm font-medium">
          {left === 0 ? "Everything is checked off." : `${left} of ${items.length} left to review`}
        </p>
        {!heldBack && toFix > 0 && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {toFix} marked &ldquo;Must fix&rdquo; will hold up your submission until fixed.
          </p>
        )}
      </div>
      {groups.map(({ category, items: groupItems }) => (
        <section key={category} className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {category} · {groupItems.length}
          </h3>
          <ul className="space-y-2">
            {groupItems.map(({ issue, index, key }) => (
              <ChecklistItem
                key={index}
                text={run.text}
                issue={issue}
                checked={done.has(index)}
                correct={confirmed.has(key)}
                onToggle={() => toggleDone(index)}
                onMarkCorrect={(correct) => markCorrect(key, correct)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** One flag: the words highlighted in their sentence and what to look at —
 *  never the fix. */
function ChecklistItem({
  text,
  issue,
  checked,
  correct,
  onToggle,
  onMarkCorrect,
}: {
  text: string
  issue: WritingIssue
  checked: boolean
  correct: boolean
  onToggle: () => void
  onMarkCorrect: (correct: boolean) => void
}) {
  const def = WRITING_ISSUES[issue.kind]
  const { before, match, after } = excerptAround(text, issue.start, issue.end)

  return (
    <li
      className={cn(
        "flex gap-3 rounded-lg border px-3 py-2.5 transition-opacity",
        (checked || correct) && "opacity-55"
      )}
    >
      <Checkbox
        checked={checked || correct}
        disabled={correct}
        onCheckedChange={onToggle}
        className="mt-0.5"
        aria-label={`Done: ${def.label}`}
      />
      <div className="min-w-0 flex-1 space-y-1">
        {(def.label !== def.category || (def.blocks && !correct)) && (
          <p className="flex items-center gap-2 text-xs">
            {def.label !== def.category && <span className="font-semibold">{def.label}</span>}
            {def.blocks && !correct && (
              <span className="font-medium text-red-600 dark:text-red-400">Must fix</span>
            )}
          </p>
        )}
        <p className="text-sm leading-relaxed break-words">
          {before}
          <mark className="text-foreground rounded-sm bg-amber-200/80 px-0.5 dark:bg-amber-400/30">
            {match}
          </mark>
          {after}
        </p>
        <p className="text-muted-foreground text-xs">{def.message}</p>
        {blocksSubmission(issue.kind) &&
          (correct ? (
            <p className="text-xs">
              <span className="text-green-700 dark:text-green-400">Marked correct</span>
              {" · "}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                onClick={() => onMarkCorrect(false)}
              >
                Undo
              </button>
            </p>
          ) : (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
              onClick={() => onMarkCorrect(true)}
            >
              It&rsquo;s correct
            </button>
          ))}
      </div>
    </li>
  )
}
