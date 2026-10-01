"use client"

import { use, useCallback, useEffect, useMemo, useState } from "react"
import { fetchProjectLock } from "@/lib/project-lock"
import { cachedFetch } from "@/lib/cached-fetch"
import { fetchStudentProfile } from "@/lib/students"
import { formatYearGroup } from "@/lib/year-group"
import { TitleCover, partsPhrase } from "@/components/public-portfolio/cover"
import { PortfolioSections, buildPortfolioSections } from "@/components/public-portfolio/sections"
import {
  PortfolioEmpty,
  PortfolioLoading,
  PortfolioShell,
  type ChapterLink,
} from "@/components/public-portfolio/shell"
import { SAILFUTURE_THEME } from "@/components/public-portfolio/theme"
import { QUESTION_TYPE, typeOf, type ResponseMap } from "@/components/public-portfolio/types"

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const SECTIONS_ENDPOINT = `${XANO_BASE}/lifemap_sections`
const TEMPLATE_ENDPOINT = `${XANO_BASE}/lifeplan_template`
const RESPONSES_ENDPOINT = `${XANO_BASE}/lifemap_responses_by_student`
const CUSTOM_GROUP_ENDPOINT = `${XANO_BASE}/lifemap_custom_group`
const LOCKS_ENDPOINT = `${XANO_BASE}/lifemap_locks`

interface LifeMapSection {
  id: number
  section_title: string
  section_description?: string
  description?: string
  isLocked?: boolean
  order?: number
  photo?: { path: string; name: string; type: string; size: number; mime: string } | null
}

interface TemplateQuestion {
  id: number
  field_label: string
  field_name: string
  lifemap_sections_id: number
  lifemap_custom_group_id: number | null
  isArchived: boolean
  isPublished: boolean
  sortOrder: number
  min_words?: number
  question_types_id?: number | null
  dropdownOptions?: string[]
  public_display_title?: string
  public_display_description?: string
  width?: number | null
  image_aspect_ratio?: string
  _question_types?: { id: number; type: string; noInput?: boolean }
}

interface StudentResponse {
  id: number
  lifemap_template_id: number
  student_response: string
  date_response: string | null
  image_response: { path?: string; url?: string; name?: string; mime?: string } | null
  students_id: string
  isArchived?: boolean
  isComplete?: boolean
  readyReview?: boolean
  revisionNeeded?: boolean
  lifemap_sections_id?: number
  lifemap_custom_group_id?: number | null
  source_link?: string
  title_of_source?: string
  author_name_or_publisher?: string
  date_of_publication?: string
  [key: string]: unknown
}

interface CustomGroup {
  id: number
  group_name: string
  group_description: string
  lifemap_sections_id: number
  order?: number
  lifemap_group_display_types_id?: number | null
  icon_name?: string | null
  width?: number | null
}

// A student-uploaded "Section Background" image replaces the section's photo
// (once approved) and never renders as content.
function isSectionBackground(q: TemplateQuestion): boolean {
  return typeOf(q) === QUESTION_TYPE.IMAGE_UPLOAD && /section\s*background/i.test(q.field_label)
}

export default function PublicLifeMapPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = use(params)

  const [sections, setSections] = useState<LifeMapSection[]>([])
  const [templates, setTemplates] = useState<TemplateQuestion[]>([])
  const [responses, setResponses] = useState<StudentResponse[]>([])
  const [groups, setGroups] = useState<CustomGroup[]>([])
  const [studentName, setStudentName] = useState("")
  const [studentImage, setStudentImage] = useState("")
  const [yearGroup, setYearGroup] = useState("")
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      // A locked project renders from its frozen snapshot, so template edits
      // never reach it. Only the student's identity row stays live.
      const lock = await fetchProjectLock(LOCKS_ENDPOINT, studentId)
      if (lock) {
        const snap = lock.snapshot
        setSections(
          (snap.sections as LifeMapSection[])
            .filter((s) => !s.isLocked)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        )
        setTemplates((snap.questions as TemplateQuestion[]).filter((q) => !q.isArchived && q.isPublished))
        setResponses(
          (snap.responses as StudentResponse[]).filter(
            (r) => !r.isArchived && String(r.students_id ?? "") === String(studentId)
          )
        )
        setGroups(snap.groups as CustomGroup[])
      }
      const [sectionsRes, templateRes, responsesRes, groupsRes, profile] =
        await Promise.all([
          lock ? null : cachedFetch(SECTIONS_ENDPOINT),
          lock ? null : cachedFetch(TEMPLATE_ENDPOINT),
          lock ? null : fetch(`${RESPONSES_ENDPOINT}?students_id=${studentId}`),
          lock ? null : cachedFetch(CUSTOM_GROUP_ENDPOINT),
          fetchStudentProfile(studentId),
        ])

      if (sectionsRes?.ok) {
        const data: LifeMapSection[] = await sectionsRes.json()
        setSections(data.filter((s) => !s.isLocked).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      }
      if (templateRes?.ok) {
        const data: TemplateQuestion[] = await templateRes.json()
        setTemplates(data.filter((q) => !q.isArchived && q.isPublished))
      }
      if (responsesRes?.ok) {
        const data: StudentResponse[] = await responsesRes.json()
        setResponses(data.filter((r) => !r.isArchived))
      }
      if (groupsRes?.ok) {
        const data: CustomGroup[] = await groupsRes.json()
        setGroups(data)
      }
      if (profile) {
        setStudentName(`${profile.firstName} ${profile.lastName}`.trim())
        if (profile.profileImage) setStudentImage(profile.profileImage)
        if (profile.yearGroup) setYearGroup(profile.yearGroup)
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const responseMap: ResponseMap = useMemo(
    () => new Map(responses.map((r) => [r.lifemap_template_id, r])),
    [responses]
  )

  const model = useMemo(
    () =>
      buildPortfolioSections({
        sections,
        questions: templates,
        groups,
        responseMap,
        sectionOf: (q) => q.lifemap_sections_id,
        groupOf: (q) => q.lifemap_custom_group_id,
        groupSectionOf: (g) => g.lifemap_sections_id,
        displayTypeOf: (g) => g.lifemap_group_display_types_id ?? null,
        descriptionOf: (s) => s.section_description || s.description || "",
        isBackdrop: isSectionBackground,
        // Staff photos are the same for every student; each section gets a
        // chart pattern instead, unless the student's own photo is approved.
        templatePhotos: false,
      }),
    [sections, templates, groups, responseMap]
  )

  if (loading) return <PortfolioLoading kind="Life Map" />

  const sectionLinks: ChapterLink[] = model.map((s) => ({ id: s.anchor, title: s.title, number: s.number }))
  const classLabel = yearGroup ? formatYearGroup(yearGroup) : undefined
  const firstName = studentName.split(/\s+/)[0]

  return (
    <PortfolioShell
      kind="Life Map"
      detail={classLabel}
      theme={SAILFUTURE_THEME}
      chapters={[{ id: "cover", title: "Cover" }, ...sectionLinks]}
      studentName={studentName}
      studentImage={studentImage}
      printHref={`/public/life-map/${studentId}/print`}
      cover={
        <TitleCover
          kind="Life Map"
          studentName={studentName}
          studentImage={studentImage}
          classLabel={classLabel}
          summary={`${firstName ? `${firstName}’s plan` : "A plan"} for life after graduation${
            model.length > 0 ? `, in ${partsPhrase(model.length)}` : ""
          }.`}
          chapters={sectionLinks}
          seed={studentId}
        />
      }
    >
      <PortfolioSections sections={model} responseMap={responseMap} />
      {model.length === 0 && <PortfolioEmpty>This Life Map doesn&rsquo;t have any sections yet.</PortfolioEmpty>}
    </PortfolioShell>
  )
}
