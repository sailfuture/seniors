import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/api-auth"
import { listImages } from "@/lib/image-library-xano"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const user = await getApiSession(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const studentId = user.students_id ?? null
  if (!studentId) {
    return NextResponse.json({ error: "No student id on session" }, { status: 403 })
  }

  try {
    const images = await listImages(studentId)
    images.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
    return NextResponse.json(images)
  } catch (err) {
    const message = err instanceof Error ? err.message : "List failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
