"use client"

import { StatusOverview } from "@/components/status-overview"
import { BUSINESSTHESIS_API_CONFIG } from "@/lib/form-api-config"
import { btTitleToSlug } from "@/lib/businessthesis-sections"

export default function BusinessThesisStatusPage() {
  return (
    <StatusOverview
      title="Business Thesis"
      basePath="/business-thesis"
      apiConfig={BUSINESSTHESIS_API_CONFIG}
      slugify={btTitleToSlug}
      adminBasePath="/admin/business-thesis"
    />
  )
}
