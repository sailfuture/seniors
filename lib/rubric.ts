/**
 * The rubric: a high-level outline of a project built from its template.
 * Each section lists its key components (the groups) and, under each, the
 * key questions that need answering. No instructions or guidelines — those
 * live on the question itself — just what the finished section must cover.
 */

export interface RubricQuestion {
  id: number
  label: string
  typeName?: string | null
  minWords?: number | null
}

export interface RubricComponent {
  /** null for questions that sit directly in the section. */
  id: number | null
  name: string
  description?: string | null
  questions: RubricQuestion[]
}

export interface RubricSection {
  id: number
  title: string
  slug: string
  description?: string | null
  locked: boolean
  components: RubricComponent[]
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
}

export interface RubricQuestionSource {
  id: number
  field_label: string
  field_name: string
  min_words?: number | null
  sortOrder?: number
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
    sectionDescription: (s: S) => string | null | undefined
    typeName: (q: Q) => string | null | undefined
    slug: (title: string) => string
  }
): RubricSection[] {
  const toQuestion = (q: Q): RubricQuestion => ({
    id: q.id,
    label: q.field_label || q.field_name,
    typeName: accessors.typeName(q),
    minWords: q.min_words,
  })

  return rows.map(({ section, groups }) => {
    const sectionQs = questions
      .filter((q) => accessors.sectionId(q) === section.id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    const components: RubricComponent[] = groups.map((g) => ({
      id: g.id,
      name: g.group_name,
      description: g.group_description,
      questions: sectionQs.filter((q) => accessors.groupId(q) === g.id).map(toQuestion),
    }))
    const ungrouped = sectionQs.filter((q) => !accessors.groupId(q))
    if (ungrouped.length > 0) {
      components.push({
        id: null,
        name: groups.length > 0 ? "Also in this section" : section.section_title,
        questions: ungrouped.map(toQuestion),
      })
    }
    return {
      id: section.id,
      title: section.section_title,
      slug: accessors.slug(section.section_title),
      description: accessors.sectionDescription(section),
      locked: section.isLocked ?? false,
      components,
    }
  })
}

export function rubricCounts(section: RubricSection): { components: number; questions: number; words: number } {
  const components = section.components.filter((c) => c.id !== null).length
  const questions = section.components.reduce((n, c) => n + c.questions.length, 0)
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
