"use client"

import { use, useCallback, useEffect, useMemo, useState } from "react"
import { deriveBrandTheme, BrandThemeProvider, useGoogleFont } from "@/components/brand-display"
import { formatYearGroup } from "@/lib/year-group"
import { fetchProjectLock } from "@/lib/project-lock"
import { cachedFetch } from "@/lib/cached-fetch"
import { fetchStudentProfile } from "@/lib/students"
import { ThesisCover } from "@/components/public-portfolio/cover"
import { PortfolioSections, buildPortfolioSections } from "@/components/public-portfolio/sections"
import {
  PortfolioEmpty,
  PortfolioLoading,
  PortfolioShell,
  type ChapterLink,
} from "@/components/public-portfolio/shell"
import { brandPortfolioTheme } from "@/components/public-portfolio/theme"
import { QUESTION_TYPE, typeOf, type ResponseMap } from "@/components/public-portfolio/types"

const BT_BASE =
  process.env.NEXT_PUBLIC_XANO_BT_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:45yS7ICi"

const SECTIONS_ENDPOINT = `${BT_BASE}/businessthesis_sections`
const TEMPLATE_ENDPOINT = `${BT_BASE}/businessthesis_template`
const RESPONSES_ENDPOINT = `${BT_BASE}/businessthesis_responses_by_student`
const CUSTOM_GROUP_ENDPOINT = `${BT_BASE}/businessthesis_custom_group`
const LOCKS_ENDPOINT = `${BT_BASE}/businessthesis_locks`

interface BusinessThesisSection {
  id: number
  section_title: string
  description?: string
  isLocked?: boolean
  order?: number
  photo?: { path: string; name: string; type: string; size: number; mime: string } | null
}

interface TemplateQuestion {
  id: number
  field_label: string
  field_name: string
  isArchived: boolean
  isPublished: boolean
  sortOrder: number
  min_words?: number
  question_types_id?: number | null
  dropdownOptions?: string[]
  public_display_title?: string
  public_display_description?: string
  image_aspect_ratio?: string
  _question_types?: { id: number; type: string; noInput?: boolean }
  [key: string]: unknown
}

function qSectionId(q: TemplateQuestion): number {
  return Number(q.businessthesis_sections_id ?? q.lifemap_sections_id ?? 0)
}

function qGroupId(q: TemplateQuestion): number | null {
  const v = q.businessthesis_custom_group_id ?? q.lifemap_custom_group_id
  return v != null ? Number(v) || null : null
}

// An image question labeled like "Section Background Image" supplies the
// section's hero backdrop instead of rendering as content.
function isSectionBackgroundQuestion(q: TemplateQuestion): boolean {
  return typeOf(q) === QUESTION_TYPE.IMAGE_UPLOAD && /section\s*background/i.test(q.field_label)
}

// The cover banner upload feeds the cover, never the content cards.
function isCoverBackgroundQuestion(q: TemplateQuestion): boolean {
  return typeOf(q) === QUESTION_TYPE.IMAGE_UPLOAD && /cover\s*background/i.test(q.field_label)
}

interface StudentResponse {
  id: number
  student_response: string
  date_response?: string | null
  image_response: { path?: string; url?: string; name?: string; mime?: string } | null
  students_id: string
  isArchived?: boolean
  isComplete?: boolean
  readyReview?: boolean
  revisionNeeded?: boolean
  source_link?: string
  title_of_source?: string
  author_name_or_publisher?: string
  date_of_publication?: string
  [key: string]: unknown
}

function rTemplateId(r: StudentResponse): number {
  return Number(r.businessthesis_template_id ?? r.lifemap_template_id ?? 0)
}

interface CustomGroup {
  id: number
  group_name: string
  group_description: string
  businessthesis_sections_id: number
  order?: number
  businessthesis_group_display_types_id?: number | null
  icon_name?: string | null
  width?: number | null
}

export default function PublicBusinessThesisPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = use(params)

  const [sections, setSections] = useState<BusinessThesisSection[]>([])
  const [templates, setTemplates] = useState<TemplateQuestion[]>([])
  const [responses, setResponses] = useState<StudentResponse[]>([])
  const [groups, setGroups] = useState<CustomGroup[]>([])
  const [studentName, setStudentName] = useState("")
  const [studentImage, setStudentImage] = useState("")
  const [studentYearGroup, setStudentYearGroup] = useState("")
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      // A locked project renders from its frozen snapshot, so template edits
      // never reach it. Only the student's identity row stays live.
      const lock = await fetchProjectLock(LOCKS_ENDPOINT, studentId)
      if (lock) {
        const snap = lock.snapshot
        setSections(
          (snap.sections as BusinessThesisSection[])
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
        const data: BusinessThesisSection[] = await sectionsRes.json()
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
        if (profile.yearGroup) setStudentYearGroup(profile.yearGroup)
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
    () => new Map(responses.map((r) => [rTemplateId(r), r])),
    [responses]
  )

  // The student's branding answers restyle the whole thesis: colors, fonts,
  // logo, and the cover.
  const brand = useMemo(() => deriveBrandTheme(templates, responseMap), [templates, responseMap])
  const theme = useMemo(() => brandPortfolioTheme(brand), [brand])
  useGoogleFont(brand.primaryFont)
  useGoogleFont(brand.secondaryFont)

  const model = useMemo(
    () =>
      buildPortfolioSections({
        sections,
        questions: templates,
        groups,
        responseMap,
        sectionOf: qSectionId,
        groupOf: qGroupId,
        groupSectionOf: (g) => g.businessthesis_sections_id,
        displayTypeOf: (g) => g.businessthesis_group_display_types_id ?? null,
        descriptionOf: (s) => s.description || "",
        isBackdrop: isSectionBackgroundQuestion,
        isHidden: isCoverBackgroundQuestion,
      }),
    [sections, templates, groups, responseMap]
  )

  const lastEdited = useMemo(() => {
    let max = 0
    for (const r of responses) {
      const le = r.last_edited
      const t = Math.max(
        typeof le === "number" ? le : Date.parse(String(le ?? "")) || 0,
        Number(r.created_at) || 0
      )
      if (t > max) max = t
    }
    return max > 0 ? new Date(max) : null
  }, [responses])

  if (loading) return <PortfolioLoading kind="Business Thesis" />

  const hasCover = !!(brand.companyName || brand.logoUrl)
  const sectionLinks: ChapterLink[] = model.map((s) => ({ id: s.anchor, title: s.title, number: s.number }))

  return (
    <BrandThemeProvider theme={brand}>
      <PortfolioShell
        kind="Business Thesis"
        detail={studentYearGroup ? formatYearGroup(studentYearGroup) : undefined}
        theme={theme}
        chapters={[...(hasCover ? [{ id: "cover", title: "Cover" }] : []), ...sectionLinks]}
        studentName={studentName}
        studentImage={studentImage}
        printHref={`/public/business-thesis/${studentId}/print`}
      >
        {/* Without a brand there's no cover, but the page still needs its headline. */}
        {!hasCover && (
          <h1 className="sr-only">
            {studentName ? `${studentName}’s Business Thesis` : "Business Thesis"}
          </h1>
        )}
        {hasCover && (
          <ThesisCover
            studentName={studentName}
            studentImage={studentImage}
            lastEdited={lastEdited}
            firstChapter={model[0]?.anchor}
            seed={studentId}
          />
        )}
        <PortfolioSections sections={model} responseMap={responseMap} compactColors />
        {model.length === 0 && (
          <PortfolioEmpty>This Business Thesis doesn&rsquo;t have any sections yet.</PortfolioEmpty>
        )}
      </PortfolioShell>
    </BrandThemeProvider>
  )
}
