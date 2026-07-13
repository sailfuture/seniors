"use client"

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { GroupDisplayRenderer, isGroupDisplayType, DISPLAY_TYPE, getGoogleSheetUrl, GoogleSheetOpenButton } from "@/components/group-display-types"
import {
  ColorSwatch,
  FontPreview,
  parseBrandColor,
  parseExactHex,
  deriveBrandTheme,
  BrandThemeProvider,
  useBrandTheme,
  useGoogleFont,
  inkFor,
} from "@/components/brand-display"
import { ZoomableImage } from "@/components/zoomable-image"
import { LineItemsTable } from "@/components/line-items-table"
import { LINE_ITEMS_TYPE_ID } from "@/lib/line-items"
import { StatusBadge, statusOf, groupStatusOf } from "@/components/field-status"
import { icons as lucideIcons } from "lucide-react"

const BT_BASE =
  process.env.NEXT_PUBLIC_XANO_BT_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:45yS7ICi"

const SECTIONS_ENDPOINT = `${BT_BASE}/businessthesis_sections`
const TEMPLATE_ENDPOINT = `${BT_BASE}/businessthesis_template`
const RESPONSES_ENDPOINT = `${BT_BASE}/businessthesis_responses_by_student`
const CUSTOM_GROUP_ENDPOINT = `${BT_BASE}/businessthesis_custom_group`
const STUDENTS_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/get_active_students_email"

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
  const typeId = q.question_types_id ?? q._question_types?.id ?? null
  return typeId === QUESTION_TYPE.IMAGE_UPLOAD && /section\s*background/i.test(q.field_label)
}

// The cover banner upload feeds the deck cover, never the content cards.
function isCoverBackgroundQuestion(q: TemplateQuestion): boolean {
  const typeId = q.question_types_id ?? q._question_types?.id ?? null
  return typeId === QUESTION_TYPE.IMAGE_UPLOAD && /cover\s*background/i.test(q.field_label)
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

const QUESTION_TYPE = {
  LONG_RESPONSE: 1,
  SHORT_RESPONSE: 2,
  CURRENCY: 3,
  IMAGE_UPLOAD: 4,
  DROPDOWN: 5,
  URL: 6,
  DATE: 7,
  SOURCE: 12,
} as const

function getGroupColSpan(width: number | null | undefined): string {
  if (width === 1) return "md:col-span-6"
  if (width === 3) return "md:col-span-2"
  return "md:col-span-3"
}

function getQuestionColSpan(width: number | null | undefined, isShort: boolean): string {
  if (width === 1) return "md:col-span-6"
  if (width === 2) return "md:col-span-3"
  if (width === 3) return "md:col-span-2"
  return isShort ? "md:col-span-3" : "md:col-span-6"
}

function resolveImageUrl(path: string | undefined): string {
  if (!path) return ""
  if (path.startsWith("http")) return path
  return `https://xsc3-mvx7-r86m.n7e.xano.io${path}`
}

function formatCurrency(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num)
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } catch {
    return value
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

function GroupIcon({ name }: { name: string }) {
  const brand = useBrandTheme()
  const pascalName = name
    .split(/[-_ ]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("") as keyof typeof lucideIcons
  const Icon = lucideIcons[pascalName]
  if (!Icon) return null
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-gray-100 bg-white">
      <Icon
        className="size-4 text-gray-600"
        strokeWidth={1.5}
        style={brand.hasBrand ? { color: brand.primaryInk } : undefined}
      />
    </div>
  )
}

function isShortType(typeId: number | null): boolean {
  return typeId === QUESTION_TYPE.SHORT_RESPONSE ||
    typeId === QUESTION_TYPE.CURRENCY ||
    typeId === QUESTION_TYPE.DROPDOWN ||
    typeId === QUESTION_TYPE.URL ||
    typeId === QUESTION_TYPE.DATE
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
  const [activeSection, setActiveSection] = useState<string>("")
  const sectionRefs = useRef<Map<number, HTMLElement>>(new Map())

  const loadData = useCallback(async () => {
    try {
      const [sectionsRes, templateRes, responsesRes, groupsRes, studentsRes] =
        await Promise.all([
          fetch(SECTIONS_ENDPOINT),
          fetch(TEMPLATE_ENDPOINT),
          fetch(`${RESPONSES_ENDPOINT}?students_id=${studentId}`),
          fetch(CUSTOM_GROUP_ENDPOINT),
          fetch(STUDENTS_ENDPOINT),
        ])

      if (sectionsRes.ok) {
        const data: BusinessThesisSection[] = await sectionsRes.json()
        setSections(data.filter((s) => !s.isLocked).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      }
      if (templateRes.ok) {
        const data: TemplateQuestion[] = await templateRes.json()
        setTemplates(data.filter((q) => !q.isArchived && q.isPublished))
      }
      if (responsesRes.ok) {
        const data: StudentResponse[] = await responsesRes.json()
        setResponses(data.filter((r) => !r.isArchived))
      }
      if (groupsRes.ok) {
        const data: CustomGroup[] = await groupsRes.json()
        setGroups(data)
      }
      if (studentsRes.ok) {
        const students: { id: string; firstName: string; lastName: string; profileImage?: string; yearGroup?: string }[] =
          await studentsRes.json()
        const match = students.find((s) => s.id === studentId)
        if (match) {
          setStudentName(`${match.firstName} ${match.lastName}`)
          if (match.profileImage) setStudentImage(match.profileImage)
          if (match.yearGroup) setStudentYearGroup(match.yearGroup)
        }
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

  useEffect(() => {
    if (sections.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    )
    for (const el of sectionRefs.current.values()) {
      observer.observe(el)
    }
    return () => observer.disconnect()
  }, [sections, loading])

  const scrollToSection = (sectionId: number) => {
    const el = sectionRefs.current.get(sectionId)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const responseMap = new Map<number, StudentResponse>()
  for (const r of responses) {
    responseMap.set(rTemplateId(r), r)
  }

  const brand = useMemo(() => {
    const map = new Map<number, StudentResponse>()
    for (const r of responses) map.set(rTemplateId(r), r)
    return deriveBrandTheme(templates, map)
  }, [templates, responses])

  useGoogleFont(brand.primaryFont)
  useGoogleFont(brand.secondaryFont)

  const hasCover = !!(brand.companyName || brand.logoUrl)

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

  if (loading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="border-muted-foreground/30 border-t-foreground h-8 w-8 animate-spin rounded-full border-2" />
          <p className="text-muted-foreground text-sm">Loading Business Thesis...</p>
        </div>
      </div>
    )
  }

  return (
    <BrandThemeProvider theme={brand}>
    <div className="[--header-height:calc(var(--spacing)*14)]">
      <SidebarProvider className="flex flex-col">
        <header className="bg-background sticky top-0 z-50 flex w-full items-center border-b">
          <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
            <img
              src="/images/sailfuture-square.webp"
              alt="SailFuture Academy"
              className="size-7 shrink-0 rounded-full border border-gray-300 shadow-sm"
            />
            <Separator orientation="vertical" className="mx-2 data-vertical:h-4 data-vertical:self-auto" />
            <SidebarTrigger />
            <span className="text-sm font-semibold tracking-tight">SailFuture Academy</span>
            <Separator orientation="vertical" className="mx-2 data-vertical:h-4 data-vertical:self-auto" />
            <span className="text-muted-foreground text-sm">Business Thesis</span>
            {studentYearGroup && (
              <>
                <Separator orientation="vertical" className="mx-2 data-vertical:h-4 data-vertical:self-auto" />
                <span className="text-muted-foreground text-sm">{studentYearGroup}</span>
              </>
            )}
            <div className="ml-auto flex items-center gap-3">
              {studentName && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{studentName}</span>
                  <Avatar className="size-7">
                    {studentImage && <AvatarImage src={studentImage} alt={studentName} />}
                    <AvatarFallback className="text-xs">{getInitials(studentName)}</AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-1">
          <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!">
            <SidebarHeader className="gap-0 px-0 py-0">
              {studentName && (
                <>
                  <div className="flex items-center gap-3 px-4 py-4">
                    <Avatar className="size-9">
                      {studentImage && <AvatarImage src={studentImage} alt={studentName} />}
                      <AvatarFallback className="text-xs">{getInitials(studentName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                      <span className="text-sm font-semibold">{studentName}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {brand.companyName || "Business Thesis"}
                      </span>
                    </div>
                  </div>
                  <Separator />
                </>
              )}
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Sections</SidebarGroupLabel>
                <SidebarMenu>
                  {hasCover && (
                    <SidebarMenuItem key="cover">
                      <SidebarMenuButton
                        onClick={() => scrollToSection(0)}
                        isActive={activeSection === "cover"}
                        tooltip="Cover"
                      >
                        <span className={activeSection === "cover" ? "font-semibold" : ""}>Cover</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {sections.map((s) => {
                    const slug = `section-${s.id}`
                    const isActive = activeSection === slug
                    return (
                      <SidebarMenuItem key={s.id}>
                        <SidebarMenuButton
                          onClick={() => scrollToSection(s.id)}
                          isActive={isActive}
                          tooltip={s.section_title}
                        >
                          <span className={isActive ? "font-semibold" : ""}>{s.section_title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <SidebarInset className="bg-gray-50">
            <div className="w-full p-4 md:p-6 lg:p-8">
              {hasCover && (
                <section
                  id="cover"
                  ref={(el) => {
                    if (el) sectionRefs.current.set(0, el)
                  }}
                  className="scroll-mt-14"
                >
                  <DeckCover
                    studentName={studentName}
                    studentImage={studentImage}
                    lastEdited={lastEdited}
                    onNext={sections.length > 0 ? () => scrollToSection(sections[0].id) : undefined}
                  />
                </section>
              )}
              {sections.map((section, sectionIdx) => {
                const allSectionTemplates = templates
                  .filter((q) => qSectionId(q) === section.id)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                const backgroundQ = allSectionTemplates.find(isSectionBackgroundQuestion)
                const backgroundResp = backgroundQ ? responseMap.get(backgroundQ.id) : undefined
                // Only show a student-uploaded background once a teacher has approved it
                const studentBg = backgroundResp?.isComplete
                  ? backgroundResp.image_response?.path || backgroundResp.image_response?.url
                  : undefined
                const sectionTemplates = allSectionTemplates.filter(
                  (q) => !isSectionBackgroundQuestion(q) && !isCoverBackgroundQuestion(q)
                )
                const sectionGroups = groups
                  .filter((g) => g.businessthesis_sections_id === section.id)
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

                const ungroupedTemplates = sectionTemplates.filter(
                  (q) => !qGroupId(q)
                )
                const groupedMap = new Map<number, TemplateQuestion[]>()
                for (const q of sectionTemplates) {
                  const gid = qGroupId(q)
                  if (gid) {
                    const arr = groupedMap.get(gid) ?? []
                    arr.push(q)
                    groupedMap.set(gid, arr)
                  }
                }

                const desc = section.description || ""
                const photoUrl = studentBg
                  ? resolveImageUrl(studentBg)
                  : section.photo?.path
                    ? resolveImageUrl(section.photo.path)
                    : null

                return (
                  <section
                    key={section.id}
                    id={`section-${section.id}`}
                    ref={(el) => {
                      if (el) sectionRefs.current.set(section.id, el)
                    }}
                    className="mb-8 scroll-mt-14"
                  >
                    <SectionHero
                      title={section.section_title}
                      description={desc}
                      photoUrl={photoUrl}
                      sectionNumber={sectionIdx + 1}
                    />

                    <div className="mt-6 space-y-6">
                      {ungroupedTemplates.length > 0 && (
                        <UngroupedQuestions
                          questions={ungroupedTemplates}
                          responseMap={responseMap}
                        />
                      )}

                      {sectionGroups.length > 0 && (
                        <div className="grid items-stretch gap-6 md:grid-cols-6">
                          {sectionGroups.map((group) => {
                            const groupQuestions = groupedMap.get(group.id) ?? []
                            if (groupQuestions.length === 0) return null

                            const colSpan = getGroupColSpan(group.width)

                            if (isGroupDisplayType(group.businessthesis_group_display_types_id)) {
                              const isGoogleBudget = group.businessthesis_group_display_types_id === DISPLAY_TYPE.GOOGLE_BUDGET
                              const isTransportBudget = group.businessthesis_group_display_types_id === DISPLAY_TYPE.TRANSPORTATION_BUDGET
                              const sheetUrl = isGoogleBudget ? getGoogleSheetUrl(groupQuestions, responseMap) : ""
                              const displayColSpan = group.width ? colSpan : (isTransportBudget ? "md:col-span-3" : "md:col-span-6")
                              return (
                                <div key={group.id} className={`${displayColSpan} flex flex-col`}>
                                  <Card className="flex h-full flex-col border-gray-200 shadow-none">
                                    <CardHeader className="border-b">
                                      <div className="flex items-center justify-between gap-3">
                                        <CardTitle>{group.group_name}</CardTitle>
                                        <div className="flex items-center gap-2">
                                          <StatusBadge status={groupStatusOf(groupQuestions.map((q) => responseMap.get(q.id)))} />
                                          {isGoogleBudget && sheetUrl && <GoogleSheetOpenButton url={sheetUrl} />}
                                          {group.icon_name && <GroupIcon name={group.icon_name} />}
                                        </div>
                                      </div>
                                      {group.group_description && (
                                        <CardDescription>{group.group_description}</CardDescription>
                                      )}
                                    </CardHeader>
                                    <CardContent className="flex-1 px-5 pb-5 pt-4">
                                      <GroupDisplayRenderer
                                        displayTypeId={group.businessthesis_group_display_types_id!}
                                        questions={groupQuestions}
                                        responseMap={responseMap}
                                        mode="public"
                                      />
                                    </CardContent>
                                  </Card>
                                </div>
                              )
                            }

                            return (
                              <div key={group.id} className={`${colSpan} flex flex-col`}>
                                <GroupCard
                                  group={group}
                                  questions={groupQuestions}
                                  responseMap={responseMap}
                                />
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {sectionTemplates.length === 0 && (
                        <p className="text-muted-foreground py-8 text-center text-sm italic">
                          No content in this section yet.
                        </p>
                      )}
                    </div>
                  </section>
                )
              })}

              {sections.length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <p className="text-muted-foreground text-lg font-medium">
                    No Business Thesis data found.
                  </p>
                </div>
              )}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
    </BrandThemeProvider>
  )
}

function heroGradient(stops: [string, string, string], angle: number): string {
  return `linear-gradient(${angle}deg, ${stops[0]} 0%, ${stops[1]} 50%, ${stops[2]} 100%)`
}

function heroOverlay(stops: [string, string, string], angle: number): string {
  // hex8 alpha: F5 ≈ 0.96, D9 ≈ 0.85, F0 ≈ 0.94
  return `linear-gradient(${angle}deg, ${stops[0]}F5 0%, ${stops[1]}D9 50%, ${stops[2]}F0 100%)`
}

// Light brand wash for section photos so the image stays visible; text
// legibility comes from the bottom vignette rather than a heavy tint.
// hex8 alpha: 4D ≈ 0.30, 26 ≈ 0.15, 59 ≈ 0.35
function heroPhotoOverlay(stops: [string, string, string], angle: number): string {
  return `linear-gradient(${angle}deg, ${stops[0]}4D 0%, ${stops[1]}26 45%, ${stops[2]}59 100%)`
}

function DeckCover({
  studentName,
  studentImage,
  lastEdited,
  onNext,
}: {
  studentName: string
  studentImage?: string
  lastEdited?: Date | null
  onNext?: () => void
}) {
  const brand = useBrandTheme()
  if (!brand.companyName && !brand.logoUrl) return null

  const titleFont = brand.primaryFont ? { fontFamily: `"${brand.primaryFont}", inherit` } : undefined
  const taglineFont = brand.secondaryFont ? { fontFamily: `"${brand.secondaryFont}", inherit` } : undefined
  const monogramBg = brand.accent ?? "#1f2937"
  const accentBar = brand.accent ?? "rgba(255,255,255,0.45)"
  const contact = brand.contact
  const hasContact =
    !!(contact.email || contact.phone || contact.website || contact.location) || contact.socials.length > 0

  return (
    <div className="relative mb-8 flex min-h-[calc(100svh-var(--header-height)-1rem)] overflow-hidden rounded-2xl md:min-h-[calc(100svh-var(--header-height)-1.5rem)] lg:min-h-[calc(100svh-var(--header-height)-2rem)]">
      {brand.coverImageUrl && (
        <img
          src={brand.coverImageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: brand.coverImageUrl
            ? heroOverlay(brand.heroStops, 120)
            : heroGradient(brand.heroStops, 120),
        }}
      />
      {brand.accent && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(720px circle at 88% -12%, ${brand.accent}30, transparent 62%)`,
          }}
        />
      )}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

      <div className="relative z-10 flex w-full flex-col justify-between gap-14 p-7 md:p-11">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 shrink-0" style={{ background: accentBar }} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
              Senior Business Thesis
            </p>
          </div>
          {lastEdited && (
            <p className="shrink-0 text-right text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
              Last updated{" "}
              {lastEdited.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>

        <div>
          {brand.logoUrl ? (
            <div className="mb-6 size-20 overflow-hidden rounded-full border border-white/30 bg-white shadow-lg md:size-24">
              <img src={brand.logoUrl} alt={brand.companyName || "Company logo"} className="size-full object-cover" />
            </div>
          ) : (
            <div
              className="mb-6 flex size-20 items-center justify-center rounded-full border border-white/30 text-3xl font-bold shadow-lg md:size-24"
              style={{ background: monogramBg, color: inkFor(monogramBg) }}
            >
              {(brand.companyName || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <h1
            className="max-w-4xl text-balance text-4xl font-bold tracking-tight text-white sm:text-6xl"
            style={titleFont}
          >
            {brand.companyName || "Business Thesis"}
          </h1>
          {brand.tagline && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-xl" style={taglineFont}>
              {brand.tagline}
            </p>
          )}
          {studentName && (
            <div className="mt-5 flex items-center gap-2.5">
              {studentImage && (
                <img
                  src={studentImage}
                  alt={studentName}
                  className="size-8 shrink-0 rounded-full border border-white/30 object-cover shadow"
                />
              )}
              <p className="text-sm text-white/60">by {studentName}</p>
            </div>
          )}

          {onNext && (
            <button
              type="button"
              onClick={onNext}
              aria-label="Scroll to the first section"
              className="mt-7 flex size-11 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-sm transition-colors [animation-duration:2.5s] hover:bg-white/25 motion-safe:animate-bounce"
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}

          {hasContact && (
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-white/15 pt-4 text-xs text-white/60">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="transition-colors hover:text-white">
                  {contact.email}
                </a>
              )}
              {contact.phone && <span>{contact.phone}</span>}
              {contact.location && <span>{contact.location}</span>}
              {contact.website && (
                <a
                  href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  {contact.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {contact.socials.map((s) => (
                <span key={s.label}>
                  {s.label} <span className="text-white/80">{s.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {brand.palette.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex h-1.5">
          {brand.palette.map((c, i) => (
            <span key={i} className="flex-1" style={{ background: c }} />
          ))}
        </div>
      )}
    </div>
  )
}

function SectionHero({
  title,
  description,
  photoUrl,
  sectionNumber,
}: {
  title: string
  description: string
  photoUrl: string | null
  sectionNumber: number
}) {
  const brand = useBrandTheme()
  const gradientAngles = [135, 160, 45, 200, 100, 320, 170]
  const angle = gradientAngles[(sectionNumber - 1) % gradientAngles.length]

  const titleFont = brand.primaryFont ? { fontFamily: `"${brand.primaryFont}", inherit` } : undefined
  const accentBar = brand.accent ?? "rgba(255,255,255,0.45)"
  const num = String(sectionNumber).padStart(2, "0")

  return (
    <div className={`relative flex items-end overflow-hidden rounded-2xl ${photoUrl ? "min-h-[300px] sm:min-h-[380px]" : "min-h-[240px] sm:min-h-[300px]"}`}>
      {photoUrl ? (
        <>
          <img
            src={photoUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: heroPhotoOverlay(brand.heroStops, angle) }} />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: heroGradient(brand.heroStops, angle) }} />
      )}
      {/* bottom vignette anchors the text zone (stronger over photos where the
          top wash is light, so the title stays legible over a bright image) */}
      <div className={`absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t to-transparent ${photoUrl ? "from-black/80 via-black/35" : "from-black/55 via-black/15"}`} />
      {/* oversized ghost numeral */}
      <span
        aria-hidden
        className="absolute -top-7 right-3 select-none text-[8.5rem] font-black leading-none tracking-tighter text-white/[0.07] sm:-top-10 sm:text-[12rem]"
        style={titleFont}
      >
        {num}
      </span>

      <div className="relative z-10 w-full px-7 pb-8 pt-24 md:px-10 md:pb-10">
        <div className="flex items-center gap-3">
          <span className="h-px w-10 shrink-0" style={{ background: accentBar }} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70 tabular-nums">
            Section {num}
          </span>
        </div>
        <h2
          className="mt-3 max-w-3xl text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl"
          style={titleFont}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

function UngroupedQuestions({
  questions,
  responseMap,
}: {
  questions: TemplateQuestion[]
  responseMap: Map<number, StudentResponse>
}) {
  const filtered = questions.filter((q) => (q.question_types_id ?? q._question_types?.id) !== QUESTION_TYPE.SOURCE)
  if (filtered.length === 0) return null
  return (
    <div className="mb-10 grid items-stretch gap-6 md:grid-cols-6">
      {filtered.map((q) => {
        const typeId = q.question_types_id ?? q._question_types?.id ?? null
        const colSpan = getQuestionColSpan(q.width as number | null | undefined, isShortType(typeId))
        return (
          <div key={q.id} className={`${colSpan} flex flex-col`}>
            <QuestionBlock question={q} response={responseMap.get(q.id)} />
          </div>
        )
      })}
    </div>
  )
}

function formatCitation(r: StudentResponse): string {
  const parts: string[] = []
  if (r.author_name_or_publisher) parts.push(r.author_name_or_publisher + ".")
  if (r.title_of_source) parts.push(`\u201c${r.title_of_source}.\u201d`)
  if (r.date_of_publication) parts.push(formatDate(r.date_of_publication) + ",")
  return parts.join(" ")
}

function GroupCard({
  group,
  questions,
  responseMap,
}: {
  group: CustomGroup
  questions: TemplateQuestion[]
  responseMap: Map<number, StudentResponse>
}) {
  const brand = useBrandTheme()
  const regularQuestions = questions.filter((q) => (q.question_types_id ?? q._question_types?.id) !== QUESTION_TYPE.SOURCE)
  const sourceQuestions = questions.filter((q) => (q.question_types_id ?? q._question_types?.id) === QUESTION_TYPE.SOURCE)
  const sourceEntries = sourceQuestions
    .map((q) => ({ question: q, response: responseMap.get(q.id) }))
    .filter((e) => e.response?.isComplete && (e.response.source_link || e.response.title_of_source || e.response.author_name_or_publisher))
  const groupStatus = groupStatusOf(questions.map((q) => responseMap.get(q.id)))

  return (
    <Card className="flex h-full flex-col gap-0 border-gray-200 py-0 shadow-none">
      <CardHeader className="border-b pt-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{group.group_name}</CardTitle>
          <div className="flex items-center gap-2">
            <StatusBadge status={groupStatus} />
            {group.icon_name && <GroupIcon name={group.icon_name} />}
          </div>
        </div>
        {group.group_description && (
          <CardDescription>{group.group_description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className={`flex-1 px-5 pt-4 ${sourceEntries.length > 0 ? "pb-3" : "pb-5"}`}>
        <div className="grid items-stretch gap-5 md:grid-cols-6">
          {regularQuestions.map((q) => {
            const typeId = q.question_types_id ?? q._question_types?.id ?? null
            // Brand color questions render as a compact palette: 6 swatches per row
            const isColorQuestion =
              typeId === QUESTION_TYPE.SHORT_RESPONSE && /colou?r/i.test(q.field_label)
            const colSpan =
              !q.width && isColorQuestion
                ? "md:col-span-1"
                : getQuestionColSpan(q.width as number | null | undefined, isShortType(typeId))
            return (
              <div key={q.id} className={`${colSpan} flex flex-col`}>
                <QuestionBlock
                  question={q}
                  response={responseMap.get(q.id)}
                  compact
                />
              </div>
            )
          })}
        </div>
      </CardContent>
      {sourceEntries.length > 0 && (
        <div className="rounded-b-xl border-t bg-gray-50 px-5 py-3">
          <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold uppercase tracking-wider">Sources</p>
          <div className="space-y-1">
            {sourceEntries.map(({ question, response }) => {
              const r = response!
              const citation = formatCitation(r)
              return (
                <p key={question.id} className="text-muted-foreground text-xs leading-snug">
                  {citation}{" "}
                  {r.source_link && (
                    <a
                      href={r.source_link.startsWith("http") ? r.source_link : `https://${r.source_link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline break-all hover:opacity-80"
                      style={brand.hasBrand ? { color: brand.primaryInk } : undefined}
                    >
                      {r.source_link}
                    </a>
                  )}
                  {"."}
                </p>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}

function QuestionBlock({
  question,
  response,
  compact = false,
}: {
  question: TemplateQuestion
  response: StudentResponse | undefined
  compact?: boolean
}) {
  const isComplete = response?.isComplete === true
  // Field level surfaces only the in-progress states; a rendered field is
  // clearly done, so a "Complete" pill on every one would just be noise.
  const rawStatus = statusOf(response)
  const status = rawStatus === "complete" ? null : rawStatus
  const title = question.public_display_title || question.field_label
  const description = question.public_display_description || ""
  const typeId = question.question_types_id ?? question._question_types?.id ?? null

  const isImage = typeId === QUESTION_TYPE.IMAGE_UPLOAD
  const hasImageResponse = isImage && isComplete && (response?.image_response?.path || response?.image_response?.url)
  const hasTextResponse = !isImage && isComplete && response?.student_response

  const titleSize = compact ? "text-sm" : "text-base"

  if (isImage && hasImageResponse) {
    const imgSrc = response.image_response!.path || response.image_response!.url
    return (
      <Card className="flex h-full flex-col gap-0 border-gray-200 py-0 shadow-none">
        <CardContent className="flex-1 p-0">
          <ZoomableImage
            src={resolveImageUrl(imgSrc)}
            alt={title || "Student upload"}
            className="rounded-t-xl"
            imgClassName="h-full w-full object-cover"
            imgStyle={{ minHeight: compact ? "200px" : "280px" }}
            caption={title || description}
          />
        </CardContent>
        {(title || description || status) && (
          <CardFooter className="flex-col items-start gap-0.5 border-t-0 bg-white">
            <div className="flex w-full items-start justify-between gap-2">
              {title && <p className="text-muted-foreground text-xs">{title}</p>}
              <StatusBadge status={status} />
            </div>
            {description && <p className="text-muted-foreground/70 text-xs">{description}</p>}
          </CardFooter>
        )}
      </Card>
    )
  }

  if (!isComplete || (!hasImageResponse && !hasTextResponse)) {
    if (isImage) {
      return (
        <Card className="flex h-full flex-col gap-0 border-gray-200 py-0 shadow-none">
          <CardContent className="flex-1 p-0">
            <div className="flex h-full min-h-[160px] items-center justify-center rounded-t-xl bg-gray-100" />
          </CardContent>
          {(title || description || status) && (
            <CardFooter className="flex-col items-start gap-0.5 border-t-0 bg-white">
              <div className="flex w-full items-start justify-between gap-2">
                {title && <p className="text-muted-foreground text-xs">{title}</p>}
                <StatusBadge status={status} />
              </div>
              {description && <p className="text-muted-foreground/70 text-xs">{description}</p>}
            </CardFooter>
          )}
        </Card>
      )
    }
    return (
      <div className="flex h-full flex-col">
        {(title || status) && (
          <div className="flex items-start justify-between gap-2">
            {title && <h4 className={`${titleSize} text-muted-foreground font-medium`}>{title}</h4>}
            <StatusBadge status={status} />
          </div>
        )}
        {description && (
          <p className="text-muted-foreground/70 mt-1 text-xs leading-relaxed">{description}</p>
        )}
        <p className="text-muted-foreground/40 mt-2 text-sm italic">—</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {(title || status) && (
        <div className="flex items-start justify-between gap-2">
          {title && <h4 className={`${titleSize} text-muted-foreground font-medium`}>{title}</h4>}
          <StatusBadge status={status} />
        </div>
      )}
      {description && (
        <p className="text-muted-foreground/70 mt-1 text-xs leading-relaxed">{description}</p>
      )}
      <div className="mt-2 flex-1">
        <ResponseDisplay typeId={typeId} response={response} fieldLabel={question.field_label} />
      </div>
    </div>
  )
}

function ResponseDisplay({
  typeId,
  response,
  fieldLabel,
}: {
  typeId: number | null
  response: StudentResponse
  fieldLabel?: string
}) {
  const brand = useBrandTheme()
  const linkStyle = brand.hasBrand ? { color: brand.primaryInk } : undefined
  const text = response.student_response ?? ""

  if (typeId === QUESTION_TYPE.IMAGE_UPLOAD) {
    const img = response.image_response
    const src = img?.path || img?.url
    if (!src) {
      return <div className="flex min-h-[160px] items-center justify-center rounded-xl bg-gray-100" />
    }
    return (
      <Card className="flex h-full flex-col gap-0 border-gray-200 py-0 shadow-none">
        <CardContent className="flex-1 p-0">
          <ZoomableImage
            src={resolveImageUrl(src)}
            alt="Student upload"
            className="rounded-xl"
            imgClassName="h-full w-full object-cover"
            imgStyle={{ minHeight: "200px" }}
          />
        </CardContent>
      </Card>
    )
  }

  if (typeId === QUESTION_TYPE.URL) {
    if (!text) return <p className="text-muted-foreground text-sm italic">—</p>
    return (
      <a
        href={text.startsWith("http") ? text : `https://${text}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 underline decoration-current/30 underline-offset-4 transition-opacity hover:opacity-80"
        style={linkStyle}
      >
        {text}
        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      </a>
    )
  }

  if (typeId === QUESTION_TYPE.DATE) {
    const dateVal = response.date_response || text
    if (!dateVal) return <p className="text-muted-foreground text-sm italic">—</p>
    return <p className="text-foreground text-sm font-bold">{formatDate(dateVal)}</p>
  }

  if (typeId === QUESTION_TYPE.CURRENCY) {
    if (!text) return <p className="text-muted-foreground text-sm italic">—</p>
    return <p className="text-foreground text-lg font-bold tracking-tight">{formatCurrency(text)}</p>
  }

  if (typeId === QUESTION_TYPE.DROPDOWN) {
    if (!text) return <p className="text-muted-foreground text-sm italic">—</p>
    return (
      <span
        className="text-foreground inline-block rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium"
        style={brand.hasBrand ? { borderColor: brand.primaryInk, color: brand.primaryInk } : undefined}
      >
        {text}
      </span>
    )
  }

  if (typeId === QUESTION_TYPE.SOURCE) {
    const sl = response.source_link ?? ""
    const ts = response.title_of_source ?? ""
    const ap = response.author_name_or_publisher ?? ""
    const dp = response.date_of_publication ?? ""
    const hasAny = sl || ts || ap || dp
    if (!hasAny) return <p className="text-muted-foreground text-sm italic">—</p>
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Source Link</p>
          {sl ? (
            <a href={sl.startsWith("http") ? sl : `https://${sl}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 underline break-all hover:opacity-80" style={linkStyle}>{sl}</a>
          ) : <p className="text-muted-foreground text-sm">—</p>}
        </div>
        <div>
          <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Title</p>
          <p className="text-foreground text-sm font-bold">{ts || "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Author / Publisher</p>
          <p className="text-foreground text-sm font-bold">{ap || "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Date of Publication</p>
          <p className="text-foreground text-sm font-bold">{dp ? formatDate(dp) : "—"}</p>
        </div>
      </div>
    )
  }

  if (typeId === LINE_ITEMS_TYPE_ID) {
    return <LineItemsTable raw={text} />
  }

  if (!text) return <p className="text-muted-foreground text-sm italic">—</p>

  const brandColor =
    fieldLabel && /colou?r/i.test(fieldLabel) ? parseBrandColor(text) : parseExactHex(text)
  if (brandColor) {
    return <ColorSwatch color={brandColor} rawText={text} />
  }

  if (fieldLabel && /font/i.test(fieldLabel)) {
    return <FontPreview text={text} fieldLabel={fieldLabel} />
  }

  return (
    <p className="text-foreground whitespace-pre-wrap text-base font-normal leading-snug">
      {text}
    </p>
  )
}
