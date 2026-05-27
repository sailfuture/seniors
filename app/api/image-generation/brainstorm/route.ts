import { NextRequest } from "next/server"
import { streamText } from "ai"
import { getApiSession } from "@/lib/api-auth"
import {
  BRAINSTORM_MODEL,
  CATEGORIES,
  MARKETING_PLACEMENTS,
  type ImageCategory,
  type MarketingPlacement,
} from "@/lib/image-generation-config"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const user = await getApiSession(req)
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const body = (await req.json()) as {
    idea?: string
    category?: ImageCategory
    placement?: MarketingPlacement
  }
  const idea = (body.idea ?? "").trim()
  const category = body.category && CATEGORIES[body.category] ? body.category : "audience"
  const placement =
    category === "marketing" && body.placement && MARKETING_PLACEMENTS[body.placement]
      ? MARKETING_PLACEMENTS[body.placement]
      : null

  if (!idea) {
    return new Response("Missing idea", { status: 400 })
  }

  const userPrompt = placement
    ? `Placement: ${placement.label} — ${placement.contextHint}.\n\nStudent's rough idea for what should be on the ad:\n\n${idea}`
    : `Student's rough idea:\n\n${idea}`

  const result = streamText({
    model: BRAINSTORM_MODEL,
    system: CATEGORIES[category].brainstormSystemPrompt,
    prompt: userPrompt,
  })

  return result.toTextStreamResponse()
}
