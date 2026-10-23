"use client"

import { use } from "react"
import { RubricPage } from "@/components/form/rubric"
import { BUSINESS_THESIS_RUBRIC } from "@/lib/rubric-products"

export default function BusinessThesisSectionRubricPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = use(params)
  return <RubricPage product={BUSINESS_THESIS_RUBRIC} slug={section} />
}
