import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/api-auth"
import { MAX_GENERATIONS_PER_STUDENT } from "@/lib/image-generation-config"
import { listGenerations } from "@/lib/image-library-xano"

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
    // `used` counts every generation, deleted or not; `images` is the library.
    const generations = await listGenerations(studentId)
    const images = generations.filter((img) => !img.deleted)
    images.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
    return NextResponse.json({ images, used: generations.length, limit: MAX_GENERATIONS_PER_STUDENT })
  } catch (err) {
    const message = err instanceof Error ? err.message : "List failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
