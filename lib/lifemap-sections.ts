const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

export const SECTIONS_ENDPOINT = `${XANO_BASE}/lifemap_sections`

export interface LifeMapSection {
  id: number
  section_title: string
  section_description?: string
  description?: string
  isLocked?: boolean
  order?: number
}

const KNOWN_SLUGS: Record<string, string> = {
  "Overview": "overview",
  "Selected Pathway": "pathway",
  "Personal Profile": "profile",
  "Career": "career",
  "Education": "education",
  "Housing": "housing",
  "Transportation": "transportation",
  "Finance": "finance",
  "Contact": "contact",
}

const KNOWN_TITLES: Record<string, string> = Object.fromEntries(
  Object.entries(KNOWN_SLUGS).map(([title, slug]) => [slug, title])
)

export function titleToSlug(title: string): string {
  if (KNOWN_SLUGS[title]) return KNOWN_SLUGS[title]
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export function slugToTitle(slug: string): string {
  return KNOWN_TITLES[slug] ?? slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

let sectionsCache: LifeMapSection[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 30_000

export function invalidateSectionsCache() {
  sectionsCache = null
  cacheTimestamp = 0
}

export async function fetchSections(): Promise<LifeMapSection[]> {
  if (sectionsCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return sectionsCache
  }

  const res = await fetch(SECTIONS_ENDPOINT)
  if (!res.ok) return sectionsCache ?? []

  const raw: LifeMapSection[] = await res.json()
  const data = raw.map((s) => ({
    ...s,
    section_description: s.section_description || s.description || "",
  }))
  sectionsCache = data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  cacheTimestamp = Date.now()
  return sectionsCache
}

export function findSectionBySlug(
  sections: LifeMapSection[],
  slug: string
): LifeMapSection | undefined {
  const knownTitle = KNOWN_TITLES[slug]
  if (knownTitle) {
    return sections.find((s) => s.section_title === knownTitle)
  }
  return sections.find((s) => titleToSlug(s.section_title) === slug)
}

export async function getSectionIdBySlug(slug: string): Promise<number | undefined> {
  const sections = await fetchSections()
  return findSectionBySlug(sections, slug)?.id
}
