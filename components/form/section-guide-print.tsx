"use client"

import { useEffect, useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft02Icon, PrinterIcon, SquareLock02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Markdown } from "@/components/markdown"
import { useSession } from "@/components/session-provider"
import { cachedFetch } from "@/lib/cached-fetch"
import type { FormApiConfig } from "@/lib/form-api-config"
import { cn } from "@/lib/utils"
import {
  buildSectionGuide,
  type GuideGroup,
  type GuideQuestion,
  type GuideSection,
} from "@/components/form/section-guide-sheet"

interface SectionRecord {
  id: number
  section_title: string
  description?: string
  section_description?: string
  isLocked?: boolean
  order?: number
}

interface GroupRecord {
  id: number
  group_name: string
  group_description?: string
  instructions?: string
  order?: number
  [key: string]: unknown
}

interface QuestionRecord {
  id: number
  field_label: string
  field_name: string
  isArchived: boolean
  isPublished: boolean
  sortOrder: number
  min_words?: number
  detailed_instructions?: string
  teacher_guideline?: string
  question_types_id?: number | null
  _question_types?: { id: number; type: string }
  [key: string]: unknown
}

const LABEL = "text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-500"

/**
 * The section guide as a US-Letter document: a cover with the project's
 * outline, then one page run per section listing its groups and every
 * question's type, length target and instructions. Staff and advisors also
 * get the teacher guidelines. On screen it previews as a white sheet; the
 * browser's print dialog produces the PDF.
 */
export function SectionGuidePrint({
  apiConfig,
  projectName,
  studentBasePath,
}: {
  apiConfig: FormApiConfig
  projectName: string
  /** Overview route for students, e.g. "/business-thesis". */
  studentBasePath: string
}) {
  const { data: session } = useSession()
  const role = session?.user.role
  const viewer: "student" | "teacher" = role && role !== "student" ? "teacher" : "student"
  const backHref = viewer === "teacher" ? apiConfig.adminBasePath : studentBasePath

  const [sections, setSections] = useState<SectionRecord[]>([])
  const [groups, setGroups] = useState<GroupRecord[]>([])
  const [questions, setQuestions] = useState<QuestionRecord[]>([])
  const [questionTypes, setQuestionTypes] = useState<{ id: number; type: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [sRes, gRes, qRes, tRes] = await Promise.all([
          cachedFetch(apiConfig.sectionsEndpoint),
          cachedFetch(apiConfig.customGroupEndpoint),
          cachedFetch(apiConfig.templateEndpoint),
          cachedFetch(apiConfig.questionTypesEndpoint),
        ])
        if (cancelled) return
        if (sRes.ok) {
          const data: SectionRecord[] = await sRes.json()
          setSections([...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
        }
        if (gRes.ok) setGroups(await gRes.json())
        if (qRes.ok) {
          const data: QuestionRecord[] = await qRes.json()
          setQuestions(data.filter((q) => !q.isArchived && q.isPublished))
        }
        if (tRes.ok) {
          const data = await tRes.json()
          if (Array.isArray(data)) setQuestionTypes(data)
        }
      } catch {
        /* the empty state below covers it */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [apiConfig])

  const F = apiConfig.fields
  const guide: GuideSection[] = useMemo(() => {
    const rows = sections.map((section) => ({
      section,
      groups: groups
        .filter((g) => Number(g[F.sectionId]) === section.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }))
    return buildSectionGuide(rows, questions, {
      sectionId: (q) => Number(q[F.sectionId] ?? 0),
      groupId: (q) => {
        const v = q[F.customGroupId]
        return v != null ? Number(v) || null : null
      },
      sectionDescription: (s) => s.section_description || s.description,
      typeName: (q) =>
        q._question_types?.type ??
        (q.question_types_id ? questionTypes.find((t) => t.id === q.question_types_id)?.type : undefined),
    })
  }, [sections, groups, questions, questionTypes, F.sectionId, F.customGroupId])

  const totals = useMemo(
    () => ({
      groups: guide.reduce((n, s) => n + s.groups.filter((g) => g.id !== null).length, 0),
      questions: guide.reduce((n, s) => n + s.groups.reduce((m, g) => m + g.questions.length, 0), 0),
      words: guide.reduce(
        (n, s) => n + s.groups.reduce((m, g) => m + g.questions.reduce((w, q) => w + (q.minWords ?? 0), 0), 0),
        0
      ),
    }),
    [guide]
  )

  const printedOn = useMemo(
    () => new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
    []
  )

  return (
    <div className="print-doc guide-print min-h-screen bg-gray-200/70 print:bg-white">
      {/* Letter sizing and fragmentation live here, not in globals.css: the
          @page rule should only exist while a print route is mounted, and
          Lightning CSS strips @page and break-* rules from the compiled
          stylesheet. */}
      <style>{`
        @page {
          size: letter;
          margin: 0.75in;
        }
        @media print {
          .guide-print [data-page] {
            break-before: page;
          }
          .guide-print [data-keep] {
            break-inside: avoid;
          }
          .guide-print h2, .guide-print h3, .guide-print h4 {
            break-after: avoid;
          }
        }
      `}</style>

      {/* Screen-only toolbar */}
      <div className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex w-[8.5in] max-w-full items-center justify-between gap-3 px-4 py-2.5">
          <Button variant="outline" size="sm" asChild className="gap-2 bg-white">
            <a href={backHref}>
              <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
              Back to overview
            </a>
          </Button>
          <p className="text-muted-foreground hidden text-xs sm:block">
            US Letter · use your browser&rsquo;s dialog to print or save as PDF
          </p>
          <Button size="sm" className="gap-2" onClick={() => window.print()} disabled={loading}>
            <HugeiconsIcon icon={PrinterIcon} strokeWidth={2} className="size-4" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      <div className="mx-auto w-[8.5in] max-w-full py-8 text-gray-900 print:w-auto print:max-w-none print:py-0">
        <div className="bg-white p-[0.75in] shadow-md ring-1 ring-black/5 print:p-0 print:shadow-none print:ring-0">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : guide.length === 0 ? (
            <p className="text-sm text-gray-500">No sections have been published yet.</p>
          ) : (
            <>
              {/* Cover + outline */}
              <header className="border-b-2 border-gray-900 pb-6">
                <p className={LABEL}>SailFuture Academy · {projectName}</p>
                <h1 className="mt-2 text-[28pt] leading-[1.1] font-bold tracking-tight">
                  Section Guide
                </h1>
                <p className="mt-3 max-w-[5.5in] text-[11pt] leading-relaxed text-gray-700">
                  The {projectName} is built from {guide.length} sections. Each section is a major
                  component of the finished work, made up of smaller groups of questions. This
                  guide lists what every section and group asks for, with the length target and
                  instructions for each question, so the work can be planned and reviewed on paper.
                </p>
                <dl className="mt-5 grid grid-cols-4 gap-4 text-[10pt]">
                  <Stat label="Sections" value={guide.length} />
                  <Stat label="Groups" value={totals.groups} />
                  <Stat label="Questions" value={totals.questions} />
                  <Stat label="Words minimum" value={totals.words.toLocaleString()} />
                </dl>
                <p className="mt-4 text-[9pt] text-gray-500">
                  Printed {printedOn}
                  {viewer === "teacher" && " · Includes teacher guidelines (staff copy)"}
                </p>
              </header>

              <section className="pt-6">
                <h2 className={LABEL}>Contents</h2>
                <ol className="mt-3 divide-y divide-gray-200">
                  {guide.map((s, i) => (
                    <li key={s.id} className="flex items-baseline gap-3 py-2 text-[11pt]">
                      <span className="w-6 shrink-0 tabular-nums text-gray-400">{i + 1}</span>
                      <span className="font-medium">{s.title}</span>
                      {s.locked && (
                        <HugeiconsIcon icon={SquareLock02Icon} strokeWidth={1.5} className="size-3.5 text-gray-400" />
                      )}
                      <span className="ml-auto shrink-0 text-[9.5pt] text-gray-500">{describeCounts(s)}</span>
                    </li>
                  ))}
                </ol>
              </section>

              {/* One page run per section */}
              {guide.map((section, index) => (
                <section key={section.id} data-page className="mt-10 print:mt-0">
                  <div className="border-b-2 border-gray-900 pb-4">
                    <p className={LABEL}>
                      Section {index + 1} of {guide.length}
                      {section.locked && " · Locked"}
                    </p>
                    <h2 className="mt-1 text-[20pt] leading-tight font-bold tracking-tight">{section.title}</h2>
                    <p className="mt-1 text-[9.5pt] text-gray-500">{describeCounts(section)}</p>
                  </div>

                  {section.description?.trim() && (
                    <div className="mt-5" data-keep>
                      <h3 className={LABEL}>What this section covers</h3>
                      <Markdown
                        text={section.description}
                        className="mt-1.5 text-[11pt] leading-relaxed [--tw-prose-body:theme(colors.gray.800)]"
                      />
                    </div>
                  )}

                  {section.groups.length === 0 ? (
                    <p className="mt-5 text-[10.5pt] text-gray-500">No questions published in this section yet.</p>
                  ) : (
                    <div className="mt-6 space-y-7">
                      {section.groups.map((group, gi) => (
                        <GroupBlock key={group.id ?? `ungrouped-${section.id}`} group={group} index={gi} viewer={viewer} />
                      ))}
                    </div>
                  )}
                </section>
              ))}

              <footer className="mt-10 border-t border-gray-200 pt-3 text-[8.5pt] text-gray-400">
                {projectName} Section Guide · SailFuture Academy · {printedOn}
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className={LABEL}>{label}</dt>
      <dd className="mt-0.5 text-[16pt] font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function describeCounts(section: GuideSection): string {
  const groups = section.groups.filter((g) => g.id !== null).length
  const questions = section.groups.reduce((n, g) => n + g.questions.length, 0)
  const parts: string[] = []
  if (groups > 0) parts.push(`${groups} group${groups === 1 ? "" : "s"}`)
  parts.push(`${questions} question${questions === 1 ? "" : "s"}`)
  return parts.join(" · ")
}

function GroupBlock({
  group,
  index,
  viewer,
}: {
  group: GuideGroup
  index: number
  viewer: "student" | "teacher"
}) {
  const wordTotal = group.questions.reduce((n, q) => n + (q.minWords ?? 0), 0)
  return (
    <div className="border-l-2 border-gray-300 pl-4">
      <div data-keep>
        <p className={LABEL}>{group.id === null ? "Also in this section" : `Group ${index + 1}`}</p>
        <h3 className="text-[13.5pt] leading-snug font-semibold">{group.name}</h3>
        <p className="mt-0.5 text-[9.5pt] text-gray-500">
          {group.questions.length} question{group.questions.length === 1 ? "" : "s"}
          {wordTotal > 0 && ` · at least ${wordTotal.toLocaleString()} words in total`}
        </p>
        {group.description?.trim() && (
          <Markdown
            text={group.description}
            className="mt-2 text-[10.5pt] leading-relaxed [--tw-prose-body:theme(colors.gray.700)]"
          />
        )}
        {group.instructions?.trim() && (
          <div className="mt-3 rounded border border-gray-200 bg-gray-50 px-3.5 py-3">
            <p className={cn(LABEL, "mb-1")}>Group instructions</p>
            <Markdown text={group.instructions} className="text-[10.5pt] leading-relaxed" />
          </div>
        )}
      </div>

      {group.questions.length > 0 && (
        <ol className="mt-4 space-y-3">
          {group.questions.map((q, qi) => (
            <QuestionBlock key={q.id} question={q} index={qi} viewer={viewer} />
          ))}
        </ol>
      )}
    </div>
  )
}

function QuestionBlock({
  question: q,
  index,
  viewer,
}: {
  question: GuideQuestion
  index: number
  viewer: "student" | "teacher"
}) {
  const meta: string[] = []
  if (q.typeName) meta.push(q.typeName)
  if ((q.minWords ?? 0) > 0) meta.push(`${q.minWords} words minimum`)
  return (
    // Long instructions may run past a page, so only the title and its meta
    // line are kept together; the body is free to flow across the break.
    <li className="rounded border border-gray-200 px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-px shrink-0 text-[10pt] tabular-nums text-gray-400">{index + 1}.</span>
        <div className="min-w-0 flex-1">
          <div data-keep>
            <h4 className="text-[11pt] leading-snug font-semibold">{q.label}</h4>
            {meta.length > 0 && <p className="mt-0.5 text-[9.5pt] text-gray-500">{meta.join(" · ")}</p>}
          </div>
          {q.instructions?.trim() && (
            <Markdown
              text={q.instructions}
              className="mt-2 text-[10pt] leading-relaxed [--tw-prose-body:theme(colors.gray.700)]"
            />
          )}
          {viewer === "teacher" && q.teacherGuideline?.trim() && (
            <div className="mt-2.5 border-l-2 border-amber-400 bg-amber-50 py-2 pr-3 pl-3">
              <p className={cn(LABEL, "mb-1 text-amber-800")}>Teacher guideline</p>
              <Markdown text={q.teacherGuideline} className="text-[10pt] leading-relaxed" />
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
