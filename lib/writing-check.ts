/**
 * The writing check's checklist: the kinds of problem it reports, grouped the
 * way the student's sheet shows them. LanguageTool finds each problem and
 * lib/languagetool.ts sorts it into one of these kinds; a model's proofreading
 * pass (lib/writing-proofread.ts) adds what LanguageTool misses. What the
 * student reads about a flag is either the kind's message here or a hint
 * written for that flag (lib/writing-hints.ts) — never a suggested
 * replacement — so the student makes each fix themselves.
 *
 * `blocks`: the kind must be fixed before submitting. Sloppy mechanics block —
 * typos, capitals, basic punctuation. Grammar, word usage, and comma placement
 * are advice, except a grammar mistake the proofreading pass calls obvious
 * (`mustFix` on the flag). Style and clarity aren't checked.
 */
export const WRITING_ISSUES = {
  spelling: {
    category: "Spelling",
    label: "Possible misspelling",
    message: "Check the spelling of the highlighted word.",
    blocks: true,
  },
  capitalization: {
    category: "Capitalization",
    label: "Capitalization",
    message: "Check capitalization here.",
    blocks: true,
  },
  punctuation: {
    category: "Punctuation",
    label: "Punctuation",
    message: "Review the punctuation in this sentence.",
    blocks: true,
  },
  comma: {
    category: "Punctuation",
    label: "Comma placement",
    message: "Review comma placement in this sentence.",
    blocks: false,
  },
  subject_verb: {
    category: "Grammar",
    label: "Subject/verb agreement",
    message: "Check that the subject and verb agree in this sentence.",
    blocks: false,
  },
  verb_tense: {
    category: "Grammar",
    label: "Verb tense",
    message: "Review the verb tense in this sentence.",
    blocks: false,
  },
  article: {
    category: "Grammar",
    label: "Article usage",
    message: "Check whether a, an, or the belongs here.",
    blocks: false,
  },
  grammar: {
    category: "Grammar",
    label: "Grammar",
    message: "Review the grammar in this sentence.",
    blocks: false,
  },
  word_usage: {
    category: "Word usage",
    label: "Word usage",
    message: "Check whether this is the correct form of the word.",
    blocks: false,
  },
} as const

export type WritingIssueKind = keyof typeof WRITING_ISSUES

/** Sheet order, top to bottom: what blocks submitting comes first. */
export const WRITING_CATEGORIES = [
  "Spelling",
  "Capitalization",
  "Punctuation",
  "Grammar",
  "Word usage",
] as const

/** What the blocking kinds are called in student-facing messages. */
export const MUST_FIX_LABEL = "spelling, capitalization, punctuation, and basic grammar"

/** One flagged passage: [start, end) character offsets into the checked text. */
export interface WritingIssue {
  kind: WritingIssueKind
  start: number
  end: number
  /** What to look at in this particular sentence, shown in place of the
   *  kind's general message. Never the fix. */
  hint?: string
  /** Overrides the kind's `blocks` for this flag: true for an obvious grammar
   *  mistake, false for a spelling flag that is probably a name. */
  mustFix?: boolean
}

/** Longest text one check accepts (roughly 5,000 words). */
export const WRITING_CHECK_MAX_CHARS = 30_000

/** Whether a flag holds a submission back. A must-fix flag can't be waived,
 *  so only flags the check is sure of should get here. */
export function blocksSubmission(issue: Pick<WritingIssue, "kind" | "mustFix">): boolean {
  return issue.mustFix ?? WRITING_ISSUES[issue.kind].blocks
}

/** The grammar kinds: advice, unless the proofreading pass calls one obvious. */
export const GRAMMAR_KINDS: ReadonlySet<WritingIssueKind> = new Set([
  "subject_verb",
  "verb_tense",
  "article",
  "grammar",
  "word_usage",
])

const EXCERPT_REACH = 80
// A sentence ends at . ! or ? (plus any closing quote or bracket) — or a line break.
const SENTENCE_BREAK = /[.!?]["'”’)\]]*(?=\s|$)|\n/g
// ...except a period after one of these ("Mr. Okonkwo", "e.g. this").
const ABBREVIATION = /\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e)$/i

function endsSentence(text: string, at: number, mark: string): boolean {
  if (mark === "\n") return true
  // Judged against the whole text, not the excerpt window: "year.i" is two
  // sentences run together — show them together.
  const next = text[at + mark.length]
  if (next !== undefined && !/\s/.test(next)) return false
  return !(mark[0] === "." && ABBREVIATION.test(text.slice(Math.max(0, at - 8), at)))
}

/**
 * The flagged words with the rest of their sentence around them, for the
 * checklist. Cuts at sentence ends and line breaks; a cut mid-sentence (a very
 * long sentence) is marked with an ellipsis.
 */
export function excerptAround(
  text: string,
  start: number,
  end: number
): { before: string; match: string; after: string } {
  const match = text.slice(start, end)

  const from = Math.max(0, start - EXCERPT_REACH)
  let before = text.slice(from, start)
  let leadingCut = from > 0
  let sentenceStart = -1
  for (const m of before.matchAll(SENTENCE_BREAK)) {
    const at = m.index ?? 0
    if (endsSentence(text, from + at, m[0])) sentenceStart = at + m[0].length
  }
  if (sentenceStart >= 0) {
    before = before.slice(sentenceStart)
    leadingCut = false
  } else if (leadingCut) {
    before = before.replace(/^\S*\s/, "") // drop the partial first word
  }

  const to = Math.min(text.length, end + EXCERPT_REACH)
  let after = text.slice(end, to)
  let trailingCut = to < text.length
  const matchBreak = [...match.matchAll(SENTENCE_BREAK)].pop()
  if (matchBreak && (matchBreak.index ?? 0) + matchBreak[0].length === match.length && endsSentence(text, start + (matchBreak.index ?? 0), matchBreak[0])) {
    // The flagged words already end the sentence.
    after = ""
    trailingCut = false
  } else {
    for (const m of after.matchAll(SENTENCE_BREAK)) {
      const at = m.index ?? 0
      if (!endsSentence(text, end + at, m[0])) continue
      after = after.slice(0, at + (m[0] === "\n" ? 0 : m[0].length))
      trailingCut = false
      break
    }
    if (trailingCut) after = after.replace(/\s\S*$/, "") // drop the partial last word
  }

  return {
    before: (leadingCut ? "…" : "") + before.trimStart(),
    match,
    after: after.trimEnd() + (trailingCut ? "…" : ""),
  }
}
