import { parseSources, type SourceEntry } from "@/lib/sources"

/**
 * A Source answer, read-only: each citation's four fields, numbered when
 * there's more than one. Used by the review page and the answer sheets.
 */
export function SourceListDisplay({
  response,
  entries: given,
  className,
}: {
  response?: Parameters<typeof parseSources>[0]
  entries?: SourceEntry[]
  className?: string
}) {
  const entries = given ?? parseSources(response)
  if (entries.length === 0) return <p className="text-muted-foreground text-sm">—</p>
  return (
    <ol className={className ? `space-y-4 ${className}` : "space-y-4"}>
      {entries.map((e, i) => (
        <li key={i} className="space-y-2">
          {entries.length > 1 && (
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">Source {i + 1}</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs font-medium">Source Link</p>
              {e.source_link ? (
                <a
                  href={e.source_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-blue-600 underline break-all hover:text-blue-800 dark:text-blue-400"
                >
                  {e.source_link}
                </a>
              ) : (
                <p className="text-muted-foreground text-sm">—</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Title of Source</p>
              <p className="text-sm font-semibold">{e.title_of_source || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Author / Publisher</p>
              <p className="text-sm font-semibold">{e.author_name_or_publisher || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Date of Publication</p>
              <p className="text-sm font-semibold">{e.date_of_publication || "—"}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
