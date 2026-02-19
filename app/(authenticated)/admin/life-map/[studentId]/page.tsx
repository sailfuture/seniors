"use client"

import { use } from "react"
import { redirect } from "next/navigation"

export default function AdminStudentLifeMapPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = use(params)
  redirect(`/admin/life-map/${studentId}/overview`)
}
