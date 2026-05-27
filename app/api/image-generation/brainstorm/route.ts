import { NextRequest } from "next/server"
import { streamText } from "ai"
import { getApiSession } from "@/lib/api-auth"
import { BRAINSTORM_MODEL, CATEGORIES, type ImageCategory } from "@/lib/image-generation-config"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const user = await getApiSession(req)
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const body = (await req.json()) as { idea?: string; category?: ImageCategory }
  const idea = (body.idea ?? "").trim()
  const category = body.category && CATEGORIES[body.category] ? body.category : "audience"

  if (!idea) {
    return new Response("Missing idea", { status: 400 })
  }

  const result = streamText({
    model: BRAINSTORM_MODEL,
    system: CATEGORIES[category].brainstormSystemPrompt,
    prompt: `Student's rough idea:\n\n${idea}`,
  })

  return result.toTextStreamResponse()
}
