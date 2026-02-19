"use client"

import { use } from "react"
import { ReadOnlyFormPage } from "@/components/form/readonly-form-page"
import { ReadOnlyDynamicFormPage } from "@/components/form/readonly-dynamic-form-page"
import { sectionConfigMap } from "@/lib/form-configs"

const sectionLabels: Record<string, string> = {
  overview: "Overview",
  pathway: "Selected Pathway",
  profile: "Personal Profile",
  career: "Career",
  education: "Education",
  housing: "Housing",
  transportation: "Transportation",
  finance: "Finance",
  contact: "Contact",
}

const dynamicSections: Record<string, number> = {
  contact: 9,
}

export default function AdminLifeMapSectionPage({
  params,
}: {
  params: Promise<{ studentId: string; section: string }>
}) {
  const { studentId, section } = use(params)
  const label = sectionLabels[section] ?? section

  const sectionConfig = sectionConfigMap[section]
  const dynamicSectionId = dynamicSections[section]

  if (dynamicSectionId) {
    return (
      <ReadOnlyDynamicFormPage
        title={`Life Map — ${label}`}
        sectionId={dynamicSectionId}
        studentId={studentId}
      />
    )
  }

  if (!sectionConfig) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <h1 className="text-2xl font-bold">Life Map — {label}</h1>
        <p className="text-muted-foreground">
          This section is not yet available for review.
        </p>
      </div>
    )
  }

  return (
    <ReadOnlyFormPage
      title={`Life Map — ${label}`}
      config={sectionConfig.config}
      studentId={studentId}
    />
  )
}
