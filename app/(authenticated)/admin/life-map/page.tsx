"use client"

import { StudentRoster } from "@/components/student-roster"
import { LIFEMAP_API_CONFIG } from "@/lib/form-api-config"

export default function AdminLifeMapPage() {
  return (
    <StudentRoster
      title="Life Map — Student Roster"
      description="View and manage student Life Map submissions."
      basePath="/admin/life-map"
      publicBaseUrl="/public/life-map"
      apiConfig={LIFEMAP_API_CONFIG}
      product="life-map"
    />
  )
}
