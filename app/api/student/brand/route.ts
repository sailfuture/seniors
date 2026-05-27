import { NextRequest, NextResponse } from "next/server"
import { getApiSession } from "@/lib/api-auth"
import { fetchStudentBrand } from "@/lib/student-brand"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const user = await getApiSession(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const studentId = user.students_id
  if (!studentId) return NextResponse.json({ error: "No student id" }, { status: 403 })

  const brand = await fetchStudentBrand(studentId)
  return NextResponse.json({
    hasContent: brand.hasContent,
    hasLogo: brand.hasLogo,
  })
}
