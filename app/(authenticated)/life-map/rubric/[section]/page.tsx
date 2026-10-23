import { RubricPage } from "@/components/form/rubric"
import { LIFE_MAP_RUBRIC } from "@/lib/rubric-products"

export default async function LifeMapSectionRubricPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  return <RubricPage product={LIFE_MAP_RUBRIC} slug={section} />
}
