"use client"

import { use } from "react"
import { TeacherEssayReviewPage } from "@/components/form/teacher-essay-review-page"
import { BUSINESSTHESIS_API_CONFIG } from "@/lib/form-api-config"

export default function AdminBtEssayReviewPage({
  params,
}: {
  params: Promise<{ studentId: string; questionId: string }>
}) {
  const { studentId, questionId } = use(params)
  return (
    <TeacherEssayReviewPage
      studentId={studentId}
      questionId={Number(questionId)}
      apiConfig={BUSINESSTHESIS_API_CONFIG}
      backHref={`/admin/business-thesis/${studentId}/review`}
    />
  )
}
