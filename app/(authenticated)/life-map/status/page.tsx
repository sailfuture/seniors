"use client"

import { StatusOverview } from "@/components/status-overview"
import { LIFEMAP_API_CONFIG } from "@/lib/form-api-config"
import { titleToSlug } from "@/lib/lifemap-sections"

export default function LifeMapStatusPage() {
  return (
    <StatusOverview
      title="Life Map"
      basePath="/life-map"
      apiConfig={LIFEMAP_API_CONFIG}
      slugify={titleToSlug}
    />
  )
}
