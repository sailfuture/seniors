const BT_BRAND_ENDPOINT =
  process.env.XANO_BRAND_ENDPOINT ??
  process.env.NEXT_PUBLIC_XANO_BT_API_BASE
    ? `${(process.env.XANO_BRAND_ENDPOINT ?? process.env.NEXT_PUBLIC_XANO_BT_API_BASE)!.replace(/\/$/, "")}/businessthesis_brand_elements`
    : "https://xsc3-mvx7-r86m.n7e.xano.io/api:45yS7ICi/businessthesis_brand_elements"

interface XanoBrandElement {
  id: number
  students_id: string
  student_response?: string
  image_response?: Record<string, unknown> | null
  businessthesis_template_id: number
}

export interface StudentBrand {
  /** A formatted block of brand context ready to inject into an LLM prompt. */
  textBlock: string
  /** Whether the student has any brand content at all. */
  hasContent: boolean
  /** Whether any logo/image assets are attached (used by Level 2 logo-reference later). */
  hasLogo: boolean
}

const EMPTY_BRAND: StudentBrand = { textBlock: "", hasContent: false, hasLogo: false }

export async function fetchStudentBrand(studentId: string): Promise<StudentBrand> {
  if (!studentId) return EMPTY_BRAND
  try {
    const url = new URL(BT_BRAND_ENDPOINT)
    url.searchParams.set("students_id", studentId)
    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) return EMPTY_BRAND
    const items = (await res.json()) as XanoBrandElement[]
    if (!Array.isArray(items)) return EMPTY_BRAND

    const colors: string[] = []
    const fonts: string[] = []
    const moods: string[] = []
    const other: string[] = []
    let hasLogo = false

    for (const item of items) {
      if (item.image_response && Object.keys(item.image_response).length > 0) {
        hasLogo = true
      }
      const text = (item.student_response ?? "").trim()
      if (!text) continue

      const looksLikeColor = /#[0-9a-f]{3,8}/i.test(text) || /^name[:\s]/i.test(text)
      const looksLikeFont =
        text.length < 40 && !text.includes(" ") && !text.includes(":") && !text.includes("#")
      const looksLikeMood = text.length > 60

      if (looksLikeColor) colors.push(text)
      else if (looksLikeFont) fonts.push(text)
      else if (looksLikeMood) moods.push(text)
      else other.push(text)
    }

    const lines: string[] = []
    if (colors.length) lines.push(`Brand colors: ${colors.join("; ")}`)
    if (fonts.length) lines.push(`Typography: ${fonts.join(", ")}`)
    if (moods.length) lines.push(`Brand mood and voice: ${moods.join(" ")}`)
    if (other.length) lines.push(`Other brand notes: ${other.join("; ")}`)
    if (hasLogo) lines.push("(Student has uploaded a brand logo to their business thesis.)")

    const textBlock = lines.join("\n")
    return {
      textBlock,
      hasContent: textBlock.length > 0,
      hasLogo,
    }
  } catch {
    return EMPTY_BRAND
  }
}
