import StarterKit from "@tiptap/starter-kit"
import { TableKit } from "@tiptap/extension-table"
import { CommentMark } from "@/lib/rich-text-comment-mark"

/**
 * The single source of truth for which TipTap nodes/marks a rich-text essay
 * may contain. The editor and the read-only renderer (RichTextDisplay) MUST
 * use the same set — if the display lacks an extension the editor allows, a
 * stored doc using that node fails to render (blank / "—"), including on the
 * public pages. TableKit bundles Table + row/header/cell; the interactive
 * column-resize plugin is editor-only and is simply inert in the static render.
 * CommentMark must be present so inline-comment highlights round-trip through
 * the renderer; whether the highlight is *visible* is a CSS concern (hidden on
 * the public thesis — see .rt-comments-visible in globals.css).
 */
export const richTextExtensions = [StarterKit, TableKit, CommentMark]
