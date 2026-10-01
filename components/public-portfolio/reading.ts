import { richTextWordCount } from "@/lib/rich-text"
import {
  QUESTION_TYPE,
  isShortType,
  typeOf,
  type PortfolioGroupModel,
  type PortfolioQuestion,
  type ResponseMap,
} from "./types"

/**
 * A group whose approved writing runs at least this long is laid out for
 * reading — a rail beside text in columns — instead of packed into a slide
 * column by its template width.
 */
export const READING_WORDS = 150

/** Whether an answer is a passage of writing (not an image, fact, or source). */
export function isProseQuestion(q: PortfolioQuestion): boolean {
  const typeId = typeOf(q)
  return typeId !== QUESTION_TYPE.IMAGE_UPLOAD && typeId !== QUESTION_TYPE.SOURCE && !isShortType(typeId)
}

/** Words in an approved passage; unapproved and non-prose answers count as none. */
export function approvedWords(q: PortfolioQuestion, responseMap: ResponseMap): number {
  const r = responseMap.get(q.id)
  if (!r?.isComplete || !isProseQuestion(q)) return 0
  return richTextWordCount(r.student_response ?? "")
}

export function isReadingSet(questions: PortfolioQuestion[], responseMap: ResponseMap): boolean {
  return questions.some((q) => approvedWords(q, responseMap) >= READING_WORDS)
}

export function isReadingGroup(group: PortfolioGroupModel, responseMap: ResponseMap): boolean {
  return group.displayTypeId == null && isReadingSet(group.questions, responseMap)
}

/** A group's questions by where a reading row puts them: the rail (images,
    facts) beside the passages, with sources kept for the slide's footer. */
export function splitReading(questions: PortfolioQuestion[]): {
  rail: PortfolioQuestion[]
  prose: PortfolioQuestion[]
} {
  const rail: PortfolioQuestion[] = []
  const prose: PortfolioQuestion[] = []
  for (const q of questions) {
    if (typeOf(q) === QUESTION_TYPE.SOURCE) continue
    ;(isProseQuestion(q) ? prose : rail).push(q)
  }
  return { rail, prose }
}

/**
 * Sibling groups share the name before a colon, dropping a plural
 * ("Messaging Locations: Out of Home" and "Messaging Location: Social
 * Media" are one family), so they can stack on one slide.
 */
export function familyOf(name: string): string {
  return name.split(":")[0].trim().toLowerCase().replace(/s$/, "")
}
