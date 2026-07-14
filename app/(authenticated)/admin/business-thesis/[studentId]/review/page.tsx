"use client"

import { use } from "react"
import { AdminReviewQueue } from "@/components/admin-review-queue"
import { BUSINESSTHESIS_API_CONFIG } from "@/lib/form-api-config"
import { btTitleToSlug } from "@/lib/businessthesis-sections"

export default function AdminBtStudentReviewPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = use(params)
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Business Thesis — Review</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          This student&apos;s submissions awaiting review and outstanding revisions. Open any row to
          read the response, its comment thread, and mark it complete or request a revision.
        </p>
      </div>
      <AdminReviewQueue
        apiConfig={BUSINESSTHESIS_API_CONFIG}
        slugify={btTitleToSlug}
        studentId={studentId}
        defaultExpanded
      />
    </div>
  )
}
