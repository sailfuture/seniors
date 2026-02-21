"use client"

import { FormPage } from "@/components/form/form-page"
import { housingConfig } from "@/lib/form-configs"

const XANO_BASE = process.env.NEXT_PUBLIC_XANO_API_BASE ?? "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

export default function HousingPage() {
  return (
    <FormPage
      title="Housing & Living"
      config={housingConfig}
      commentsEndpoint={`${XANO_BASE}/lifemap_comments`}
      sectionSlug="housing"
    />
  )
}
