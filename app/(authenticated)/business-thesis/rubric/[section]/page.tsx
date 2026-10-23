import { RubricPage } from "@/components/form/rubric"
import { BUSINESS_THESIS_RUBRIC } from "@/lib/rubric-products"

export default async function BusinessThesisSectionRubricPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  return <RubricPage product={BUSINESS_THESIS_RUBRIC} slug={section} />
}
