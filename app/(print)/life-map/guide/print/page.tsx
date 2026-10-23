import { SectionGuidePrint } from "@/components/form/section-guide-print"
import { LIFEMAP_API_CONFIG } from "@/lib/form-api-config"

export default function LifeMapGuidePrintPage() {
  return (
    <SectionGuidePrint
      apiConfig={LIFEMAP_API_CONFIG}
      projectName="Life Map"
      studentBasePath="/life-map"
    />
  )
}
