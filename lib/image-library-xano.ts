import type {
  GeneratedImage,
  ImageCategory,
  XanoFileMetadata,
} from "@/lib/image-generation-config"

const XANO_GENERATED_IMAGES_BASE =
  process.env.XANO_GENERATED_IMAGES_BASE ??
  process.env.NEXT_PUBLIC_XANO_GENERATED_IMAGES_BASE ??
  ""

function base(): string {
  if (!XANO_GENERATED_IMAGES_BASE) {
    throw new Error(
      "Missing XANO_GENERATED_IMAGES_BASE env var (e.g. https://xsc3-mvx7-r86m.n7e.xano.io/api:XXXX). Add it to .env.local once you create the Xano endpoint group.",
    )
  }
  return XANO_GENERATED_IMAGES_BASE.replace(/\/$/, "")
}

const recordsEndpoint = () => `${base()}/senior_generated_images`
const uploadEndpoint = () => `${base()}/upload/image`

export async function uploadImageToXano(
  bytes: Uint8Array,
  mediaType: string,
  filename: string,
): Promise<XanoFileMetadata> {
  const form = new FormData()
  form.append("content", new Blob([new Uint8Array(bytes)], { type: mediaType }), filename)
  const res = await fetch(uploadEndpoint(), { method: "POST", body: form })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Xano upload failed: ${res.status} ${text}`)
  }
  return (await res.json()) as XanoFileMetadata
}

/**
 * Everything the student has generated, including images they've since
 * deleted from their library. This is what the generation limit counts.
 */
export async function listGenerations(studentId: string): Promise<GeneratedImage[]> {
  const url = new URL(recordsEndpoint())
  url.searchParams.set("students_id", studentId)
  const res = await fetch(url.toString(), { cache: "no-store" })
  if (!res.ok) throw new Error(`Xano list failed: ${res.status}`)
  const data = (await res.json()) as GeneratedImage[]
  if (!Array.isArray(data)) return []
  // Xano filters on students_id (and returns nothing without one). The check
  // is repeated here because the delete route's ownership check rests on it:
  // a record that isn't this student's must never come back from this call.
  return data.filter((img) => String(img.students_id ?? "") === String(studentId))
}

/** The student's library: their generations, less the ones they deleted. */
export async function listImages(studentId: string): Promise<GeneratedImage[]> {
  return (await listGenerations(studentId)).filter((img) => !img.deleted)
}

export async function createImage(
  record: Omit<GeneratedImage, "id" | "created_at">,
): Promise<GeneratedImage> {
  const res = await fetch(recordsEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Xano create failed: ${res.status} ${text}`)
  }
  return (await res.json()) as GeneratedImage
}

/**
 * Takes an image out of the student's library. The record is marked deleted
 * rather than removed, so it still counts toward the generation limit.
 */
export async function deleteImage(id: number | string): Promise<void> {
  const res = await fetch(`${recordsEndpoint()}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deleted: true }),
  })
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "")
    throw new Error(`Xano delete failed: ${res.status} ${text}`)
  }
}

export type { ImageCategory }
