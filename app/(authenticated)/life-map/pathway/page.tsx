"use client"

import { FormPage } from "@/components/form/form-page"
import { pathwayConfig } from "@/lib/form-configs"

const XANO_BASE = process.env.NEXT_PUBLIC_XANO_API_BASE ?? "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

export default function PathwayPage() {
  return (
    <FormPage
      title="Selected Pathway"
      config={pathwayConfig}
      commentsEndpoint={`${XANO_BASE}/lifemap_comments`}
      sectionSlug="pathway"
    />
  )
}
