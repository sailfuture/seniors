import { BUSINESSTHESIS_API_CONFIG, LIFEMAP_API_CONFIG } from "@/lib/form-api-config"
import { btTitleToSlug } from "@/lib/businessthesis-sections"
import { titleToSlug } from "@/lib/lifemap-sections"
import { BUSINESS_THESIS_SCORING } from "@/lib/rubric-scoring"
import { LIFE_MAP_SCORING } from "@/lib/rubric-scoring-lifemap"
import { BUSINESS_THESIS_CRITERIA_GROUPS, LIFE_MAP_CRITERIA_GROUPS, withCriteriaGroups } from "@/lib/rubric-groups"
import type { RubricProduct } from "@/components/form/rubric"

export const BUSINESS_THESIS_RUBRIC: RubricProduct = {
  apiConfig: BUSINESSTHESIS_API_CONFIG,
  name: "Business Thesis",
  rubricName: "Thesis Rubric",
  basePath: "/business-thesis",
  slug: btTitleToSlug,
  scoring: withCriteriaGroups(BUSINESS_THESIS_SCORING, BUSINESS_THESIS_CRITERIA_GROUPS),
}

export const LIFE_MAP_RUBRIC: RubricProduct = {
  apiConfig: LIFEMAP_API_CONFIG,
  name: "Life Map",
  rubricName: "Life Map Rubric",
  basePath: "/life-map",
  slug: titleToSlug,
  scoring: withCriteriaGroups(LIFE_MAP_SCORING, LIFE_MAP_CRITERIA_GROUPS),
}
