/**
 * Image-with-reference generation through Vercel AI Gateway.
 *
 * The AI SDK's `experimental_generateImage` is text-to-image only and targets
 * image-only models (gpt-image-2, imagen-*). To pass a reference image (e.g.
 * a brand logo) we use `generateText()` with a multimodal model that accepts
 * image input and returns image output in `result.files`.
 *
 * Auth is handled by @ai-sdk/gateway automatically (AI_GATEWAY_API_KEY > VERCEL_OIDC_TOKEN).
 */

import { generateText } from "ai"

/** Multimodal model that accepts image input and produces image output. */
export const LOGO_REFERENCE_MODEL = "google/gemini-3.1-flash-image-preview"

export interface EditedImageResult {
  bytes: Uint8Array
  mediaType: string
}

/**
 * Fetch the bytes of a reference image URL (e.g. a Xano-hosted logo).
 */
export async function fetchReferenceImage(
  url: string,
): Promise<{ bytes: Uint8Array; mediaType: string }> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch reference image (${res.status}) from ${url}`)
  }
  const buf = new Uint8Array(await res.arrayBuffer())
  const mediaType = res.headers.get("content-type") ?? "image/png"
  return { bytes: buf, mediaType }
}

export interface EditWithReferenceArgs {
  /** Multimodal model slug — must support image input + image output. */
  model?: string
  prompt: string
  reference: { bytes: Uint8Array; mediaType: string }
}

/**
 * Generate an image that uses the supplied reference image (e.g. a brand logo).
 */
export async function editImageWithReference(
  args: EditWithReferenceArgs,
): Promise<EditedImageResult> {
  const result = await generateText({
    model: args.model ?? LOGO_REFERENCE_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: args.reference.bytes,
            mediaType: args.reference.mediaType,
          },
          { type: "text", text: args.prompt },
        ],
      },
    ],
  })

  const imageFile = result.files.find((f) => f.mediaType?.startsWith("image/"))
  if (!imageFile) {
    throw new Error(
      `Multimodal model returned no image file. Text response: ${result.text?.slice(0, 200) ?? "(empty)"}`,
    )
  }

  return {
    bytes: imageFile.uint8Array,
    mediaType: imageFile.mediaType ?? "image/png",
  }
}
