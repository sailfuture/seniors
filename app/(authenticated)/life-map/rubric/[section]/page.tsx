"use client"

import { use } from "react"
import { RubricPage } from "@/components/form/rubric"
import { LIFE_MAP_RUBRIC } from "@/lib/rubric-products"

export default function LifeMapSectionRubricPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = use(params)
  return <RubricPage product={LIFE_MAP_RUBRIC} slug={section} />
}
