"use client"

import { use } from "react"
import { EssayEditorPage } from "@/components/form/essay-editor-page"
import { LIFEMAP_API_CONFIG } from "@/lib/form-api-config"
import { slugToTitle } from "@/lib/lifemap-sections"

export default function LifeMapEssayEditorPage({
  params,
}: {
  params: Promise<{ section: string; questionId: string }>
}) {
  const { section, questionId } = use(params)

  return (
    <EssayEditorPage
      questionId={Number(questionId)}
      apiConfig={LIFEMAP_API_CONFIG}
      backHref={`/life-map/${section}`}
      backLabel={`Back to ${slugToTitle(section)}`}
    />
  )
}
