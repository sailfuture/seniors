import { markdownToPlainText } from "@/lib/markdown-text"

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
  /** One-line summary of what the answer must do, from the question's instructions. */
  requirement?: string | null
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
  detailed_instructions?: string | null
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

/** One short line per kind of work the section asks for. */
export function deriveRequirements(components: RubricComponent[]): string[] {
  const all = components.flatMap((c) => c.questions)
  const written = all.filter((q) => q.kind === "written")
  const words = written.reduce((n, q) => n + (q.minWords ?? 0), 0)
  const short = all.filter((q) => q.kind === "short" || q.kind === "other").length
  const images = all.filter((q) => q.kind === "image").length
  const tables = all.filter((q) => q.kind === "lineItems").length
  const sources = components.reduce((n, c) => n + c.sources, 0)
  const groups = components.filter((c) => c.id !== null).length

  const lines: string[] = []
  if (written.length > 0) {
    lines.push(
      words > 0
        ? `${plural(written.length, "written response")}, at least ${words.toLocaleString()} words in total`
        : plural(written.length, "written response")
    )
  }
  if (short > 0) lines.push(`${plural(short, "short answer or detail")} to fill in`)
  if (tables > 0) lines.push(`${plural(tables, "table of figures")} to complete`)
  if (images > 0) lines.push(`${plural(images, "image")} to upload`)
  if (sources > 0) lines.push(`${plural(sources, "source")} to cite`)
  if (groups > 1) {
    lines.push(`Complete when all ${groups} components are approved by a teacher`)
  } else if (all.length > 0) {
    lines.push("Complete when every question is approved by a teacher")
  }
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
    requirement: summarize(q.detailed_instructions, 170),
  })

  const toComponent = (id: number | null, name: string, description: string | null | undefined, instructions: string | null | undefined, qs: Q[]): RubricComponent => {
    const mapped = qs.map(toQuestion)
    return {
      id,
      name,
      description,
      guidelines: summarize(instructions),
      questions: mapped.filter((q) => q.kind !== "source"),
      sources: mapped.filter((q) => q.kind === "source").length,
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
  if (components > 0) parts.push(`${components} component${components === 1 ? "" : "s"}`)
  parts.push(`${questions} question${questions === 1 ? "" : "s"}`)
  return parts.join(" · ")
}
