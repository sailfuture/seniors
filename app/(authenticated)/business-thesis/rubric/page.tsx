"use client"

// A client route: the product config carries a slug function, which a server
// component could not hand to the client RubricPage.
import { RubricPage } from "@/components/form/rubric"
import { BUSINESS_THESIS_RUBRIC } from "@/lib/rubric-products"

export default function BusinessThesisRubricPage() {
  return <RubricPage product={BUSINESS_THESIS_RUBRIC} />
}
