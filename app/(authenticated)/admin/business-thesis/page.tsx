"use client"

import { StudentRoster } from "@/components/student-roster"

const BT_RESPONSES_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:45yS7ICi/businessthesis_responses"

const BT_TEMPLATE_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:45yS7ICi/businessthesis_template"

export default function AdminBusinessThesisPage() {
  return (
    <StudentRoster
      title="Business Thesis — Student Roster"
      description="View and manage student Business Thesis submissions."
      basePath="/admin/business-thesis"
      publicBaseUrl="/public/business-thesis"
      responsesEndpoint={BT_RESPONSES_ENDPOINT}
      templateEndpoint={BT_TEMPLATE_ENDPOINT}
      templateIdField="businessthesis_template_id"
      sectionIdField="businessthesis_sections_id"
    />
  )
}
