import { NextRequest, NextResponse } from "next/server"
import { experimental_generateImage as generateImage } from "ai"
import { getApiSession } from "@/lib/api-auth"
import {
  CATEGORIES,
  MARKETING_PLACEMENTS,
  MAX_IMAGES_PER_STUDENT,
  type ImageCategory,
  type MarketingPlacement,
} from "@/lib/image-generation-config"
import { createImage, listImages, uploadImageToXano } from "@/lib/image-library-xano"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const user = await getApiSession(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const studentId = user.students_id ?? null
  if (!studentId) {
    return NextResponse.json({ error: "No student id on session" }, { status: 403 })
  }

  const body = (await req.json()) as {
    prompt?: string
    category?: ImageCategory
    model?: string
    placement?: MarketingPlacement
  }

  const rawPrompt = (body.prompt ?? "").trim()
  const category = body.category && CATEGORIES[body.category] ? body.category : "audience"
  const model = body.model?.trim() || CATEGORIES[category].defaultModel
  const placement =
    category === "marketing" && body.placement && MARKETING_PLACEMENTS[body.placement]
      ? MARKETING_PLACEMENTS[body.placement]
      : null

  if (!rawPrompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 })
  }

  // If the prompt doesn't already reference the placement (i.e. student skipped brainstorm),
  // prepend a short context line so the image is recognizably a marketing mock-up.
  const prompt =
    placement && !rawPrompt.toLowerCase().includes(placement.label.toLowerCase())
      ? `Photorealistic mock-up of ${placement.contextHint}. The ad shows: ${rawPrompt}`
      : rawPrompt

  try {
    const existing = await listImages(studentId)
    if (existing.length >= MAX_IMAGES_PER_STUDENT) {
      return NextResponse.json(
        {
          error: `You've reached the ${MAX_IMAGES_PER_STUDENT}-image limit for this class. Talk to your teacher if you need more.`,
          used: existing.length,
          limit: MAX_IMAGES_PER_STUDENT,
        },
        { status: 429 },
      )
    }
  } catch {
    // If the quota check fails, fall through and let the generation attempt run.
    // Better to occasionally over-allow than to block legitimate use on a Xano hiccup.
  }

  let imageBytes: Uint8Array
  let mediaType: string
  try {
    const { image } = await generateImage({ model, prompt })
    imageBytes = image.uint8Array
    mediaType = image.mediaType ?? "image/png"
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const ext = mediaType.split("/")[1]?.split("+")[0] ?? "png"
  const filename = `${category}-${Date.now()}-${crypto.randomUUID()}.${ext}`

  let fileMetadata
  try {
    fileMetadata = await uploadImageToXano(imageBytes, mediaType, filename)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Xano upload failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }

  try {
    const record = await createImage({
      students_id: studentId,
      category,
      model,
      prompt,
      image: fileMetadata,
    })
    return NextResponse.json(record)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Xano write failed"
    return NextResponse.json(
      {
        warning: message,
        students_id: studentId,
        category,
        model,
        prompt,
        image: fileMetadata,
      },
      { status: 207 },
    )
  }
}
