/**
 * Direct calls to Vercel AI Gateway's OpenAI-compatible Images Edits endpoint.
 *
 * The AI SDK's `experimental_generateImage` is text-to-image only. To pass a
 * reference image (e.g. a student's brand logo) we hit the gateway's
 * `/v1/images/edits` route directly with multipart/form-data, the same shape
 * OpenAI's Images Edit API expects.
 */

const GATEWAY_BASE = "https://ai-gateway.vercel.sh/v1"

function authHeader(): { Authorization: string } {
  const key = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN
  if (!key) {
    throw new Error(
      "Missing AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN — cannot call AI Gateway images/edits.",
    )
  }
  return { Authorization: `Bearer ${key}` }
}

export interface EditedImageResult {
  bytes: Uint8Array
  mediaType: string
}

/**
 * Fetch the bytes of a reference image URL (e.g. a Xano-hosted logo).
 */
export async function fetchReferenceImage(url: string): Promise<{ bytes: Uint8Array; mediaType: string }> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch reference image (${res.status}) from ${url}`)
  }
  const buf = new Uint8Array(await res.arrayBuffer())
  const mediaType = res.headers.get("content-type") ?? "image/png"
  return { bytes: buf, mediaType }
}

export interface EditWithReferenceArgs {
  model: string
  prompt: string
  reference: { bytes: Uint8Array; mediaType: string; filename?: string }
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto"
}

/**
 * Call AI Gateway's images/edits endpoint with a reference image + prompt.
 * Returns the generated image bytes (base64-decoded from the JSON response).
 */
export async function editImageWithReference(args: EditWithReferenceArgs): Promise<EditedImageResult> {
  const form = new FormData()
  form.append("model", args.model)
  form.append("prompt", args.prompt)
  form.append("n", "1")
  if (args.size) form.append("size", args.size)
  form.append(
    "image",
    new Blob([new Uint8Array(args.reference.bytes)], { type: args.reference.mediaType }),
    args.reference.filename ?? "reference.png",
  )

  const res = await fetch(`${GATEWAY_BASE}/images/edits`, {
    method: "POST",
    headers: authHeader(),
    body: form,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Gateway images/edits failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as {
    data?: { b64_json?: string; url?: string }[]
  }
  const entry = data.data?.[0]
  if (!entry) throw new Error("Gateway returned no image data")

  if (entry.b64_json) {
    const bytes = Uint8Array.from(Buffer.from(entry.b64_json, "base64"))
    return { bytes, mediaType: "image/png" }
  }
  if (entry.url) {
    const r = await fetch(entry.url)
    if (!r.ok) throw new Error(`Failed to fetch generated image url (${r.status})`)
    const bytes = new Uint8Array(await r.arrayBuffer())
    return { bytes, mediaType: r.headers.get("content-type") ?? "image/png" }
  }
  throw new Error("Gateway returned data entry with neither b64_json nor url")
}
