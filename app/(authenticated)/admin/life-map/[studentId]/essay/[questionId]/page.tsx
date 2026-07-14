"use client"

import { use } from "react"
import { TeacherEssayReviewPage } from "@/components/form/teacher-essay-review-page"
import { LIFEMAP_API_CONFIG } from "@/lib/form-api-config"

export default function AdminLmEssayReviewPage({
  params,
}: {
  params: Promise<{ studentId: string; questionId: string }>
}) {
  const { studentId, questionId } = use(params)
  return (
    <TeacherEssayReviewPage
      studentId={studentId}
      questionId={Number(questionId)}
      apiConfig={LIFEMAP_API_CONFIG}
      backHref={`/admin/life-map/${studentId}/review`}
    />
  )
}
