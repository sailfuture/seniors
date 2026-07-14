"use client"

import { use } from "react"
import { PrintDocument } from "@/components/print-document"
import { BUSINESSTHESIS_API_CONFIG } from "@/lib/form-api-config"

export default function PrintBusinessThesisPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = use(params)
  return (
    <PrintDocument
      studentId={studentId}
      apiConfig={BUSINESSTHESIS_API_CONFIG}
      product="business-thesis"
      backHref={`/public/business-thesis/${studentId}`}
    />
  )
}
