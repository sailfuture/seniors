"use client"

import { StudentRoster } from "@/components/student-roster"

export default function AdminBusinessThesisPage() {
  return (
    <StudentRoster
      title="Business Thesis — Student Roster"
      description="View and manage student Business Thesis submissions."
      basePath="/admin/business-thesis"
      publicBaseUrl="https://thesis.sailfutureacademy.org/dashboard"
      publicIdParam="id"
    />
  )
}
