import type { WritingIssue, WritingIssueKind } from "@/lib/writing-check"

/**
 * Server-side LanguageTool client for the writing check. With
 * LANGUAGETOOL_USERNAME and LANGUAGETOOL_API_KEY set it uses the paid API and
 * its premium rules; without them, the free public API, which is rate-limited
 * and requires the visible LanguageTool credit the checklist shows.
 */
const username = process.env.LANGUAGETOOL_USERNAME
const apiKey = process.env.LANGUAGETOOL_API_KEY
const CHECK_URL =
  username && apiKey
    ? "https://api.languagetoolplus.com/v2/check"
    : "https://api.languagetool.org/v2/check"

interface LanguageToolMatch {
  offset: number
  length: number
  replacements?: { value?: string }[]
  rule: { id: string; issueType?: string; category: { id: string } }
}

/** LanguageTool's rate limit was hit; worth retrying in a minute. */
export class LanguageToolBusyError extends Error {}

export async function checkWithLanguageTool(text: string): Promise<WritingIssue[]> {
  const body = new URLSearchParams({
    text,
    language: "en-US",
    // Adds the rules meant for formal writing (redundant phrases, missing
    // end punctuation) — the register senior projects are written in.
    level: "picky",
  })
  if (username && apiKey) {
    body.set("username", username)
    body.set("apiKey", apiKey)
  }
  const res = await fetch(CHECK_URL, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(20_000),
  })
  if (res.status === 429) throw new LanguageToolBusyError()
  if (!res.ok) throw new Error(`LanguageTool responded ${res.status}`)
  const data = (await res.json()) as { matches?: LanguageToolMatch[] }
  return issuesFromMatches(text, data.matches ?? [])
}

/**
 * LanguageTool matches → checklist issues. Keeps only the position and the
 * kind: LanguageTool's messages and replacements often spell out the fix, and
 * the student is meant to find it themselves.
 */
export function issuesFromMatches(text: string, matches: LanguageToolMatch[]): WritingIssue[] {
  const issues: WritingIssue[] = []
  const seen = new Set<string>()
  for (const m of matches) {
    let start = m.offset
    let end = m.offset + m.length
    if (!(start >= 0 && end > start && end <= text.length)) continue
    // Some matches start at the space before a word (" and"); highlight the word.
    while (start < end && /\s/.test(text[start])) start++
    while (end > start && /\s/.test(text[end - 1])) end--
    // A match across a line break reads a heading and the paragraph under it
    // as one sentence ("My Business / my business will…") — not a real error.
    if (start === end || text.slice(start, end).includes("\n")) continue

    const kind = kindOf(m, text.slice(start, end))
    if (!kind || seen.has(`${start}:${end}`)) continue
    seen.add(`${start}:${end}`)
    issues.push({ kind, start, end })
  }
  return issues.sort((a, b) => a.start - b.start || a.end - b.end)
}

const WORD_USAGE_CATEGORIES = new Set([
  "CONFUSED_WORDS",
  "SEMANTICS",
  "COLLOCATIONS",
  "NONSTANDARD_PHRASES",
  "COMPOUNDING",
])
const STYLE_CATEGORIES = new Set(["STYLE", "REDUNDANCY", "PLAIN_ENGLISH"])
// Words that are also real words without their apostrophe, where "its" vs
// "it's" is a genuine usage question rather than a typo.
const REAL_WITHOUT_APOSTROPHE = new Set([
  "its", "were", "well", "ill", "id", "lets", "cant", "wont", "hell", "shell", "wed", "shed",
])

/** "dont" → "don't", "Im" → "I'm": the only difference is the apostrophe. */
function missingApostrophe(flagged: string, fix: string | undefined): boolean {
  if (!fix || !/['’]/.test(fix) || /['’]/.test(flagged)) return false
  if (fix.replace(/['’]/g, "").toLowerCase() !== flagged.toLowerCase()) return false
  return !REAL_WITHOUT_APOSTROPHE.has(flagged.toLowerCase())
}

/** Sorts a match into one of the checklist's kinds, or null to leave it out. */
function kindOf(m: LanguageToolMatch, flagged: string): WritingIssueKind | null {
  const { id, issueType = "" } = m.rule
  const category = m.rule.category.id

  // Spacing around punctuation ("happy,we", "apples ,", "it.The") is sloppy
  // punctuation; other typographic niceties (curly quotes, dashes, double
  // spaces) aren't worth a student's time.
  if (/COMMA_PARENTHESIS_WHITESPACE|SENTENCE_WHITESPACE/.test(id)) return "punctuation"
  if (issueType === "whitespace" || category === "TYPOGRAPHY") return null
  // A contraction missing its apostrophe is a typo, whichever rule or premium
  // category LanguageTool files it under.
  if (missingApostrophe(flagged, m.replacements?.[0]?.value)) return "spelling"
  // Style and clarity suggestions (wordiness, long sentences, tone) are left
  // out: the check sticks to the basics.
  if (
    STYLE_CATEGORIES.has(category) ||
    category.includes("CLARITY") ||
    /LONG_SENTENCE/.test(id) ||
    issueType === "style" ||
    issueType === "register"
  ) {
    return null
  }

  // Rule ids name the grammar problem more precisely than the categories do
  // (an a/an rule sits under MISC, a lowercase "i" under TYPOS).
  if (category === "CASING" || /LOWERCASE|UPPERCASE|CAPITALI[SZ]/.test(id)) return "capitalization"
  if (/A_VS_AN|ARTICLE|DETERMINER/.test(id)) return "article"
  if (/AGREEMENT|NON3PRS|SUBJECT_VERB/.test(id)) return "subject_verb"
  if (/TENSE|PAST_PART|VERB_FORM|BASEFORM/.test(id)) return "verb_tense"
  if (/COMMA/.test(id)) return "comma"
  if (WORD_USAGE_CATEGORIES.has(category)) return "word_usage"

  if ((category === "TYPOS" || issueType === "misspelling") && !/\s/.test(flagged)) {
    // Words with inner capitals (SailFuture, LinkedIn) are names the
    // dictionary doesn't know, not misspellings.
    if (/[a-z][A-Z]/.test(flagged)) return null
    // "tampa" → "Tampa" is a capitalization slip, not a spelling one.
    const first = m.replacements?.[0]?.value
    if (first && first !== flagged && first.toLowerCase() === flagged.toLowerCase()) {
      return "capitalization"
    }
    return "spelling"
  }

  if (category === "PUNCTUATION" || issueType === "typographical") return "punctuation"
  // A doubled word ("the the") is a typo.
  if (issueType === "duplication") return "spelling"
  return "grammar"
}
