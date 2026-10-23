import { AdvisorStudentGuard } from "@/components/advisor-student-guard"

export default async function StudentLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
  return (
    <AdvisorStudentGuard product="business-thesis" studentId={studentId}>
      {children}
    </AdvisorStudentGuard>
  )
}
