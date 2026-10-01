import ReactMarkdown from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

// Instructions written before Markdown support were plain text, often pasted
// from a doc with indented lines. Markdown would turn a 4-space indent into a
// code block, so that one rule is switched off; fenced ``` blocks still work.
function remarkNoIndentedCode(this: { data(): object }) {
  const data = this.data() as { micromarkExtensions?: unknown[] }
  const extensions = data.micromarkExtensions ?? (data.micromarkExtensions = [])
  extensions.push({ disable: { null: ["codeIndented"] } })
}

/**
 * Renders teacher-authored text (question and group instructions) as
 * Markdown: headings, bold/italic, lists, links, quotes and tables. Single
 * line breaks are kept, so plain text written without Markdown in mind reads
 * the way it was typed. Raw HTML is not rendered.
 */
export function Markdown({
  text,
  className,
}: {
  text: string | null | undefined
  className?: string
}) {
  if (!text?.trim()) return null

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none break-words",
        // Instructions sit in side panels and under titles, so headings stay
        // close to body size instead of prose's page-title scale.
        "prose-headings:font-semibold prose-headings:tracking-tight prose-h1:mt-5 prose-h1:mb-2 prose-h1:text-base prose-h2:mt-5 prose-h2:mb-2 prose-h2:text-[15px] prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:text-sm prose-h4:text-sm",
        "prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-blockquote:my-3 prose-hr:my-4",
        "prose-a:text-blue-600 prose-a:underline-offset-2 dark:prose-a:text-blue-400",
        "[&>:first-child]:mt-0 [&>:last-child]:mb-0",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkNoIndentedCode]}
        components={{
          a: ({ href, title, children }) => (
            <a
              href={href}
              title={title}
              target="_blank"
              rel="noopener noreferrer"
              // Stop the click from also triggering the row/header it sits inside.
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
