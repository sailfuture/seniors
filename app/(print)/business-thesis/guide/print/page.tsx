import { SectionGuidePrint } from "@/components/form/section-guide-print"
import { BUSINESSTHESIS_API_CONFIG } from "@/lib/form-api-config"

export default function BusinessThesisGuidePrintPage() {
  return (
    <SectionGuidePrint
      apiConfig={BUSINESSTHESIS_API_CONFIG}
      projectName="Business Thesis"
      studentBasePath="/business-thesis"
    />
  )
}
