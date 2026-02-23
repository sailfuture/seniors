const BUSINESSTHESIS_BASE =
  process.env.NEXT_PUBLIC_XANO_BT_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:45yS7ICi"

export const BT_SECTIONS_ENDPOINT = `${BUSINESSTHESIS_BASE}/businessthesis_sections`

export interface BusinessThesisSection {
  id: number
  section_title: string
  description?: string
  isLocked?: boolean
  order?: number
  photo?: { path: string; name: string; type: string; size: number; mime: string; meta?: Record<string, unknown> } | null
}

export function btTitleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export function btSlugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => {
      if (w === "and") return "&"
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(" ")
}

let btSectionsCache: BusinessThesisSection[] | null = null
let btCacheTimestamp = 0
const BT_CACHE_TTL = 30_000

export function invalidateBtSectionsCache() {
  btSectionsCache = null
  btCacheTimestamp = 0
}

export async function fetchBtSections(): Promise<BusinessThesisSection[]> {
  if (btSectionsCache && Date.now() - btCacheTimestamp < BT_CACHE_TTL) {
    return btSectionsCache
  }

  const res = await fetch(BT_SECTIONS_ENDPOINT)
  if (!res.ok) return btSectionsCache ?? []

  const data: BusinessThesisSection[] = await res.json()
  btSectionsCache = data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  btCacheTimestamp = Date.now()
  return btSectionsCache
}

export function findBtSectionBySlug(
  sections: BusinessThesisSection[],
  slug: string
): BusinessThesisSection | undefined {
  return sections.find((s) => btTitleToSlug(s.section_title) === slug)
}

export async function getBtSectionIdBySlug(slug: string): Promise<number | undefined> {
  const sections = await fetchBtSections()
  return findBtSectionBySlug(sections, slug)?.id
}
