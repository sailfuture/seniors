"use client"

import { useMemo, useSyncExternalStore } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft02Icon, PrinterIcon, SquareLock02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { describeRubricSection, rubricCounts } from "@/lib/rubric"
import { RubricSectionBody, rubricHref, useRubric, type RubricProduct } from "@/components/form/rubric"

const LABEL = "text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-500"

// The query string never changes while the print page is open.
const subscribeNoop = () => () => {}

/**
 * The rubric as a US-Letter document: a cover with the outline, then one
 * page per section with its key components and questions. On screen it
 * previews as a white sheet; the browser's print dialog produces the PDF.
 */
export function RubricPrint({ product }: { product: RubricProduct }) {
  const { sections: all, loading } = useRubric(product)

  // ?section=<slug> prints one section only (the section page's sheet links
  // here). Read as a browser-only snapshot: the server render sees null, and
  // the client picks up the real value without a setState in an effect.
  const onlySlug = useSyncExternalStore(
    subscribeNoop,
    () => new URLSearchParams(window.location.search).get("section"),
    () => null
  )
  const sections = useMemo(
    () => (onlySlug ? all.filter((s) => s.slug === onlySlug) : all),
    [all, onlySlug]
  )
  const single = onlySlug ? sections[0] : undefined
  const backHref = single ? `${product.basePath}/${single.slug}` : rubricHref(product)

  const totals = useMemo(
    () =>
      sections.reduce(
        (acc, s) => {
          const c = rubricCounts(s)
          return { components: acc.components + c.components, questions: acc.questions + c.questions, words: acc.words + c.words }
        },
        { components: 0, questions: 0, words: 0 }
      ),
    [sections]
  )

  const printedOn = useMemo(
    () => new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
    []
  )

  return (
    <div className="print-doc rubric-print min-h-screen bg-gray-200/70 print:bg-white">
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
          .rubric-print [data-page] {
            break-before: page;
          }
          .rubric-print [data-keep] {
            break-inside: avoid;
          }
          .rubric-print h2, .rubric-print h3 {
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
              {single ? "Back to section" : "Back to rubric"}
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
          ) : sections.length === 0 ? (
            <p className="text-sm text-gray-500">
              {onlySlug ? "This section was not found in the template." : "No sections have been published yet."}
            </p>
          ) : single ? (
            // One section: its own header, then the same body as the page.
            <>
              <header className="border-b-2 border-gray-900 pb-5">
                <p className={LABEL}>
                  SailFuture Academy · {product.name} rubric · Section {all.indexOf(single) + 1} of {all.length}
                </p>
                <h1 className="mt-2 text-[24pt] leading-[1.1] font-bold tracking-tight">{single.title}</h1>
                <p className="mt-2 text-[10pt] text-gray-500">
                  {describeRubricSection(single)} · Printed {printedOn}
                </p>
              </header>
              <div className="pt-6">
                <RubricSectionBody section={single} tone="print" />
              </div>
              <footer className="mt-10 border-t border-gray-200 pt-3 text-[8.5pt] text-gray-400">
                {product.name} Rubric · {single.title} · SailFuture Academy · {printedOn}
              </footer>
            </>
          ) : (
            <>
              <header className="border-b-2 border-gray-900 pb-6">
                <p className={LABEL}>SailFuture Academy · {product.name}</p>
                <h1 className="mt-2 text-[28pt] leading-[1.1] font-bold tracking-tight">Rubric</h1>
                <p className="mt-3 max-w-[5.5in] text-[11pt] leading-relaxed text-gray-700">
                  The {product.name} is built from {sections.length} sections. Each section is a major
                  component of the finished work. For every section, this rubric explains what it
                  must accomplish and how it is scored from 1 to 4.
                </p>
                <dl className="mt-5 grid grid-cols-4 gap-4 text-[10pt]">
                  <Stat label="Sections" value={sections.length} />
                  <Stat label="Groups" value={totals.components} />
                  <Stat label="Questions" value={totals.questions} />
                  <Stat label="Words minimum" value={totals.words.toLocaleString()} />
                </dl>
                <p className="mt-4 text-[9pt] text-gray-500">Printed {printedOn}</p>
              </header>

              <section className="pt-6">
                <h2 className={LABEL}>Contents</h2>
                <ol className="mt-3 divide-y divide-gray-200">
                  {sections.map((s, i) => (
                    <li key={s.id} className="flex items-baseline gap-3 py-2 text-[11pt]">
                      <span className="w-6 shrink-0 tabular-nums text-gray-400">{i + 1}</span>
                      <span className="font-medium">{s.title}</span>
                      {s.locked && (
                        <HugeiconsIcon icon={SquareLock02Icon} strokeWidth={1.5} className="size-3.5 text-gray-400" />
                      )}
                      <span className="ml-auto shrink-0 text-[9.5pt] text-gray-500">{describeRubricSection(s)}</span>
                    </li>
                  ))}
                </ol>
              </section>

              {sections.map((section, index) => (
                <section key={section.id} data-page className="mt-10 print:mt-0">
                  <div className="mb-5 border-b-2 border-gray-900 pb-4">
                    <p className={LABEL}>
                      Section {index + 1} of {sections.length}
                      {section.locked && " · Locked"}
                    </p>
                    <h2 className="mt-1 text-[20pt] leading-tight font-bold tracking-tight">{section.title}</h2>
                    <p className="mt-1 text-[9.5pt] text-gray-500">{describeRubricSection(section)}</p>
                  </div>
                  <RubricSectionBody section={section} tone="print" />
                </section>
              ))}

              <footer className="mt-10 border-t border-gray-200 pt-3 text-[8.5pt] text-gray-400">
                {product.name} Rubric · SailFuture Academy · {printedOn}
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
