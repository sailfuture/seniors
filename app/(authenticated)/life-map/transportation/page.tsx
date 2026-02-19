"use client"

import { FormPage } from "@/components/form/form-page"
import { transportationConfig } from "@/lib/form-configs"

const XANO_BASE = process.env.NEXT_PUBLIC_XANO_API_BASE ?? "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

export default function TransportationPage() {
  return (
    <FormPage
      title="Transportation & Mobility"
      config={transportationConfig}
      commentsEndpoint={`${XANO_BASE}/lifemap_comments`}
    />
  )
}
