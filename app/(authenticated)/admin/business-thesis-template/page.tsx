"use client"

import { TemplateOverview } from "@/components/template-overview"
import { BUSINESSTHESIS_API_CONFIG } from "@/lib/form-api-config"
import { btTitleToSlug, invalidateBtSectionsCache } from "@/lib/businessthesis-sections"

export default function BusinessThesisTemplatePage() {
  return (
    <TemplateOverview
      apiConfig={BUSINESSTHESIS_API_CONFIG}
      title="Business Thesis Template"
      templateBasePath="/admin/business-thesis-template"
      slugFn={btTitleToSlug}
      onSectionsInvalidated={invalidateBtSectionsCache}
    />
  )
}
