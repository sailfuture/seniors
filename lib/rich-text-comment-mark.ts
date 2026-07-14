import { Mark, mergeAttributes } from "@tiptap/core"

/**
 * Inline-comment highlight. A `comment` mark wraps a text range and carries the
 * `threadId` of the discussion attached to it. Because it lives in the document
 * as a mark, the highlight moves with the text as the essay is edited — no
 * fragile character-offset anchoring. The thread's messages live in the Xano
 * comments table keyed by this same threadId (see lib/inline-comments).
 *
 * Rendered as <span class="rt-comment" data-thread-id="…">, so the same mark
 * shows in the editor and in the static read-only renderer (RichTextDisplay).
 */
export interface CommentMarkOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      /** Wrap the current selection in a comment highlight for `threadId`. */
      setCommentThread: (threadId: string) => ReturnType
      /** Remove the comment highlight (used when a thread is resolved). */
      unsetCommentThread: () => ReturnType
    }
  }
}

export const COMMENT_MARK_NAME = "comment"

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: COMMENT_MARK_NAME,

  addOptions() {
    return { HTMLAttributes: {} }
  },

  // Typing at the edge of a highlight should not extend it.
  inclusive() {
    return false
  },

  // Overlapping highlights would nest ambiguously; keep one thread per range.
  excludes() {
    return this.name
  },

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-thread-id"),
        renderHTML: (attrs) =>
          attrs.threadId ? { "data-thread-id": attrs.threadId } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-thread-id]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, { class: "rt-comment" }, HTMLAttributes),
      0,
    ]
  },

  addCommands() {
    return {
      setCommentThread:
        (threadId: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { threadId }),
      unsetCommentThread:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})
