/**
 * The writing check's checklist: the kinds of problem it reports, grouped the
 * way the student's sheet shows them. LanguageTool finds each problem and
 * lib/languagetool.ts sorts it into one of these kinds. Every sentence the
 * student reads comes from here — never LanguageTool's suggested replacement —
 * so the student makes each fix themselves.
 */
export const WRITING_ISSUES = {
  spelling: {
    category: "Spelling",
    label: "Possible misspelling",
    message: "Check the spelling of the highlighted word.",
  },
  subject_verb: {
    category: "Grammar",
    label: "Subject/verb agreement",
    message: "Check that the subject and verb agree in this sentence.",
  },
  verb_tense: {
    category: "Grammar",
    label: "Verb tense",
    message: "Review the verb tense in this sentence.",
  },
  article: {
    category: "Grammar",
    label: "Article usage",
    message: "Check whether a, an, or the belongs here.",
  },
  grammar: {
    category: "Grammar",
    label: "Grammar",
    message: "Review the grammar in this sentence.",
  },
  comma: {
    category: "Punctuation",
    label: "Comma placement",
    message: "Review comma placement in this sentence.",
  },
  punctuation: {
    category: "Punctuation",
    label: "Punctuation",
    message: "Review the punctuation in this sentence.",
  },
  capitalization: {
    category: "Capitalization",
    label: "Capitalization",
    message: "Check capitalization here.",
  },
  word_usage: {
    category: "Word usage",
    label: "Word usage",
    message: "Check whether this is the correct form of the word.",
  },
  hard_to_read: {
    category: "Clarity",
    label: "Hard to read",
    message: "This sentence may be difficult to read. Revise it for clarity.",
  },
  wordy: {
    category: "Style",
    label: "Wordy phrase",
    message: "Review this phrase for unnecessary or overly complex wording.",
  },
} as const

export type WritingIssueKind = keyof typeof WRITING_ISSUES

/** Sheet order, top to bottom. */
export const WRITING_CATEGORIES = [
  "Spelling",
  "Grammar",
  "Punctuation",
  "Capitalization",
  "Word usage",
  "Clarity",
  "Style",
] as const

/** One flagged passage: [start, end) character offsets into the checked text. */
export interface WritingIssue {
  kind: WritingIssueKind
  start: number
  end: number
}

/** Longest text one check accepts (roughly 5,000 words). */
export const WRITING_CHECK_MAX_CHARS = 30_000

/** Spelling and grammar must be fixed (or marked correct) before submitting;
 *  everything else on the checklist is advice. */
export function blocksSubmission(kind: WritingIssueKind): boolean {
  const category = WRITING_ISSUES[kind].category
  return category === "Spelling" || category === "Grammar"
}

/**
 * Identifies a flag across checks, so "It's correct" survives edits elsewhere
 * in the text: a spelling flag by its word (a name is fine wherever it
 * appears), any other flag by its sentence (rewording the sentence re-raises it).
 */
export function flagKey(text: string, issue: WritingIssue): string {
  const { before, match, after } = excerptAround(text, issue.start, issue.end)
  if (issue.kind === "spelling") return `spelling|${match}`
  return `${issue.kind}|${(before + match + after).replace(/\s+/g, " ").trim()}`
}

const EXCERPT_REACH = 80
// A sentence ends at . ! or ? (plus any closing quote or bracket) — or a line break.
const SENTENCE_BREAK = /[.!?]["'”’)\]]*(?=\s|$)|\n/g
// ...except a period after one of these ("Mr. Okonkwo", "e.g. this").
const ABBREVIATION = /\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e)$/i

function endsSentence(text: string, at: number, mark: string): boolean {
  return mark === "\n" || !(mark[0] === "." && ABBREVIATION.test(text.slice(Math.max(0, at - 8), at)))
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
