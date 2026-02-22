"use client"

import { use, useCallback, useEffect, useRef, useState } from "react"
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

const XANO_BASE =
  process.env.NEXT_PUBLIC_XANO_API_BASE ??
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:o2_UyOKn"

const SECTIONS_ENDPOINT = `${XANO_BASE}/lifemap_sections`
const TEMPLATE_ENDPOINT = `${XANO_BASE}/lifeplan_template`
const RESPONSES_ENDPOINT = `${XANO_BASE}/lifemap_responses_by_student`
const CUSTOM_GROUP_ENDPOINT = `${XANO_BASE}/lifemap_custom_group`
const STUDENTS_ENDPOINT =
  "https://xsc3-mvx7-r86m.n7e.xano.io/api:fJsHVIeC/get_active_students_email"

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
  lifemap_sections_id?: number
  lifemap_custom_group_id?: number | null
}

interface CustomGroup {
  id: number
  group_name: string
  group_description: string
  lifemap_sections_id: number
  order?: number
  lifemap_group_display_types_id?: number | null
}

const QUESTION_TYPE = {
  LONG_RESPONSE: 1,
  SHORT_RESPONSE: 2,
  CURRENCY: 3,
  IMAGE_UPLOAD: 4,
  DROPDOWN: 5,
  URL: 6,
  DATE: 7,
} as const

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

function isShortType(typeId: number | null): boolean {
  return typeId === QUESTION_TYPE.SHORT_RESPONSE ||
    typeId === QUESTION_TYPE.CURRENCY ||
    typeId === QUESTION_TYPE.DROPDOWN ||
    typeId === QUESTION_TYPE.URL ||
    typeId === QUESTION_TYPE.DATE
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
        const data: LifeMapSection[] = await sectionsRes.json()
        setSections(data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
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
        const students: { id: string; firstName: string; lastName: string; profileImage?: string }[] =
          await studentsRes.json()
        const match = students.find((s) => s.id === studentId)
        if (match) {
          setStudentName(`${match.firstName} ${match.lastName}`)
          if (match.profileImage) setStudentImage(match.profileImage)
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
    responseMap.set(r.lifemap_template_id, r)
  }

  if (loading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="border-muted-foreground/30 border-t-foreground h-8 w-8 animate-spin rounded-full border-2" />
          <p className="text-muted-foreground text-sm">Loading Life Map...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="[--header-height:calc(var(--spacing)*14)]">
      <SidebarProvider className="flex flex-col">
        {/* Fixed top header */}
        <header className="bg-background sticky top-0 z-50 flex w-full items-center border-b">
          <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
            <span className="text-sm font-semibold tracking-tight">SailFuture Academy</span>
            <Separator orientation="vertical" className="mx-2 data-vertical:h-4 data-vertical:self-auto" />
            <span className="text-muted-foreground text-sm">Life Map</span>
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
          {/* Sidebar */}
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
                      <span className="text-muted-foreground text-xs">Life Map</span>
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

          {/* Main content */}
          <SidebarInset className="bg-gray-50">
            <div className="w-full p-4 md:p-6 lg:p-8">
              {sections.map((section) => {
                const sectionTemplates = templates
                  .filter((q) => q.lifemap_sections_id === section.id)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                const sectionGroups = groups
                  .filter((g) => g.lifemap_sections_id === section.id)
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

                const ungroupedTemplates = sectionTemplates.filter(
                  (q) => !q.lifemap_custom_group_id
                )
                const groupedMap = new Map<number, TemplateQuestion[]>()
                for (const q of sectionTemplates) {
                  if (q.lifemap_custom_group_id) {
                    const arr = groupedMap.get(q.lifemap_custom_group_id) ?? []
                    arr.push(q)
                    groupedMap.set(q.lifemap_custom_group_id, arr)
                  }
                }

                const desc = section.section_description || section.description || ""
                const photoUrl = section.photo?.path
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
                      sectionNumber={section.order ?? 0}
                    />

                    <div className="mt-6 space-y-6">
                      {ungroupedTemplates.length > 0 && (
                        <UngroupedQuestions
                          questions={ungroupedTemplates}
                          responseMap={responseMap}
                        />
                      )}

                      {sectionGroups.length > 0 && (
                        <div className="grid gap-6 md:grid-cols-2">
                          {sectionGroups.map((group) => {
                            const groupQuestions = groupedMap.get(group.id) ?? []
                            if (groupQuestions.length === 0) return null

                            if (isGroupDisplayType(group.lifemap_group_display_types_id)) {
                              const isGoogleBudget = group.lifemap_group_display_types_id === DISPLAY_TYPE.GOOGLE_BUDGET
                              const isTransportBudget = group.lifemap_group_display_types_id === DISPLAY_TYPE.TRANSPORTATION_BUDGET
                              const sheetUrl = isGoogleBudget ? getGoogleSheetUrl(groupQuestions, responseMap) : ""
                              return (
                                <div key={group.id} className={isTransportBudget ? "md:col-span-1" : "md:col-span-2"}>
                                  <Card className="border-gray-200 shadow-none">
                                    <CardHeader className="border-b">
                                      <div className="flex items-center justify-between">
                                        <CardTitle>{group.group_name}</CardTitle>
                                        {isGoogleBudget && sheetUrl && <GoogleSheetOpenButton url={sheetUrl} />}
                                      </div>
                                      {group.group_description && (
                                        <CardDescription>{group.group_description}</CardDescription>
                                      )}
                                    </CardHeader>
                                    <CardContent className="px-5 pb-5 pt-4">
                                      <GroupDisplayRenderer
                                        displayTypeId={group.lifemap_group_display_types_id!}
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
                              <GroupCard
                                key={group.id}
                                group={group}
                                questions={groupQuestions}
                                responseMap={responseMap}
                              />
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
                    No Life Map data found.
                  </p>
                </div>
              )}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
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
  const badge = (
    <span className="mb-3 inline-block rounded bg-white/20 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-white">
      Section {sectionNumber}
    </span>
  )

  if (photoUrl) {
    return (
      <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden rounded-xl sm:min-h-[340px]">
        <img
          src={photoUrl}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/65 to-black/35" />
        <div className="relative z-10 px-6 py-8 text-center md:px-12 lg:px-16">
          {badge}
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {title}
          </h2>
          {description && (
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-snug text-white/80 sm:text-base sm:leading-normal">
              {description}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-xl bg-slate-900 px-6 py-8 sm:min-h-[240px] md:px-12 lg:px-16">
      <div className="text-center">
        {badge}
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        {description && (
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-snug text-white/70 sm:text-base sm:leading-normal">
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
  const items: { question: TemplateQuestion; short: boolean }[] = questions.map((q) => {
    const typeId = q.question_types_id ?? q._question_types?.id ?? null
    return { question: q, short: isShortType(typeId) }
  })

  const rendered: React.ReactNode[] = []
  let i = 0
  while (i < items.length) {
    const curr = items[i]
    if (!curr.short) {
      rendered.push(
        <QuestionBlock key={curr.question.id} question={curr.question} response={responseMap.get(curr.question.id)} />
      )
      i++
      continue
    }
    const shortRun: TemplateQuestion[] = [curr.question]
    let j = i + 1
    while (j < items.length && items[j].short) {
      shortRun.push(items[j].question)
      j++
    }
    if (shortRun.length >= 2) {
      rendered.push(
        <div key={`short-${shortRun[0].id}`} className="grid gap-6 md:grid-cols-2">
          {shortRun.map((q) => (
            <QuestionBlock key={q.id} question={q} response={responseMap.get(q.id)} />
          ))}
        </div>
      )
    } else {
      rendered.push(
        <QuestionBlock key={shortRun[0].id} question={shortRun[0]} response={responseMap.get(shortRun[0].id)} />
      )
    }
    i = j
  }

  return <div className="mb-10 space-y-6">{rendered}</div>
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
  const shortQuestions = questions.filter((q) => {
    const typeId = q.question_types_id ?? q._question_types?.id ?? null
    return isShortType(typeId)
  })
  const fullQuestions = questions.filter((q) => {
    const typeId = q.question_types_id ?? q._question_types?.id ?? null
    return !isShortType(typeId)
  })

  return (
    <Card className="border-gray-200 shadow-none">
      <CardHeader className="border-b">
        <CardTitle>{group.group_name}</CardTitle>
        {group.group_description && (
          <CardDescription>{group.group_description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-1">
        <div className="space-y-5">
          {fullQuestions.map((q) => (
            <QuestionBlock
              key={q.id}
              question={q}
              response={responseMap.get(q.id)}
              compact
            />
          ))}

          {shortQuestions.length > 0 && (
            <div className={shortQuestions.length >= 2 ? "grid gap-5 md:grid-cols-2" : ""}>
              {shortQuestions.map((q) => (
                <QuestionBlock
                  key={q.id}
                  question={q}
                  response={responseMap.get(q.id)}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
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
      <Card className="gap-0 border-gray-200 py-0 shadow-none">
        <CardContent className="p-0">
          <img
            src={resolveImageUrl(imgSrc)}
            alt={title || "Student upload"}
            className="w-full rounded-t-xl object-cover"
            style={{ maxHeight: compact ? "280px" : "480px" }}
          />
        </CardContent>
        {(title || description) && (
          <CardFooter className="flex-col items-start gap-0.5 border-t-0 bg-white">
            {title && <p className="text-muted-foreground text-xs">{title}</p>}
            {description && <p className="text-muted-foreground/70 text-xs">{description}</p>}
          </CardFooter>
        )}
      </Card>
    )
  }

  if (!isComplete || (!hasImageResponse && !hasTextResponse)) {
    if (isImage) {
      return (
        <Card className="gap-0 border-gray-200 py-0 shadow-none">
          <CardContent className="p-0">
            <div className="flex min-h-[160px] items-center justify-center rounded-t-xl bg-gray-100" />
          </CardContent>
          {(title || description) && (
            <CardFooter className="flex-col items-start gap-0.5 border-t-0 bg-white">
              {title && <p className="text-muted-foreground text-xs">{title}</p>}
              {description && <p className="text-muted-foreground/70 text-xs">{description}</p>}
            </CardFooter>
          )}
        </Card>
      )
    }
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        {title && <h4 className={`${titleSize} text-muted-foreground font-medium`}>{title}</h4>}
        {description && (
          <p className="text-muted-foreground/70 mt-1 text-xs leading-relaxed">{description}</p>
        )}
        <p className="text-muted-foreground/40 mt-2 text-sm italic">—</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      {title && <h4 className={`${titleSize} text-muted-foreground font-medium`}>{title}</h4>}
      {description && (
        <p className="text-muted-foreground/70 mt-1 text-xs leading-relaxed">{description}</p>
      )}
      <div className="mt-2">
        <ResponseDisplay typeId={typeId} response={response} />
      </div>
    </div>
  )
}

function ResponseDisplay({
  typeId,
  response,
}: {
  typeId: number | null
  response: StudentResponse
}) {
  const text = response.student_response ?? ""

  if (typeId === QUESTION_TYPE.IMAGE_UPLOAD) {
    const img = response.image_response
    const src = img?.path || img?.url
    if (!src) {
      return <div className="flex min-h-[160px] items-center justify-center rounded-xl bg-gray-100" />
    }
    return (
      <Card className="gap-0 border-gray-200 py-0 shadow-none">
        <CardContent className="p-0">
          <img
            src={resolveImageUrl(src)}
            alt="Student upload"
            className="w-full rounded-xl object-cover"
            style={{ maxHeight: "480px" }}
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
        className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 underline decoration-blue-600/30 underline-offset-4 transition-colors hover:text-blue-800 hover:decoration-blue-800/50"
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
      <span className="text-foreground inline-block rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium">
        {text}
      </span>
    )
  }

  if (!text) return <p className="text-muted-foreground text-sm italic">—</p>
  return (
    <p className="text-foreground whitespace-pre-wrap text-sm font-semibold leading-relaxed sm:text-base sm:leading-7">
      {text}
    </p>
  )
}
