import { BUSINESSTHESIS_API_CONFIG, LIFEMAP_API_CONFIG } from "@/lib/form-api-config"
import { btTitleToSlug } from "@/lib/businessthesis-sections"
import { titleToSlug } from "@/lib/lifemap-sections"
import { BUSINESS_THESIS_SCORING } from "@/lib/rubric-scoring"
import { LIFE_MAP_SCORING } from "@/lib/rubric-scoring-lifemap"
import type { RubricProduct } from "@/components/form/rubric"

export const BUSINESS_THESIS_RUBRIC: RubricProduct = {
  apiConfig: BUSINESSTHESIS_API_CONFIG,
  name: "Business Thesis",
  basePath: "/business-thesis",
  slug: btTitleToSlug,
  scoring: BUSINESS_THESIS_SCORING,
}

export const LIFE_MAP_RUBRIC: RubricProduct = {
  apiConfig: LIFEMAP_API_CONFIG,
  name: "Life Map",
  basePath: "/life-map",
  slug: titleToSlug,
  scoring: LIFE_MAP_SCORING,
}
