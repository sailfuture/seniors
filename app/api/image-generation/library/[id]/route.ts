import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/api-auth"
import { deleteImage, listImages } from "@/lib/image-library-xano"

export const runtime = "nodejs"

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiSession(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const studentId = user.students_id
  if (!studentId) return NextResponse.json({ error: "No student id" }, { status: 403 })

  const { id } = await params
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  // Ownership check — make sure the record actually belongs to this student.
  try {
    const owned = await listImages(studentId)
    const found = owned.find((img) => String(img.id) === id)
    if (!found) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ownership check failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  try {
    await deleteImage(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
