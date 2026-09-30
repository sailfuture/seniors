"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2 } from "lucide-react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, DocumentValidationIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { useSideDock } from "@/components/side-dock"
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
  type WritingIssueKind,
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

/** The must-fix flags (spelling, capitalization, punctuation) in a fresh
 *  check that the student hasn't marked correct. */
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

/**
 * A flag as it stands now: `at` is where it sat in the checked text (for the
 * excerpt and the "It's correct" key); `start`/`end` follow it through the
 * student's edits. Once its own words change, it's `edited` — being fixed.
 */
export interface LiveIssue {
  index: number
  kind: WritingIssueKind
  key: string
  at: { start: number; end: number }
  start: number
  end: number
  edited: boolean
}

interface LiveText {
  text: string
  issues: LiveIssue[]
}

/** Moves flags through one edit (typing is always one contiguous change). */
function shiftIssues(prev: string, next: string, issues: LiveIssue[]): LiveIssue[] {
  const max = Math.min(prev.length, next.length)
  let head = 0
  while (head < max && prev[head] === next[head]) head++
  let tail = 0
  while (tail < max - head && prev[prev.length - 1 - tail] === next[next.length - 1 - tail]) tail++
  const editEnd = prev.length - tail
  const delta = next.length - prev.length
  return issues.map((issue) => {
    if (issue.edited || issue.end <= head) return issue
    if (issue.start >= editEnd) return { ...issue, start: issue.start + delta, end: issue.end + delta }
    return { ...issue, edited: true }
  })
}

/** State behind one Check Writing button, its checklist, and its highlights.
 *  `inline` keeps the checklist in the page (for use inside another sheet)
 *  instead of the side dock. */
export function useWritingCheck({ inline = false }: { inline?: boolean } = {}) {
  const dock = useSideDock()
  const docked = !inline && dock.available
  const [inlineOpen, setInlineOpen] = useState(false)
  const open = docked ? dock.open : inlineOpen
  const setOpen = docked ? dock.setOpen : setInlineOpen

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState<WritingCheckRun | null>(null)
  const [live, setLive] = useState<LiveText | null>(null)
  const [done, setDone] = useState<Set<number>>(() => new Set())
  const [confirmed, setConfirmed] = useState<Set<string>>(() => new Set())
  // The checklist opened because a submission was held back; it says so.
  const [heldBack, setHeldBack] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  // Set by the text box the flags belong to, so an item can jump to its words.
  const locatorRef = useRef<((issue: LiveIssue) => void) | null>(null)

  const show = useCallback(
    (next: WritingCheckRun, opts: { heldBack?: boolean } = {}) => {
      setRun(next)
      setLive({
        text: next.text,
        issues: next.issues.map((issue, index) => ({
          index,
          kind: issue.kind,
          key: flagKey(next.text, issue),
          at: { start: issue.start, end: issue.end },
          start: issue.start,
          end: issue.end,
          edited: false,
        })),
      })
      setDone(new Set())
      setConfirmed(loadConfirmed())
      setError(null)
      setHeldBack(!!opts.heldBack)
      setActiveIndex(null)
      setOpen(true)
    },
    [setOpen]
  )

  /** Runs a fresh check and shows it. */
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
    [show, setOpen]
  )

  /** The button: reopens the last results, or checks if there are none yet. */
  const openOrCheck = useCallback(
    (text: string) => {
      if (run) setOpen(true)
      else void check(text)
    },
    [run, setOpen, check]
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

  /** Call from a plain text box's onChange so the flags follow the edit. */
  const track = useCallback((next: string) => {
    setLive((prev) =>
      prev && prev.text !== next
        ? { text: next, issues: shiftIssues(prev.text, next, prev.issues) }
        : prev
    )
  }, [])

  /** For editors that track positions themselves (the essay editor). */
  const markEdited = useCallback((indexes: number[]) => {
    setLive((prev) =>
      // Already marked: keep the same state so React can skip the render.
      prev && prev.issues.some((issue) => !issue.edited && indexes.includes(issue.index))
        ? {
            ...prev,
            issues: prev.issues.map((issue) =>
              indexes.includes(issue.index) ? { ...issue, edited: true } : issue
            ),
          }
        : prev
    )
  }, [])

  const setLocator = useCallback((locate: ((issue: LiveIssue) => void) | null) => {
    locatorRef.current = locate
  }, [])

  const locate = useCallback(
    (index: number) => {
      setActiveIndex(index)
      const issue = live?.issues.find((i) => i.index === index)
      if (issue && !issue.edited) locatorRef.current?.(issue)
    },
    [live]
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

  // Must-fix flags that still stand: not being edited, not marked correct.
  const toFix = live
    ? live.issues.filter((i) => blocksSubmission(i.kind) && !i.edited && !confirmed.has(i.key)).length
    : 0

  return {
    docked,
    dockNode: dock.node,
    open,
    setOpen,
    loading,
    error,
    run,
    live,
    done,
    confirmed,
    heldBack,
    activeIndex,
    toFix,
    show,
    check,
    openOrCheck,
    gate,
    track,
    markEdited,
    setLocator,
    locate,
    toggleDone,
    markCorrect,
  }
}

export type WritingCheckState = ReturnType<typeof useWritingCheck>

/** Check Writing button. Reopens the last results; "Check Again" in the
 *  checklist runs a fresh check. A red count shows must-fix items left. */
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
  const iconClass = compact ? "size-3.5" : "size-4"

  return (
    <button
      type="button"
      onClick={() => writing.openOrCheck(text)}
      disabled={disabled || writing.loading || !text.trim() || tooLong}
      title={tooLong ? "Too long to check in one go" : "Check spelling, grammar, and punctuation"}
      aria-pressed={writing.open}
      className={cn(
        "hover:bg-accent text-foreground inline-flex shrink-0 items-center gap-1.5 rounded-md border font-medium transition-colors disabled:opacity-50",
        writing.open && "bg-accent",
        compact ? "h-7 px-2 text-xs" : "h-8 px-2 text-xs"
      )}
    >
      {writing.loading ? (
        <Loader2 className={cn("animate-spin", iconClass)} />
      ) : (
        <HugeiconsIcon icon={DocumentValidationIcon} strokeWidth={2} className={iconClass} />
      )}
      Check Writing
      {writing.toFix > 0 && (
        <span className="rounded-full bg-red-600 px-1.5 text-[10px] leading-4 font-semibold text-white">
          {writing.toFix}
        </span>
      )}
    </button>
  )
}

/** The checklist, docked beside the page while open. `title` names what it's
 *  checking (the question), since the panel sits apart from the text box. */
export function WritingCheckDock({
  writing,
  text,
  title,
}: {
  writing: WritingCheckState
  text: string
  title?: string
}) {
  if (!writing.open || !writing.docked || !writing.dockNode) return null
  return createPortal(
    // Light gray, so the panel reads as apart from the white answer boxes.
    <div className="bg-muted flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Writing Check</h2>
          {title && <p className="text-muted-foreground mt-0.5 truncate text-sm">{title}</p>}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => writing.setOpen(false)}
          aria-label="Close Writing Check"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      </div>
      <WritingCheckPanel writing={writing} text={text} className="min-h-0 flex-1" />
    </div>,
    writing.dockNode
  )
}

/** The checklist body and footer — in the dock, or inline where another
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
  const { run, live, loading, error } = writing
  const pad = inline ? "px-3" : "px-5"
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
        ) : run && live ? (
          <Checklist writing={writing} run={run} live={live} stale={run.text !== text} />
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
          disabled={loading || !text.trim() || text.length > WRITING_CHECK_MAX_CHARS}
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
  live,
  stale,
}: {
  writing: WritingCheckState
  run: WritingCheckRun
  live: LiveText
  stale: boolean
}) {
  const { done, confirmed, heldBack, activeIndex, toFix, toggleDone, markCorrect, locate } = writing

  if (live.issues.length === 0) {
    return (
      <div className="space-y-1 py-6 text-center">
        <p className="text-sm font-medium">Nothing flagged</p>
        <p className="text-muted-foreground text-sm">
          No spelling, grammar, or punctuation issues found. Give it one last read yourself.
        </p>
      </div>
    )
  }

  // Must-fix items first, then suggestions — each grouped by category, so
  // "must fix" is said once as a heading rather than on every item.
  const sections = [
    { title: "Must fix before submitting", blocks: true },
    { title: "Suggestions", blocks: false },
  ]
    .map((section) => {
      const issues = live.issues.filter((issue) => blocksSubmission(issue.kind) === section.blocks)
      const groups = WRITING_CATEGORIES.map((category) => ({
        category,
        items: issues.filter((issue) => WRITING_ISSUES[issue.kind].category === category),
      })).filter((group) => group.items.length > 0)
      return { ...section, count: issues.length, groups }
    })
    .filter((section) => section.count > 0)
  const left = live.issues.filter(
    (issue) => !done.has(issue.index) && !confirmed.has(issue.key) && !issue.edited
  ).length

  return (
    <div className="space-y-5">
      {heldBack &&
        (toFix > 0 ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            Not submitted yet. Fix the {toFix} {MUST_FIX_LABEL}{" "}
            {toFix === 1 ? "item" : "items"} under &ldquo;Must fix before submitting&rdquo;
            first. If one is correct as written, like a name, choose &ldquo;It&rsquo;s
            correct.&rdquo;
          </p>
        ) : (
          <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400">
            Nothing flagged is holding up your submission now. Submit again to re-check.
          </p>
        ))}
      {stale && (
        <p className="bg-muted/50 text-muted-foreground rounded-md px-3 py-2 text-xs">
          You&rsquo;ve edited since this check. Check again for an updated list.
        </p>
      )}
      <div className="space-y-0.5">
        <p className="text-sm font-medium">
          {left === 0
            ? "Everything is checked off."
            : `${left} of ${live.issues.length} left to review`}
        </p>
      </div>
      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h3
            className={cn(
              "text-sm font-semibold",
              section.blocks ? "text-red-700 dark:text-red-400" : "text-foreground"
            )}
          >
            {section.title} · {section.count}
          </h3>
          {section.groups.map(({ category, items }) => (
            <div key={category} className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {category}
              </p>
              <ul className="space-y-2">
                {items.map((issue) => (
                  <ChecklistItem
                    key={issue.index}
                    text={run.text}
                    issue={issue}
                    active={activeIndex === issue.index}
                    checked={done.has(issue.index)}
                    correct={confirmed.has(issue.key)}
                    onLocate={() => locate(issue.index)}
                    onToggle={() => toggleDone(issue.index)}
                    onMarkCorrect={(correct) => markCorrect(issue.key, correct)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

/** One flag: the words highlighted in their sentence and what to look at —
 *  never the fix. Clicking it jumps to the words in the text box. */
function ChecklistItem({
  text,
  issue,
  active,
  checked,
  correct,
  onLocate,
  onToggle,
  onMarkCorrect,
}: {
  text: string
  issue: LiveIssue
  active: boolean
  checked: boolean
  correct: boolean
  onLocate: () => void
  onToggle: () => void
  onMarkCorrect: (correct: boolean) => void
}) {
  const def = WRITING_ISSUES[issue.kind]
  const { before, match, after } = excerptAround(text, issue.at.start, issue.at.end)
  const settled = checked || correct || issue.edited

  return (
    <li
      className={cn(
        "bg-background flex gap-3 rounded-lg border px-3 py-2.5 transition-[opacity,box-shadow]",
        settled && "opacity-55",
        active && "ring-ring/40 ring-2"
      )}
    >
      <Checkbox
        checked={settled}
        disabled={correct || issue.edited}
        onCheckedChange={onToggle}
        className="mt-0.5"
        aria-label={`Done: ${def.label}`}
      />
      <div className="min-w-0 flex-1 space-y-1">
        {def.label !== def.category && <p className="text-xs font-semibold">{def.label}</p>}
        <button
          type="button"
          onClick={onLocate}
          disabled={issue.edited}
          title={issue.edited ? undefined : "Show in your writing"}
          className="block w-full cursor-pointer rounded-sm text-left text-sm leading-relaxed break-words disabled:cursor-default"
        >
          {before}
          <mark
            className={cn(
              "text-foreground rounded-sm px-0.5",
              def.blocks ? "bg-red-200/80 dark:bg-red-500/30" : "bg-amber-200/80 dark:bg-amber-400/30"
            )}
          >
            {match}
          </mark>
          {after}
        </button>
        <p className="text-muted-foreground text-xs">
          {issue.edited ? "Edited. Check again to confirm it's fixed." : def.message}
        </p>
        {def.blocks &&
          !issue.edited &&
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

/** Tints for a flag in the text itself: must-fix red, advice amber. Hidden
 *  inside an editor marked data-wc-hidden (its checklist is closed). */
export function flagTint(blocks: boolean, active: boolean): string {
  return cn(
    "rounded-[3px] in-data-[wc-hidden=true]:bg-transparent in-data-[wc-hidden=true]:outline-none",
    blocks ? "bg-red-300/45 dark:bg-red-500/35" : "bg-amber-300/50 dark:bg-amber-400/30",
    active && "outline-2 outline-offset-1 outline-red-500/70"
  )
}

// Text-layout properties the highlight layer copies from its textarea, so the
// marks wrap exactly like the text above them.
const MIRRORED_STYLES = [
  "boxSizing",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "textIndent",
  "textTransform",
  "tabSize",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderRightWidth",
] as const

/**
 * A textarea with the writing check's flags highlighted on the words
 * themselves while the checklist is open. The marks sit on a layer behind
 * the (transparent) textarea that mirrors its font, padding, and wrapping, and
 * they follow the student's edits; a flag disappears once its words change.
 */
export function HighlightedTextarea({
  writing,
  field: Field = Textarea,
  value,
  onScroll,
  className,
  ...props
}: Omit<React.ComponentProps<"textarea">, "value"> & {
  writing: WritingCheckState
  value: string
  /** The textarea component to render (e.g. InputGroupTextarea). */
  field?: React.ComponentType<React.ComponentProps<"textarea">>
}) {
  const areaRef = useRef<HTMLTextAreaElement | null>(null)
  const layerRef = useRef<HTMLDivElement | null>(null)
  const { setLocator } = writing

  // Mirror the textarea's text layout onto the layer, including the room a
  // scrollbar takes when the student has resized the box smaller than its text.
  const sync = useCallback(() => {
    const area = areaRef.current
    const layer = layerRef.current
    if (!area || !layer) return
    const style = getComputedStyle(area)
    for (const prop of MIRRORED_STYLES) layer.style[prop] = style[prop]
    layer.style.borderStyle = "solid"
    layer.style.borderColor = "transparent"
    const scrollbar =
      area.offsetWidth - area.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth)
    layer.style.paddingRight = `${parseFloat(style.paddingRight) + Math.max(0, scrollbar)}px`
    layer.scrollTop = area.scrollTop
  }, [])

  useLayoutEffect(() => {
    sync()
    const area = areaRef.current
    if (!area) return
    const observer = new ResizeObserver(sync)
    observer.observe(area)
    return () => observer.disconnect()
  }, [sync])

  useEffect(() => {
    sync()
  }, [value, writing.open, sync])

  useEffect(() => {
    setLocator((issue) => {
      const area = areaRef.current
      if (!area) return
      layerRef.current
        ?.querySelector<HTMLElement>(`[data-wc="${issue.index}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" })
      area.focus({ preventScroll: true })
      area.setSelectionRange(issue.end, issue.end)
    })
    return () => setLocator(null)
  }, [setLocator])

  const live = writing.live
  const marks =
    writing.open && live && live.text === value
      ? live.issues
          .filter((issue) => !issue.edited)
          .sort((a, b) => a.start - b.start)
          .filter((issue, i, all) => i === 0 || issue.start >= all[i - 1].end)
      : []

  const pieces: React.ReactNode[] = []
  let cursor = 0
  for (const issue of marks) {
    if (issue.start > cursor) pieces.push(value.slice(cursor, issue.start))
    pieces.push(
      <mark
        key={issue.index}
        data-wc={issue.index}
        className={cn("text-transparent", flagTint(blocksSubmission(issue.kind), writing.activeIndex === issue.index))}
      >
        {value.slice(issue.start, issue.end)}
      </mark>
    )
    cursor = issue.end
  }
  // A trailing newline needs a character after it to take up its line.
  pieces.push(value.slice(cursor) + "​")

  return (
    <div className="relative w-full">
      <div
        ref={layerRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden break-words whitespace-pre-wrap text-transparent"
      >
        {pieces}
      </div>
      <Field
        ref={areaRef}
        value={value}
        onScroll={(e) => {
          if (layerRef.current) layerRef.current.scrollTop = e.currentTarget.scrollTop
          onScroll?.(e)
        }}
        className={cn("relative", className)}
        {...props}
      />
    </div>
  )
}
