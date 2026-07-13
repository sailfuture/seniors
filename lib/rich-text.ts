// Rich Text question type (question_types id 14): a long-form essay edited
// in a dedicated full-page TipTap editor. The document is stored as TipTap
// JSON in the response's student_response string, so autosave, the review
// flow (ready / revision / complete), and comments all apply unchanged.
//
// Everything that treats student_response as prose (word counts, the
// GPTZero/plagiarism check, comment previews) must go through
// extractPlainText() rather than reading the raw value.

export const RICH_TEXT_TYPE_ID = 14
export const RICH_TEXT_TYPE_NAME = "Rich Text"

export interface RichTextNode {
  type?: string
  text?: string
  content?: RichTextNode[]
  [key: string]: unknown
}

export interface RichTextDoc {
  type: "doc"
  content?: RichTextNode[]
}

export function isRichTextQuestion(q: {
  question_types_id?: number | null
  _question_types?: { id?: number; type?: string } | null
}): boolean {
  const typeId = q.question_types_id ?? q._question_types?.id ?? null
  return typeId === RICH_TEXT_TYPE_ID || q._question_types?.type === RICH_TEXT_TYPE_NAME
}

export function looksLikeRichTextDoc(raw: string | null | undefined): boolean {
  if (!raw) return false
  const trimmed = raw.trim()
  if (!trimmed.startsWith("{")) return false
  try {
    const data = JSON.parse(trimmed)
    return data?.type === "doc"
  } catch {
    return false
  }
}

/**
 * Parse a stored response into a TipTap document. Legacy plain-text answers
 * (from before a question became rich text) are wrapped into paragraphs so
 * nothing breaks when a question's type changes; empty input returns null so
 * callers can hand TipTap its own default empty document.
 */
export function parseRichText(raw: string | null | undefined): RichTextDoc | null {
  if (!raw || !raw.trim()) return null
  const trimmed = raw.trim()
  if (trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed)
      if (data?.type === "doc") return data as RichTextDoc
    } catch {
      // fall through to plain-text wrapping
    }
  }
  return {
    type: "doc",
    content: raw
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({
        type: "paragraph",
        // Single newlines become hardBreaks so line structure survives the
        // conversion; extractPlainTextFromNodes emits "\n" for hardBreak, so
        // word counts and previews stay consistent
        content: p
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .flatMap((line, i): RichTextNode[] =>
            i === 0
              ? [{ type: "text", text: line }]
              : [{ type: "hardBreak" }, { type: "text", text: line }]
          ),
      })),
  }
}

function isDocEmpty(doc: RichTextDoc | null): boolean {
  if (!doc?.content || doc.content.length === 0) return true
  // Only text-free paragraphs count as empty; any other top-level node
  // (horizontal rule, list, quote) is visible structure worth keeping.
  return doc.content.every(
    (n) => n.type === "paragraph" && extractPlainTextFromNodes(n.content ?? []).trim() === ""
  )
}

/**
 * Serialize an editor document for storage. An empty document serializes to
 * "" (never `{"type":"doc","content":[{"type":"paragraph"}]}`) so completion
 * checks, review eligibility, and the public pages' has-content gates keep
 * treating untouched essays as unanswered — same rule as line items.
 */
export function serializeRichText(doc: RichTextDoc | null): string {
  if (!doc || isDocEmpty(doc)) return ""
  return JSON.stringify(doc)
}

const BLOCK_NODE_TYPES = new Set(["paragraph", "heading", "listItem", "blockquote", "codeBlock"])

function extractPlainTextFromNodes(nodes: RichTextNode[]): string {
  const parts: string[] = []
  for (const node of nodes) {
    if (typeof node.text === "string") {
      // Sibling text nodes concatenate directly — a mark mid-word (e.g. a
      // bolded syllable) splits one word across nodes and must not add space
      parts.push(node.text)
    } else if (Array.isArray(node.content)) {
      parts.push(extractPlainTextFromNodes(node.content))
    }
    if (node.type === "hardBreak" || (node.type && BLOCK_NODE_TYPES.has(node.type))) {
      parts.push("\n")
    }
  }
  return parts.join("")
}

/**
 * Plain-text projection of a stored value, for word counts, the AI/plagiarism
 * check, and comment previews. Legacy plain-text values pass through as-is.
 */
export function extractPlainText(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return ""
  if (!looksLikeRichTextDoc(raw)) return raw
  const doc = parseRichText(raw)
  if (!doc?.content) return ""
  return extractPlainTextFromNodes(doc.content).replace(/\s+/g, " ").trim()
}

export function richTextWordCount(raw: string | null | undefined): number {
  const text = extractPlainText(raw)
  return text ? text.split(/\s+/).filter(Boolean).length : 0
}
