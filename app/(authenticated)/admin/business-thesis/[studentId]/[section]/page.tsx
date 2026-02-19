"use client"

import { use } from "react"

const sectionLabels: Record<string, string> = {
  "executive-summary": "Executive Summary",
  "products-services": "Products & Services",
  "market-analysis": "Market Analysis",
  "competitive-analysis": "Competitive Analysis",
  "financial-plan": "Financial Plan",
  "marketing-plan": "Marketing Plan",
  "closing-statement": "Closing Statement",
  contact: "Contact",
}

export default function AdminBusinessThesisSectionPage({
  params,
}: {
  params: Promise<{ studentId: string; section: string }>
}) {
  const { studentId, section } = use(params)
  const label = sectionLabels[section] ?? section

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Business Thesis — {label}</h1>
      <p className="text-muted-foreground">
        This section is not yet available for review.
      </p>
    </div>
  )
}
