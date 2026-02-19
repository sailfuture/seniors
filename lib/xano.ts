const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const UPLOAD_ENDPOINT = `${XANO_BASE}/upload/image`

export interface XanoImageResponse {
  path: string
  name: string
  type: string
  size: number
  mime: string
  meta?: Record<string, unknown>
}

export async function uploadImageToXano(file: File): Promise<XanoImageResponse> {
  const formData = new FormData()
  formData.append("content", file)

  const res = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Image upload failed (${res.status}): ${text}`)
  }

  return res.json()
}
