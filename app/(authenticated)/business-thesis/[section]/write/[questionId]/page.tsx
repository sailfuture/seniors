"use client"

import { use } from "react"
import { EssayEditorPage } from "@/components/form/essay-editor-page"
import { BUSINESSTHESIS_API_CONFIG } from "@/lib/form-api-config"
import { btSlugToTitle } from "@/lib/businessthesis-sections"

export default function BusinessThesisEssayEditorPage({
  params,
}: {
  params: Promise<{ section: string; questionId: string }>
}) {
  const { section, questionId } = use(params)

  return (
    <EssayEditorPage
      questionId={Number(questionId)}
      apiConfig={BUSINESSTHESIS_API_CONFIG}
      backHref={`/business-thesis/${section}`}
      backLabel={`Back to ${btSlugToTitle(section)}`}
    />
  )
}
