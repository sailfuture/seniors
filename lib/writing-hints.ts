import { generateText, Output } from "ai"
import { z } from "zod"
import type { LanguageToolFinding } from "@/lib/languagetool"
import { WRITING_ISSUES, excerptAround, type WritingIssue } from "@/lib/writing-check"

/**
 * Hints for LanguageTool's flags. A model words each flag as a pointer to the
 * rule involved in that sentence, which the student can act on without being
 * handed the fix. A flag whose hint can't be written, or gives the fix away,
 * keeps its kind's general message.
 */

/** The model behind the writing check's AI steps (hints here, and the
 *  proofreading pass in lib/writing-proofread.ts). */
export const WRITING_MODEL = "anthropic/claude-haiku-4.5"

// Flags per request, and requests per check: small batches run side by side
// so a long checklist doesn't wait on one long reply.
const BATCH_SIZE = 12
const MAX_BATCHES = 5
const HINT_MAX_CHARS = 220

/** What every hint must be, shared by both prompts that ask for one. */
export const HINT_RULES = `- One sentence of at most 25 words, in plain language, speaking to the student directly. A question is fine.
- Be specific to this sentence: name the rule or idea involved (the subject is plural, a city's name is a proper noun, two complete sentences are joined by only a comma, the action already happened).
- Never give the fix. Do not write the corrected word, spelling, punctuation mark, or sentence, and do not list options that include it.
- Do not quote the flagged words back; the student sees them highlighted.
- If you cannot write a hint without giving the fix, use an empty string.`

const SYSTEM = `You write hints for a writing checker used by high school seniors. A grammar tool has flagged places in a student's writing. For each flag, write one hint that tells the student what to look at and why, so they can work out the fix on their own.

Every hint must follow these rules:
${HINT_RULES}

The checker's note and suggested fix are shown to you only so you understand the problem; keep their wording out of the hint. If a flag looks like a false alarm, use an empty string for it.

The flagged words are marked [[like this]] inside their sentence.`

const hintsSchema = z.object({
  hints: z.array(z.object({ flag: z.number(), hint: z.string() })),
})

// Hints already written, by flag: checking again after fixing one item
// shouldn't re-ask (or re-word) the rest. Per server instance; oldest out.
const written = new Map<string, string>()
const WRITTEN_MAX = 2000

interface Pending {
  index: number
  key: string
  type: string
  sentence: string
  flagged: string
  finding: LanguageToolFinding
}

/** The check's issues, each with a hint where one could be written. Never throws. */
export async function withHints(text: string, findings: LanguageToolFinding[]): Promise<WritingIssue[]> {
  const issues = findings.map((f): WritingIssue => ({ ...f.issue }))
  const pending: Pending[] = []
  findings.forEach((finding, index) => {
    if (finding.typo) return
    const { start, end, kind } = finding.issue
    const { before, match, after } = excerptAround(text, start, end)
    const sentence = `${before}[[${match}]]${after}`
    const key = `${kind}\n${sentence}\n${finding.message}`
    const known = written.get(key)
    if (known !== undefined) {
      if (known) issues[index].hint = known
    } else if (pending.length < BATCH_SIZE * MAX_BATCHES) {
      pending.push({ index, key, type: WRITING_ISSUES[kind].label, sentence, flagged: match, finding })
    }
  })

  const batches: Pending[][] = []
  for (let i = 0; i < pending.length; i += BATCH_SIZE) batches.push(pending.slice(i, i + BATCH_SIZE))
  await Promise.all(
    batches.map(async (batch) => {
      try {
        for (const [flag, hint] of await writeHints(batch)) {
          const item = batch[flag]
          const safe = givesAway(hint, item.flagged, item.finding.replacements) ? "" : hint
          remember(item.key, safe)
          if (safe) issues[item.index].hint = safe
        }
      } catch (err) {
        // The checklist still works on the general messages.
        console.error("Writing check hints failed:", err)
      }
    })
  )
  return issues
}

/** One model request: batch position → hint ("" where the model declined). */
async function writeHints(batch: Pending[]): Promise<Map<number, string>> {
  const prompt = batch
    .map(({ type, sentence, finding }, i) =>
      [
        `Flag ${i + 1}`,
        `Type: ${type}`,
        `Sentence: ${sentence}`,
        `Checker's note: ${[finding.rule, finding.message].filter(Boolean).join(" — ")}`,
        `Checker's suggested fix: ${finding.replacements.slice(0, 3).map((r) => JSON.stringify(r)).join(" or ") || "none given"}`,
      ].join("\n")
    )
    .join("\n\n")

  const { output } = await generateText({
    model: WRITING_MODEL,
    system: SYSTEM,
    prompt,
    output: Output.object({ schema: hintsSchema }),
    temperature: 0,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(15_000),
  })

  const hints = new Map<number, string>()
  for (const { flag, hint } of output.hints) {
    const at = flag - 1
    if (!Number.isInteger(at) || at < 0 || at >= batch.length) continue
    hints.set(at, tidyHint(hint))
  }
  return hints
}

/** A model's hint as one clean line, or "" when it ran long. */
export function tidyHint(hint: string): string {
  const clean = hint.replace(/\s+/g, " ").trim()
  return clean.length <= HINT_MAX_CHARS ? clean : ""
}

function remember(key: string, hint: string) {
  if (written.size >= WRITTEN_MAX) written.delete(written.keys().next().value as string)
  written.set(key, hint)
}

const wordsIn = (s: string): string[] => s.replace(/’/g, "'").match(/[A-Za-z][A-Za-z']*/g) ?? []

// Too ordinary to keep out of a sentence. A hint only gives one of these away
// by quoting it.
const EVERYDAY = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "to", "of", "in", "on", "at", "it",
  "and", "or", "for", "do", "does", "has", "have", "not",
])

/**
 * True when a hint uses a word from LanguageTool's fix that the student didn't
 * write — the one thing the checklist must never show. The prompt asks for
 * this already; this is the guarantee.
 */
export function givesAway(hint: string, flagged: string, replacements: string[]): boolean {
  const student = wordsIn(flagged)
  const said = wordsIn(hint)
  for (const fix of replacements.slice(0, 3)) {
    for (const word of wordsIn(fix)) {
      if (student.includes(word)) continue
      const lower = word.toLowerCase()
      if (student.some((w) => w.toLowerCase() === lower)) {
        // Only the capitals differ ("tampa" → "Tampa"), so that exact form is
        // the fix — except an everyday word opening the hint ("The…"), which
        // is capitalized regardless.
        if (said.slice(EVERYDAY.has(lower) ? 1 : 0).includes(word)) return true
      } else if (EVERYDAY.has(lower)) {
        if (new RegExp(`["'“‘]${word}["'”’]`, "i").test(hint)) return true
      } else if (said.some((w) => w.toLowerCase() === lower)) {
        return true
      }
    }
  }
  return false
}
