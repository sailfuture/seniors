import { blocksSubmission, type WritingIssue } from "@/lib/writing-check"
import { checkWithLanguageTool, type LanguageToolFinding } from "@/lib/languagetool"
import { withHints } from "@/lib/writing-hints"
import { proofread } from "@/lib/writing-proofread"

const overlaps = (a: WritingIssue, b: WritingIssue) => a.start < b.end && b.start < a.end

/**
 * One writing check, server-side: two passes over the same text, started
 * together — LanguageTool, and a model proofreading for what LanguageTool's
 * rules miss — merged into one list in reading order. Throws LanguageTool's
 * error only when neither pass could run.
 *
 * A LanguageTool flag that is advice on its own (grammar, or a capitalized
 * word it can't spell) becomes a must-fix when the proofreader has a must-fix
 * flag on the same words: the two passes agreeing is what makes it certain.
 *
 * `gate`: a submit-time check. A submission that goes through never opens the
 * checklist, so it only waits for LanguageTool's hints when something will
 * hold it back.
 */
export async function runWritingCheck(text: string, { gate = false } = {}): Promise<WritingIssue[]> {
  const proofreading = proofread(text)
  let findings: LanguageToolFinding[]
  try {
    findings = await checkWithLanguageTool(text)
  } catch (err) {
    // The proofreading pass alone still makes a usable check.
    const issues = await proofreading
    if (!issues) throw err
    console.error("Writing check ran without LanguageTool:", err)
    return issues
  }

  const found = findings.map((f) => f.issue)
  const early = !gate || found.some(blocksSubmission)
  const hinted = early ? withHints(text, findings) : null
  const proofed = (await proofreading) ?? []
  const agreed = (issue: WritingIssue): WritingIssue =>
    !blocksSubmission(issue) && proofed.some((p) => blocksSubmission(p) && overlaps(p, issue))
      ? { ...issue, mustFix: true }
      : issue
  // Where both passes flag the same words, LanguageTool's flag stands.
  const extra = proofed.filter((p) => !found.some((f) => overlaps(p, f)))
  const shown = early || extra.some(blocksSubmission) || found.map(agreed).some(blocksSubmission)
  const issues = [...(shown ? await (hinted ?? withHints(text, findings)) : found).map(agreed), ...extra]
  return issues.sort((a, b) => a.start - b.start || a.end - b.end)
}
