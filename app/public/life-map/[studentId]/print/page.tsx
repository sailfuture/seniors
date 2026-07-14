"use client"

import { use } from "react"
import { PrintDocument } from "@/components/print-document"
import { LIFEMAP_API_CONFIG } from "@/lib/form-api-config"

export default function PrintLifeMapPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = use(params)
  return (
    <PrintDocument
      studentId={studentId}
      apiConfig={LIFEMAP_API_CONFIG}
      product="life-map"
      backHref={`/public/life-map/${studentId}`}
    />
  )
}
