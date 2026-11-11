"use client"

import { use } from "react"
import { AdvisorActivityDetail } from "@/components/advisor-activity"

/** One thesis advisor's comments, revision requests, meetings and activity. */
export default function AdvisorActivityDetailPage({ params }: { params: Promise<{ advisorId: string }> }) {
  const { advisorId } = use(params)
  return <AdvisorActivityDetail advisorId={Number(advisorId)} />
}
