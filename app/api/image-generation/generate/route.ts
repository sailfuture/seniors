import { NextRequest, NextResponse } from "next/server"
import { experimental_generateImage as generateImage } from "ai"
import { getApiSession } from "@/lib/api-auth"
import { CATEGORIES, type ImageCategory } from "@/lib/image-generation-config"
import { createImage, uploadImageToXano } from "@/lib/image-library-xano"

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
  }

  const prompt = (body.prompt ?? "").trim()
  const category = body.category && CATEGORIES[body.category] ? body.category : "audience"
  const model = body.model?.trim() || CATEGORIES[category].defaultModel

  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 })
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
