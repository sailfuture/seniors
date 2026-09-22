import { BUSINESSTHESIS_API_CONFIG, LIFEMAP_API_CONFIG } from "@/lib/form-api-config"

/**
 * A product's setup data (sections, questions, groups, question types),
 * served from Vercel's cache so page loads don't wait on Xano for it. The
 * cached copy is rebuilt in the background at most once a minute, and right
 * away when a teacher edits a template (see ../revalidate/route.ts).
 */
export const revalidate = 60

const SOURCES: Record<string, string> = {
  lifemap: LIFEMAP_API_CONFIG.configEndpoint,
  businessthesis: BUSINESSTHESIS_API_CONFIG.configEndpoint,
}

// Nothing is built at deploy time — each product is built on its first
// request — so a Xano hiccup can never fail a build.
export function generateStaticParams() {
  return []
}

export async function GET(_req: Request, { params }: { params: Promise<{ product: string }> }) {
  const { product } = await params
  const source = SOURCES[product]
  if (!source) return new Response("Not found", { status: 404 })

  const res = await fetch(source)
  // Throw rather than return an error response: a failed rebuild then keeps
  // serving the last good copy instead of caching the failure.
  if (!res.ok) throw new Error(`Xano ${product} config returned ${res.status}`)
  return new Response(await res.text(), {
    headers: { "Content-Type": "application/json" },
  })
}
