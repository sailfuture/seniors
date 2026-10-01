/** The template question fields the public portfolio reads. */
export interface PortfolioQuestion {
  id: number
  field_label: string
  field_name: string
  sortOrder?: number
  question_types_id?: number | null
  _question_types?: { id: number; type: string; noInput?: boolean }
  public_display_title?: string
  public_display_description?: string
  image_aspect_ratio?: string
}

/** A student's answer, as the public portfolio reads it. */
export interface PortfolioResponse {
  id: number
  student_response: string
  date_response?: string | null
  image_response: { path?: string; url?: string; name?: string; mime?: string } | null
  isComplete?: boolean
  readyReview?: boolean
  revisionNeeded?: boolean
  source_link?: string
  title_of_source?: string
  author_name_or_publisher?: string
  date_of_publication?: string
  [key: string]: unknown
}

export type ResponseMap = Map<number, PortfolioResponse>

export const QUESTION_TYPE = {
  LONG_RESPONSE: 1,
  SHORT_RESPONSE: 2,
  CURRENCY: 3,
  IMAGE_UPLOAD: 4,
  DROPDOWN: 5,
  URL: 6,
  DATE: 7,
  SOURCE: 12,
} as const

export function typeOf(q: PortfolioQuestion): number | null {
  return q.question_types_id ?? q._question_types?.id ?? null
}

/** One-line answer types, laid out as facts rather than prose. */
export function isShortType(typeId: number | null): boolean {
  return (
    typeId === QUESTION_TYPE.SHORT_RESPONSE ||
    typeId === QUESTION_TYPE.CURRENCY ||
    typeId === QUESTION_TYPE.DROPDOWN ||
    typeId === QUESTION_TYPE.URL ||
    typeId === QUESTION_TYPE.DATE
  )
}

/** The template's layout width (1 full, 2 half, 3 third), wherever it's stored. */
export function widthOf(item: object): number | null {
  const w = (item as { width?: unknown }).width
  return typeof w === "number" && w > 0 ? w : null
}

export function resolveImageUrl(path: string | undefined): string {
  if (!path) return ""
  if (path.startsWith("http")) return path
  return `https://xsc3-mvx7-r86m.n7e.xano.io${path}`
}

/** A section: its hero, then answers not in a group, then its groups. */
export interface PortfolioSectionModel {
  id: number
  /** Element id, kept as `section-{id}` so existing links still land. */
  anchor: string
  number: number
  title: string
  description: string
  photoUrl: string | null
  ungrouped: PortfolioQuestion[]
  groups: PortfolioGroupModel[]
}

export interface PortfolioGroupModel {
  id: number
  name: string
  description: string
  displayTypeId: number | null
  iconName: string | null
  width: number | null
  questions: PortfolioQuestion[]
}
