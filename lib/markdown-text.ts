/**
 * Markdown written in the instructions editor, reduced to its words — for
 * one-line previews, table cells and designed public pages, where rendered
 * headings and lists don't fit and raw `**` would show. Line breaks are kept.
 */
export function markdownToPlainText(markdown: string | null | undefined): string {
  if (!markdown) return ""
  return (
    markdown
      // Links and images keep their text.
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Block markers at the start of a line: headings, quotes, list bullets
      // and numbers, and dividers.
      .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
      .replace(/^[ \t]*>[ \t]?/gm, "")
      .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, "")
      .replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, "")
      // Emphasis. An opening marker can't be followed by a space, so "5 * 3"
      // is left alone; underscores only count at word edges, as in Markdown.
      .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "$2")
      .replace(/\*(?=\S)([^*\n]*?\S)\*/g, "$1")
      .replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, "$1$2")
      .replace(/~~(?=\S)([\s\S]*?\S)~~/g, "$1")
      .replace(/`([^`\n]+)`/g, "$1")
      // Backslash escapes the editor adds to literal punctuation.
      .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, "$1")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  )
}
