"use client"

import { use } from "react"
import { redirect } from "next/navigation"

export default function AdminStudentBusinessThesisPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = use(params)
  redirect(`/admin/business-thesis/${studentId}/executive-summary`)
}
