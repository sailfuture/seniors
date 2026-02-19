"use client"

import { StudentRoster } from "@/components/student-roster"

export default function AdminLifeMapPage() {
  return (
    <StudentRoster
      title="Life Map — Student Roster"
      description="View and manage student Life Map submissions."
      basePath="/admin/life-map"
    />
  )
}
