"use client"

// A client route: the product config carries a slug function, which a server
// component could not hand to the client RubricPage.
import { RubricPage } from "@/components/form/rubric"
import { LIFE_MAP_RUBRIC } from "@/lib/rubric-products"

export default function LifeMapRubricPage() {
  return <RubricPage product={LIFE_MAP_RUBRIC} />
}
