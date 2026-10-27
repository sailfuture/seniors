import { markdownToPlainText } from "@/lib/markdown-text"
import type { SectionScoring } from "@/lib/rubric-scoring"

/**
 * The rubric: a high-level outline of a project built from its template.
 * Each section lists its key components (the groups) and, under each, the
 * key questions that need answering. Guidelines are condensed from what the
 * teacher wrote in the template, so the rubric stays a summary of the
 * requirements, not a copy of every instruction.
 */

/** What kind of work a question asks for; drives the requirement summary. */
export type RubricQuestionKind = "written" | "short" | "image" | "source" | "lineItems" | "other"

export interface RubricQuestion {
  id: number
  label: string
  kind: RubricQuestionKind
  typeName?: string | null
  minWords?: number | null
}

export interface RubricComponent {
  /** null for questions that sit directly in the section. */
  id: number | null
  name: string
  description?: string | null
  /** Short summary of the group's instructions. */
  guidelines?: string | null
  /** Questions a student answers; sources are summarised in `sources`. */
  questions: RubricQuestion[]
  /** How many source citations the component asks for. */
  sources: number
  /** What the component covers: distinct question topics, numbered repeats folded ("Prototype Image ×5"). */
  covers: string[]
  /** What must be produced, one short phrase each ("3 written responses, 500+ words"). */
  deliverables: string[]
}

export interface RubricSection {
  id: number
  title: string
  slug: string
  description?: string | null
  locked: boolean
  components: RubricComponent[]
  /** Derived requirements for the whole section, one short line each. */
  requirements: string[]
  /** The section's 1–4 scoring rubric, when one has been written for it. */
  scoring?: SectionScoring
}

export interface RubricSectionSource {
  id: number
  section_title: string
  isLocked?: boolean
}

export interface RubricGroupSource {
  id: number
  group_name: string
  group_description?: string | null
  instructions?: string | null
}

export interface RubricQuestionSource {
  id: number
  field_label: string
  field_name: string
  min_words?: number | null
  sortOrder?: number
}

/** Question type ids shared by both products (see the form pages). */
const TYPE = {
  LONG_RESPONSE: 1,
  SHORT_RESPONSE: 2,
  IMAGE_UPLOAD: 4,
  SOURCE: 12,
  LINE_ITEMS: 13,
  RICH_TEXT: 14,
} as const

export function questionKind(typeId: number | null | undefined, minWords?: number | null): RubricQuestionKind {
  switch (typeId) {
    case TYPE.LONG_RESPONSE:
    case TYPE.RICH_TEXT:
      return "written"
    case TYPE.SHORT_RESPONSE:
      return (minWords ?? 0) > 0 ? "written" : "short"
    case TYPE.IMAGE_UPLOAD:
      return "image"
    case TYPE.SOURCE:
      return "source"
    case TYPE.LINE_ITEMS:
      return "lineItems"
    default:
      return (minWords ?? 0) > 0 ? "written" : "other"
  }
}

/**
 * Condenses teacher-written Markdown to a short plain-text summary: the
 * first paragraph, cut at a sentence boundary near `max` characters.
 */
export function summarize(text: string | null | undefined, max = 220): string | null {
  const plain = markdownToPlainText(text)
  if (!plain) return null
  const firstParagraph = plain.split(/\n\s*\n/)[0].replace(/\s*\n\s*/g, " ").trim()
  if (firstParagraph.length <= max) return firstParagraph
  const cut = firstParagraph.slice(0, max)
  const sentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "))
  if (sentenceEnd > max * 0.4) return cut.slice(0, sentenceEnd + 1)
  const wordEnd = cut.lastIndexOf(" ")
  return `${cut.slice(0, wordEnd > 0 ? wordEnd : max).trimEnd()}…`
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * Distinct topics a set of questions covers. Numbered repeats ("Prototype
 * Image 1", "Prototype Image 2") fold into one entry with a count, so the
 * rubric reads as a summary rather than the template's full question list.
 */
export function coveredTopics(questions: RubricQuestion[], max = 8): string[] {
  const groups = new Map<string, { label: string; count: number }>()
  for (const q of questions) {
    // Drop numbering and single-letter variants anywhere in the label:
    // "Prototype Image 2 Description" and "Product B Name" fold together.
    const stripped = q.label
      .replace(/\s*(?:#|no\.?\s*)?\b(?:\d+|[A-Z])\b\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    const folded = stripped || q.label
    // A label written as a full sentence is shortened to its opening words.
    const base = folded.length > 48 ? `${folded.slice(0, 48).replace(/\s+\S*$/, "")}…` : folded
    const key = base.toLowerCase()
    const entry = groups.get(key)
    if (entry) entry.count += 1
    else groups.set(key, { label: base, count: 1 })
  }
  const items = [...groups.values()].map((g) => (g.count > 1 ? `${g.label} ×${g.count}` : g.label))
  if (items.length <= max) return items
  return [...items.slice(0, max), `${items.length - max} more`]
}

/** What a component must produce, one short phrase per kind of work. */
export function deriveDeliverables(questions: RubricQuestion[], sources: number): string[] {
  const written = questions.filter((q) => q.kind === "written")
  const words = written.reduce((n, q) => n + (q.minWords ?? 0), 0)
  const short = questions.filter((q) => q.kind === "short" || q.kind === "other").length
  const images = questions.filter((q) => q.kind === "image").length
  const tables = questions.filter((q) => q.kind === "lineItems").length
  const out: string[] = []
  if (written.length > 0) {
    out.push(words > 0 ? `${plural(written.length, "written response")}, ${words.toLocaleString()}+ words` : plural(written.length, "written response"))
  }
  if (short > 0) out.push(plural(short, "short answer"))
  if (tables > 0) out.push(plural(tables, "table of figures", "tables of figures"))
  if (images > 0) out.push(plural(images, "image"))
  if (sources > 0) out.push(plural(sources, "source to cite", "sources to cite"))
  return out
}

/** One short line per kind of work the section asks for. */
export function deriveRequirements(components: RubricComponent[]): string[] {
  const all = components.flatMap((c) => c.questions)
  const written = all.filter((q) => q.kind === "written")
  const words = written.reduce((n, q) => n + (q.minWords ?? 0), 0)
  const short = all.filter((q) => q.kind === "short" || q.kind === "other").length
  const images = all.filter((q) => q.kind === "image").length
  const tables = all.filter((q) => q.kind === "lineItems").length
  const sources = components.reduce((n, c) => n + c.sources, 0)

  const lines: string[] = []
  if (written.length > 0) {
    lines.push(
      words > 0
        ? `${plural(written.length, "written response")}, at least ${words.toLocaleString()} words in total`
        : plural(written.length, "written response")
    )
  }
  if (short > 0) lines.push(`${plural(short, "short answer or detail", "short answers or details")} to fill in`)
  if (tables > 0) lines.push(`${plural(tables, "table of figures")} to complete`)
  if (images > 0) lines.push(`${plural(images, "image")} to upload`)
  if (sources > 0) lines.push(`${plural(sources, "source")} to cite`)
  return lines
}

/**
 * Builds the rubric from the overview page's data: every section in order,
 * each group inside it with its questions, and an entry for questions that
 * sit directly in a section. Accessors isolate the Life Map and Business
 * Thesis column names.
 */
export function buildRubric<
  S extends RubricSectionSource,
  G extends RubricGroupSource,
  Q extends RubricQuestionSource,
>(
  rows: { section: S; groups: G[] }[],
  questions: Q[],
  accessors: {
    sectionId: (q: Q) => number
    groupId: (q: Q) => number | null
    typeId: (q: Q) => number | null | undefined
    sectionDescription: (s: S) => string | null | undefined
    typeName: (q: Q) => string | null | undefined
    slug: (title: string) => string
  }
): RubricSection[] {
  const toQuestion = (q: Q): RubricQuestion => ({
    id: q.id,
    label: q.field_label || q.field_name,
    kind: questionKind(accessors.typeId(q), q.min_words),
    typeName: accessors.typeName(q),
    minWords: q.min_words,
  })

  const toComponent = (id: number | null, name: string, description: string | null | undefined, instructions: string | null | undefined, qs: Q[]): RubricComponent => {
    const mapped = qs.map(toQuestion)
    const questions = mapped.filter((q) => q.kind !== "source")
    const sources = mapped.length - questions.length
    return {
      id,
      name,
      description,
      guidelines: summarize(instructions),
      questions,
      sources,
      covers: coveredTopics(questions),
      deliverables: deriveDeliverables(questions, sources),
    }
  }

  return rows.map(({ section, groups }) => {
    const sectionQs = questions
      .filter((q) => accessors.sectionId(q) === section.id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    const components: RubricComponent[] = groups.map((g) =>
      toComponent(
        g.id,
        g.group_name,
        g.group_description,
        g.instructions,
        sectionQs.filter((q) => accessors.groupId(q) === g.id)
      )
    )
    const ungrouped = sectionQs.filter((q) => !accessors.groupId(q))
    if (ungrouped.length > 0) {
      components.push(
        toComponent(null, groups.length > 0 ? "Also in this section" : section.section_title, null, null, ungrouped)
      )
    }
    return {
      id: section.id,
      title: section.section_title,
      slug: accessors.slug(section.section_title),
      description: accessors.sectionDescription(section),
      locked: section.isLocked ?? false,
      components,
      requirements: deriveRequirements(components),
    }
  })
}

export function rubricCounts(section: RubricSection): { components: number; questions: number; words: number } {
  const components = section.components.filter((c) => c.id !== null).length
  const questions = section.components.reduce((n, c) => n + c.questions.length + c.sources, 0)
  const words = section.components.reduce(
    (n, c) => n + c.questions.reduce((m, q) => m + (q.minWords ?? 0), 0),
    0
  )
  return { components, questions, words }
}

export function describeRubricSection(section: RubricSection): string {
  const { components, questions } = rubricCounts(section)
  const parts: string[] = []
  if (components > 0) parts.push(`${components} group${components === 1 ? "" : "s"}`)
  parts.push(`${questions} question${questions === 1 ? "" : "s"}`)
  return parts.join(" · ")
}
