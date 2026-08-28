"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react"
import { Placeholder } from "@tiptap/extensions"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  TextQuote,
  Minus,
  Table as TableIcon,
  MessageSquarePlus,
  MessageSquareText,
  Undo2,
  Redo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { FieldActivityStream } from "./field-activity-stream"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { parseRichText, serializeRichText, type RichTextDoc } from "@/lib/rich-text"
import { richTextExtensions } from "@/lib/rich-text-extensions"
import { COMMENT_MARK_NAME } from "@/lib/rich-text-comment-mark"
import { useInlineComments, generateThreadId, type InlineThread } from "@/lib/inline-comments"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

export interface RichTextCommentConfig {
  commentsEndpoint: string
  /** Section FK on the comments table, e.g. "lifemap_sections_id". */
  sectionIdField: string
  studentId: string
  sectionId: number
  fieldName: string
  /** The question's template id — field names can repeat across questions. */
  templateId?: number
  /** Template FK on the comments table, e.g. "lifemap_template_id". */
  templateIdField?: string
  viewer: "teacher" | "student"
  authorName: string
  teachersId?: string | null
}

const DISABLED_COMMENTS = {
  commentsEndpoint: "",
  sectionIdField: "",
  studentId: null as unknown as string,
  sectionId: 0,
  fieldName: "",
  viewer: "student" as const,
  authorName: "",
}

/** Every span carrying a thread's mark, so resolve unsets exactly those and
 *  never a neighbor thread — even when the highlight is split or duplicated. */
function threadMarkRanges(editor: Editor, threadId: string): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (
      node.isText &&
      node.marks.some((m) => m.type.name === COMMENT_MARK_NAME && m.attrs.threadId === threadId)
    ) {
      ranges.push({ from: pos, to: pos + node.nodeSize })
    }
  })
  return ranges
}

/** True when any text in [from, to) already carries a comment mark — new
 *  threads must not overlap an existing highlight (the marks exclude each
 *  other, so overlap would silently eat part of the older thread). */
function rangeOverlapsComment(editor: Editor, from: number, to: number): boolean {
  let overlaps = false
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (overlaps) return false
    if (node.isText && node.marks.some((m) => m.type.name === COMMENT_MARK_NAME)) {
      overlaps = true
      return false
    }
    return true
  })
  return overlaps
}

/** A comment being composed for a fresh selection; the highlight mark is only
 *  applied once its first message persists. */
interface PendingThread {
  threadId: string
  range: { from: number; to: number }
  quote: string
}

/**
 * Controlled TipTap editor: `value` is the serialized JSON string stored in
 * student_response ("" when empty), mirroring the LineItemsInput contract so
 * it plugs into the standard dirty/debounce/autosave path unchanged.
 *
 * Pass `comments` to enable inline anchored comments: highlight text and
 * "Comment" to start a thread, click a highlight to reply/resolve. `annotateOnly`
 * (teacher) permits adding comment highlights while blocking prose edits.
 */
export function RichTextEditor({
  value,
  onChange,
  onBlur,
  disabled = false,
  placeholder,
  className,
  comments,
  annotateOnly = false,
  minHeightClass = "min-h-[55vh]",
  bodyClassName = "px-6 py-8 sm:px-10",
  showThreadList = false,
  toolbarRight,
  toolbarLeft,
  commentsSheetOpen,
  onCommentsSheetOpenChange,
  showCommentsButton = true,
  onCommentCounts,
}: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  placeholder?: string
  className?: string
  comments?: RichTextCommentConfig
  annotateOnly?: boolean
  /** Editor body min-height (a full page by default; pass min-h-0 when inline). */
  minHeightClass?: string
  /** Padding around the document body — its page margins. */
  bodyClassName?: string
  /** List every open inline-comment thread below the document (quoted text
   *  plus the whole exchange), so no comment can hide in a highlight. */
  showThreadList?: boolean
  /** Right-aligned slot in the toolbar (word count, status, …). Rendered in a
   *  slim bar of its own when the editing toolbar is hidden. */
  toolbarRight?: React.ReactNode
  /** Left-aligned slot (save status, submit actions). Stays interactive even
   *  when the document itself is disabled and dimmed. */
  toolbarLeft?: React.ReactNode
  /** Control the comments sheet from outside (e.g. a page-header button). */
  commentsSheetOpen?: boolean
  onCommentsSheetOpenChange?: (open: boolean) => void
  /** Hide the toolbar Comments button when the page renders its own. */
  showCommentsButton?: boolean
  /** Reports thread counts so an external button can badge itself. */
  onCommentCounts?: (counts: { open: number; unread: number }) => void
}) {
  const lastEmitted = useRef(value)
  const [loadError, setLoadError] = useState(false)
  const loadErrorRef = useRef(false)
  const markLoadError = () => {
    loadErrorRef.current = true
    setLoadError(true)
  }

  const commentsEnabled = !!comments
  const inline = useInlineComments(comments ?? DISABLED_COMMENTS)
  // Floating "Comment" chip that follows a non-empty selection, so starting a
  // thread never requires reaching up to the toolbar.
  const [selTooltip, setSelTooltip] = useState<{ x: number; y: number } | null>(null)
  // Sheet state: open flag (controllable from outside), which tab, which
  // thread (null = the list), and a thread being composed for a selection.
  const [threadsOpenInternal, setThreadsOpenInternal] = useState(false)
  const threadsOpen = commentsSheetOpen ?? threadsOpenInternal
  const setThreadsOpen = useCallback(
    (o: boolean) => {
      setThreadsOpenInternal(o)
      onCommentsSheetOpenChange?.(o)
    },
    [onCommentsSheetOpenChange]
  )
  const [sheetTab, setSheetTab] = useState<"open" | "resolved">("open")
  const [sheetThreadId, setSheetThreadId] = useState<string | null>(null)
  const [pendingThread, setPendingThread] = useState<PendingThread | null>(null)
  // The highlight whose thread is open (or was just jumped to), so the reader
  // can tell which passage the conversation belongs to.
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  const editor = useEditor({
    // Required in the Next.js App Router: rendering the editor during SSR /
    // prerender causes hydration mismatches.
    immediatelyRender: false,
    // Without the content check, TipTap silently replaces a stored doc that
    // the current schema can't represent with an EMPTY document — and the
    // next keystroke would autosave that wipe over the student's essay.
    enableContentCheck: true,
    onContentError: () => {
      markLoadError()
    },
    extensions: [
      ...richTextExtensions,
      Placeholder.configure({
        placeholder: placeholder || "Start writing...",
      }),
    ],
    content: parseRichText(value) ?? "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class: `prose prose-neutral dark:prose-invert max-w-none ${minHeightClass} ${bodyClassName} focus:outline-none`,
      },
      // Annotate-only (teacher): permit selection + our comment command, but
      // block every content mutation so the student's prose is never edited.
      ...(annotateOnly
        ? {
            handleTextInput: () => true,
            handleKeyDown: (_view, event: KeyboardEvent) => {
              const k = event.key
              if (k.startsWith("Arrow") || ["Home", "End", "PageUp", "PageDown", "Tab", "Shift", "Control", "Meta", "Alt", "Escape"].includes(k)) {
                return false
              }
              if ((event.metaKey || event.ctrlKey) && ["a", "c", "z", "y"].includes(k.toLowerCase())) {
                return false
              }
              return true
            },
            handlePaste: () => true,
            handleDrop: () => true,
            // handleKeyDown can't catch a context-menu Cut or a native text
            // drag (no keydown). Returning true skips ProseMirror's own
            // handling, but the BROWSER would still cut/move the selection from
            // the contenteditable — so preventDefault to stop it deleting prose.
            handleDOMEvents: {
              cut: (_view, event) => {
                event.preventDefault()
                return true
              },
              dragstart: (_view, event) => {
                event.preventDefault()
                return true
              },
            },
          }
        : {}),
    },
    onUpdate: ({ editor }) => {
      if (loadErrorRef.current) return
      const json = serializeRichText(editor.getJSON() as RichTextDoc)
      lastEmitted.current = json
      onChange(json)
    },
    onBlur: () => {
      onBlur?.()
    },
  })

  // Adopt external value changes (initial load, refresh) without fighting typing
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return
    lastEmitted.current = value
    try {
      editor.commands.setContent(parseRichText(value) ?? "", {
        emitUpdate: false,
        errorOnInvalidContent: true,
      })
    } catch {
      markLoadError()
    }
  }, [editor, value])

  // `editable` in useEditor only sets the initial state; the review-flow
  // lockout flips `disabled` in place without remounting.
  useEffect(() => {
    editor?.setEditable(!disabled && !loadError)
  }, [editor, disabled, loadError])

  // Follow the selection with a floating comment chip. selectionUpdate fires
  // on every change (including collapse), so the chip hides itself.
  useEffect(() => {
    if (!editor || !commentsEnabled) return
    const update = () => {
      const { from, to, empty } = editor.state.selection
      // No chip while the comments sheet is open — a double-click word
      // selection mid-thread must not offer a second comment.
      if (threadsOpen || empty || from === to || rangeOverlapsComment(editor, from, to)) {
        setSelTooltip(null)
        return
      }
      // Sit right at the end of the highlighted text, on its line.
      const coords = editor.view.coordsAtPos(to)
      setSelTooltip({
        x: Math.min(coords.right + 8, window.innerWidth - 130),
        y: coords.top - 4,
      })
    }
    const hide = () => setSelTooltip(null)
    if (threadsOpen) hide()
    editor.on("selectionUpdate", update)
    editor.on("blur", hide)
    return () => {
      editor.off("selectionUpdate", update)
      editor.off("blur", hide)
    }
  }, [editor, commentsEnabled, threadsOpen])

  // Clicking a highlight opens its thread in the comments sheet (works even
  // in read-only mode); clicking elsewhere drops the selected state.
  useEffect(() => {
    if (!editor || !commentsEnabled) return
    const dom = editor.view.dom
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.(".rt-comment") as HTMLElement | null
      const threadId = el?.getAttribute("data-thread-id")
      if (!threadId) {
        // Clicking plain body text deselects — and closes the sheet, since a
        // non-modal sheet doesn't dismiss itself on outside clicks (which is
        // what left the blur hanging over the page).
        setActiveThreadId(null)
        if (threadsOpen) {
          setThreadsOpen(false)
          setSheetThreadId(null)
          setPendingThread(null)
        }
        return
      }
      // Already viewing this thread (e.g. a double-click): don't re-open.
      if (threadsOpen && sheetThreadId === threadId && !pendingThread) return
      setPendingThread(null)
      setActiveThreadId(threadId)
      setSheetThreadId(threadId)
      setThreadsOpen(true)
    }
    dom.addEventListener("click", onClick)
    return () => dom.removeEventListener("click", onClick)
  }, [editor, commentsEnabled, setThreadsOpen, threadsOpen, sheetThreadId, pendingThread])

  // While a new comment is being composed, its selected range is painted like
  // an active highlight via a decoration — the real mark is only applied once
  // the first message persists, so cancelling leaves the text untouched.
  const pendingRangeRef = useRef<{ from: number; to: number } | null>(null)
  useEffect(() => {
    pendingRangeRef.current = pendingThread?.range ?? null
    // Nudge ProseMirror so the decoration set recomputes.
    if (editor) editor.view.dispatch(editor.state.tr)
  }, [pendingThread, editor])

  useEffect(() => {
    if (!editor) return
    const key = new PluginKey("pending-comment-highlight")
    const plugin = new Plugin({
      key,
      props: {
        decorations: (state) => {
          const r = pendingRangeRef.current
          if (!r) return null
          const max = state.doc.content.size
          if (r.from >= max) return null
          return DecorationSet.create(state.doc, [
            Decoration.inline(r.from, Math.min(r.to, max), {
              class: "rt-comment rt-comment-active",
            }),
          ])
        },
      },
    })
    editor.registerPlugin(plugin)
    return () => {
      editor.unregisterPlugin(key)
    }
  }, [editor])

  // Paint the active highlight. The mark renders as spans in the editor DOM,
  // so the class is toggled directly — and re-applied after every document
  // update, since ProseMirror rebuilds those nodes.
  useEffect(() => {
    if (!editor || !commentsEnabled) return
    const paint = () => {
      const dom = editor.view.dom
      dom.querySelectorAll(".rt-comment-active").forEach((el) => {
        if (el.getAttribute("data-thread-id") !== activeThreadId) {
          el.classList.remove("rt-comment-active")
        }
      })
      if (!activeThreadId) return
      dom
        .querySelectorAll(`.rt-comment[data-thread-id="${CSS.escape(activeThreadId)}"]`)
        .forEach((el) => el.classList.add("rt-comment-active"))
    }
    paint()
    editor.on("update", paint)
    editor.on("selectionUpdate", paint)
    return () => {
      editor.off("update", paint)
      editor.off("selectionUpdate", paint)
    }
  }, [editor, commentsEnabled, activeThreadId])

  // Start a comment on the current selection: open the sheet with a composer;
  // the highlight is applied only once the first message persists.
  const startCommentOnSelection = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) return
    if (rangeOverlapsComment(editor, from, to)) {
      toast.error("That text already has a comment — open its highlight to reply instead.")
      return
    }
    setSelTooltip(null)
    setPendingThread({
      threadId: generateThreadId(),
      range: { from, to },
      // The whole passage, uncut — a clipped quote reads as broken.
      quote: editor.state.doc.textBetween(from, to, " "),
    })
    setSheetThreadId(null)
    setThreadsOpen(true)
  }, [editor, setThreadsOpen])

  const sendFirstComment = useCallback(
    async (note: string): Promise<boolean> => {
      if (!pendingThread || !editor) return false
      const created = await inline.reply(pendingThread.threadId, note, pendingThread.quote)
      if (!created) return false
      editor
        .chain()
        .setTextSelection(pendingThread.range)
        .setCommentThread(pendingThread.threadId)
        .run()
      // Hand off to the normal thread view, with the new highlight selected.
      setSheetThreadId(pendingThread.threadId)
      setActiveThreadId(pendingThread.threadId)
      setPendingThread(null)
      return true
    },
    [pendingThread, inline, editor]
  )

  // Resolve a thread and strip its highlight.
  const resolveThreadById = useCallback(
    async (threadId: string) => {
      // Capture the passage while the highlight still exists — it backfills
      // threads created before quotes were stored.
      let quote: string | undefined
      if (editor) {
        const ranges = threadMarkRanges(editor, threadId)
        if (ranges.length) {
          quote = editor.state.doc.textBetween(
            ranges[0].from,
            ranges[ranges.length - 1].to,
            " "
          )
        }
      }
      await inline.resolveThread(threadId, quote)
      if (!editor) return
      const ranges = threadMarkRanges(editor, threadId)
      if (ranges.length) {
        let chain = editor.chain()
        for (const rg of ranges) chain = chain.setTextSelection(rg).unsetCommentThread()
        chain.run()
      }
    },
    [editor, inline]
  )

  // Delete one message from the open thread. Deleting the last message
  // removes the whole thread, so its highlight is stripped too.
  const deleteThreadComment = useCallback(
    async (threadId: string, commentId: number) => {
      const wasLast = (inline.threads.get(threadId)?.comments.length ?? 0) <= 1
      const ok = await inline.deleteComment(commentId)
      if (!ok) {
        toast.error("Couldn't delete the comment — please try again.")
        return
      }
      if (wasLast && editor) {
        const ranges = threadMarkRanges(editor, threadId)
        if (ranges.length) {
          let chain = editor.chain()
          for (const rg of ranges) chain = chain.setTextSelection(rg).unsetCommentThread()
          chain.run()
        }
        setSheetThreadId(null)
        setActiveThreadId(null)
      }
    },
    [inline, editor]
  )

  // "Show in essay": close the sheet, scroll the highlight into view, and
  // leave it visually selected so it's obvious which passage was meant.
  const scrollToHighlight = useCallback(
    (threadId: string, from: number) => {
      if (!editor) return
      setActiveThreadId(threadId)
      const domAt = editor.view.domAtPos(from).node
      const el = (domAt.nodeType === Node.TEXT_NODE ? domAt.parentElement : (domAt as HTMLElement)) as HTMLElement | null
      el?.scrollIntoView?.({ block: "center", behavior: "smooth" })
    },
    [editor]
  )

  /** Open a thread in the sheet and mark its highlight as selected. */
  const openThreadInSheet = useCallback((threadId: string) => {
    setActiveThreadId(threadId)
    setSheetThreadId(threadId)
  }, [])

  // Open threads in document order, with a short quote of the passage each
  // one anchors to. Threads whose highlight vanished (e.g. the passage was
  // deleted) are skipped — resolving them is the popover's job.
  const threadListItems =
    commentsEnabled && showThreadList && editor
      ? [...inline.threads.values()]
          .filter((t) => !t.resolved)
          .map((t) => {
            const ranges = threadMarkRanges(editor, t.threadId)
            if (!ranges.length) return null
            const from = ranges[0].from
            // Full passage; the list row truncates visually with CSS.
            const quote = editor.state.doc.textBetween(from, ranges[ranges.length - 1].to, " ")
            return { thread: t, from, quote }
          })
          .filter((x): x is { thread: InlineThread; from: number; quote: string } => !!x)
          .sort((a, b) => a.from - b.from)
      : []

  const viewer = comments?.viewer ?? "student"

  // Resolved threads keep their history: the highlight is gone from the
  // document, but the exchange stays browsable from the sheet.
  const resolvedThreads =
    commentsEnabled && showThreadList
      ? [...inline.threads.values()]
          .filter((t) => t.resolved && t.comments.length > 0)
          .sort((a, b) => b.lastAt - a.lastAt)
      : []

  // Badge: the student sees how many teacher comments they haven't read; the
  // teacher (no read-tracking of their own) sees how many threads are open.
  const unreadInline = threadListItems.reduce(
    (n, { thread }) =>
      n + thread.comments.filter((c) => !c.isStudentReply && !c.isOld).length,
    0
  )
  const inlineBadge = viewer === "student" ? unreadInline : threadListItems.length

  // Let a page-level Comments button badge itself with live counts. Declared
  // before the load-error return so the hook order never changes.
  const openCount = threadListItems.length
  useEffect(() => {
    onCommentCounts?.({ open: openCount, unread: unreadInline })
  }, [onCommentCounts, openCount, unreadInline])

  if (loadError) {
    return (
      <div
        className={cn(
          "border-destructive/40 bg-destructive/5 rounded-lg border px-4 py-3 text-sm",
          className
        )}
      >
        This essay could not be loaded for editing, so editing is disabled to protect your saved
        work. Try refreshing the page, and ask your teacher for help if it keeps happening.
      </div>
    )
  }

  const showToolbar = !disabled || (commentsEnabled && annotateOnly)

  const threadsButton =
    commentsEnabled && showThreadList && showCommentsButton ? (
      <button
        type="button"
        onClick={() => setThreadsOpen(true)}
        className="hover:bg-accent relative inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors"
        title="Inline comments"
      >
        <MessageSquareText className="size-4" />
        Comments
        {inlineBadge > 0 && (
          <span
            className={cn(
              "absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white",
              viewer === "student" && unreadInline > 0 ? "bg-blue-500" : "bg-gray-400"
            )}
          >
            {inlineBadge}
          </span>
        )}
      </button>
    ) : null

  const rightArea =
    threadsButton || toolbarRight ? (
      <div className="flex items-center gap-2">
        {threadsButton}
        {toolbarRight}
      </div>
    ) : null

  return (
    <div className={cn("flex flex-col", className)}>
      {showToolbar ? (
        <EditorToolbar
          editor={editor}
          annotateOnly={annotateOnly}
          onComment={commentsEnabled ? startCommentOnSelection : undefined}
          leftSlot={toolbarLeft}
          rightSlot={rightArea}
        />
      ) : (
        (rightArea || toolbarLeft) && (
          <div className="bg-background sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-lg border-b px-3 py-2">
            <div className="flex items-center gap-2">{toolbarLeft}</div>
            <div className="flex items-center gap-2">{rightArea}</div>
          </div>
        )
      )}
      <EditorContent
        editor={editor}
        className={cn(
          "flex flex-1 flex-col [&>.tiptap]:flex-1",
          // A disabled document is visibly inert (submitted/complete/locked),
          // while the toolbar slots above stay interactive.
          disabled && "pointer-events-none select-none opacity-60"
        )}
      />

      {/* Floating comment chip at the end of the highlighted text — mousedown
          is prevented so clicking it doesn't collapse the selection before
          the click lands; hidden entirely while the essay is locked. */}
      {selTooltip && !disabled && (
        <button
          type="button"
          style={{
            position: "fixed",
            left: selTooltip.x,
            top: selTooltip.y,
            zIndex: 50,
          }}
          className="bg-background text-foreground hover:bg-accent flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium shadow-md transition-colors"
          onMouseDown={(e) => e.preventDefault()}
          onClick={startCommentOnSelection}
        >
          <MessageSquarePlus className="size-3.5" />
          Comment
        </button>
      )}

      {/* Non-modal: the essay stays clickable beside the sheet, so clicking
          another highlight switches threads instead of bouncing off an
          overlay (which closed the sheet and dropped the selection). */}
      <Sheet
        modal={false}
        open={threadsOpen}
        onOpenChange={(o) => {
          setThreadsOpen(o)
          if (!o) {
            // Closing the sheet (or cancelling a draft comment) returns the
            // document to normal: no selected highlight, no pending range.
            setSheetThreadId(null)
            setPendingThread(null)
            setActiveThreadId(null)
          }
        }}
      >
        <SheetContent
          className="flex flex-col gap-0 p-0 sm:max-w-md"
          showOverlay={false}
          passiveOverlay
          // Clicking a highlight must swap the thread, not close the sheet;
          // the editor's own click handler takes it from there.
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement | null
            if (target?.closest?.(".rt-comment")) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement | null
            if (target?.closest?.(".rt-comment")) e.preventDefault()
          }}
          // A highlight click moves focus into the editor, and Radix treats
          // that focusin as a dismissal (its guard for this only arms after an
          // UNprevented pointerdown-outside — which the handler above just
          // prevented). That closed and instantly reopened the sheet, replaying
          // the slide-in. Closing is owned by explicit interactions (body-text
          // click, the X, Escape), so focus alone must never dismiss.
          onFocusOutside={(e) => e.preventDefault()}
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4">
            {pendingThread ? (
              <SheetTitle className="text-base">New comment</SheetTitle>
            ) : sheetThreadId ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSheetThreadId(null)
                    setActiveThreadId(null)
                  }}
                  className="text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md border"
                  title="Back to all comments"
                >
                  ←
                </button>
                <SheetTitle className="text-base">Comment thread</SheetTitle>
              </div>
            ) : (
              <>
                <SheetTitle className="text-base">Inline comments</SheetTitle>
                <div className="bg-muted mt-1 flex gap-1 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setSheetTab("open")}
                    className={cn(
                      "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      sheetTab === "open"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Open ({threadListItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetTab("resolved")}
                    className={cn(
                      "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      sheetTab === "resolved"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Resolved ({resolvedThreads.length})
                  </button>
                </div>
              </>
            )}
            <SheetDescription className="sr-only">
              Comment threads anchored to highlights in this essay
            </SheetDescription>
          </SheetHeader>

          {pendingThread ? (
            <NewThreadComposer quote={pendingThread.quote} onSend={sendFirstComment} />
          ) : sheetThreadId ? (
            <SheetThreadView
              thread={inline.threads.get(sheetThreadId)}
              quote={
                threadListItems.find((i) => i.thread.threadId === sheetThreadId)?.quote ??
                inline.threads.get(sheetThreadId)?.comments.find((c) => c.quote)?.quote ??
                undefined
              }
              viewer={viewer}
              canResolve={!disabled && !inline.threads.get(sheetThreadId)?.resolved}
              onReply={(note) => inline.reply(sheetThreadId, note).then((c) => !!c)}
              onMarkRead={inline.markRead}
              onDeleteComment={
                viewer === "teacher"
                  ? (commentId) => deleteThreadComment(sheetThreadId, commentId)
                  : undefined
              }
              onResolve={async () => {
                await resolveThreadById(sheetThreadId)
                setSheetThreadId(null)
                setActiveThreadId(null)
              }}
              onShowInEssay={
                threadListItems.some((i) => i.thread.threadId === sheetThreadId)
                  ? () => {
                      const item = threadListItems.find((i) => i.thread.threadId === sheetThreadId)
                      if (!item) return
                      setThreadsOpen(false)
                      setSheetThreadId(null)
                      scrollToHighlight(sheetThreadId, item.from)
                    }
                  : undefined
              }
            />
          ) : (
            <div className="flex-1 divide-y overflow-y-auto">
              {sheetTab === "open" ? (
                threadListItems.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    No open comments. Highlight text in the essay to start one.
                  </p>
                ) : (
                  threadListItems.map(({ thread, quote }) => {
                    const hasUnread =
                      viewer === "student" &&
                      thread.comments.some((c) => !c.isStudentReply && !c.isOld)
                    return (
                      <ThreadListEntry
                        key={thread.threadId}
                        thread={thread}
                        quote={quote}
                        hasUnread={hasUnread}
                        onOpen={() => openThreadInSheet(thread.threadId)}
                      />
                    )
                  })
                )
              ) : resolvedThreads.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No resolved comments yet.
                </p>
              ) : (
                resolvedThreads.map((thread) => (
                  <ThreadListEntry
                    key={thread.threadId}
                    thread={thread}
                    quote={thread.comments.find((c) => c.quote)?.quote ?? undefined}
                    resolved
                    onOpen={() => openThreadInSheet(thread.threadId)}
                  />
                ))
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function formatThreadDate(ms: number): string {
  if (!ms) return ""
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Composer for a comment on a fresh selection, shown in the sheet. */
function NewThreadComposer({
  quote,
  onSend,
}: {
  quote: string
  onSend: (note: string) => Promise<boolean>
}) {
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!note.trim() || sending) return
    setSending(true)
    const ok = await onSend(note.trim())
    setSending(false)
    if (ok) setNote("")
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-sm leading-relaxed">&ldquo;{quote.trim()}&rdquo;</p>
        <Separator className="mt-4" />
      </div>
      <div className="shrink-0 border-t px-4 py-3">
        <Textarea
          autoFocus
          placeholder="Write a comment…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && note.trim() && !sending) {
              e.preventDefault()
              send()
            }
          }}
          rows={3}
          className="text-sm"
        />
        <div className="mt-2 flex">
          <Button
            size="sm"
            className="h-8 flex-1 text-xs"
            onClick={send}
            disabled={!note.trim() || sending}
          >
            {sending ? "Sending…" : "Comment"}
          </Button>
        </div>
      </div>
    </>
  )
}

/**
 * One thread in the sheet's list, formatted like a version-history row: the
 * quoted passage as the title line, meta beneath, thin dividers between rows.
 */
function ThreadListEntry({
  thread,
  quote,
  hasUnread = false,
  resolved = false,
  onOpen,
}: {
  thread: InlineThread
  quote?: string
  hasUnread?: boolean
  resolved?: boolean
  onOpen: () => void
}) {
  const last = thread.comments[thread.comments.length - 1]
  const label = quote?.trim() || last?.note || ""
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hover:bg-muted/40 block w-full px-6 py-3 text-left transition-colors"
    >
      <p className="flex items-center gap-2 text-sm">
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-medium",
            resolved && "text-muted-foreground"
          )}
        >
          “{label}”
        </span>
        {hasUnread && (
          <span className="size-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden />
        )}
      </p>
      <p className="text-muted-foreground text-xs">
        {resolved ? (
          <span className="font-medium text-green-700">Resolved</span>
        ) : (
          <span className="font-medium text-blue-600">Open</span>
        )}
        {last?.teacher_name && <> &middot; {last.teacher_name}</>}
        {" · "}
        {formatThreadDate(thread.lastAt)}
        {" · "}
        {thread.comments.length} {thread.comments.length === 1 ? "message" : "messages"}
        {" · click to view"}
      </p>
    </button>
  )
}

/**
 * A single thread inside the comments sheet, rendered like the activity logs:
 * chat bubbles with date separators, a composer pinned at the bottom, and
 * Resolve beside Reply. Open threads can also jump to their highlight.
 */
function SheetThreadView({
  thread,
  quote,
  viewer,
  canResolve,
  onReply,
  onMarkRead,
  onDeleteComment,
  onResolve,
  onShowInEssay,
}: {
  thread: InlineThread | undefined
  quote?: string
  viewer: "teacher" | "student"
  canResolve: boolean
  onReply: (note: string) => Promise<boolean>
  onMarkRead: (commentId: number) => void
  /** Teacher-side: delete one message (confirmation handled in the stream). */
  onDeleteComment?: (commentId: number) => Promise<void>
  onResolve: () => Promise<void>
  /** Present only while the thread's highlight still exists in the document. */
  onShowInEssay?: () => void
}) {
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [confirmResolve, setConfirmResolve] = useState(false)

  if (!thread) {
    return (
      <p className="text-muted-foreground flex-1 py-8 text-center text-sm">
        This thread is no longer available.
      </p>
    )
  }

  const send = async () => {
    if (!note.trim() || sending) return
    setSending(true)
    const ok = await onReply(note.trim())
    setSending(false)
    if (ok) setNote("")
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {quote && (
          <div className="mb-3">
            <p className="text-sm leading-relaxed">&ldquo;{quote.trim()}&rdquo;</p>
            {onShowInEssay && (
              <button
                type="button"
                onClick={onShowInEssay}
                className="mt-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
              >
                Show in essay
              </button>
            )}
            <Separator className="mt-3" />
          </div>
        )}
        {thread.resolved && (
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-green-700">
            ✓ Resolved
          </p>
        )}
        <FieldActivityStream
          comments={thread.comments}
          viewer={viewer}
          onMarkRead={onMarkRead}
          onDelete={onDeleteComment}
          autoMarkRead={viewer === "student"}
          scrollToLatest
        />
      </div>
      <div className="shrink-0 border-t px-4 py-3">
        <Textarea
          placeholder="Reply…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && note.trim() && !sending) {
              e.preventDefault()
              send()
            }
          }}
          rows={2}
          className="text-sm"
        />
        <div className="mt-2 flex items-center gap-1.5">
          {canResolve && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-1 gap-1.5 text-xs text-green-700 hover:bg-green-50 hover:text-green-800"
              disabled={sending || resolving}
              onClick={() => setConfirmResolve(true)}
              title="Resolve and remove the highlight"
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3.5" />
              {resolving ? "Resolving…" : "Resolve"}
            </Button>
          )}
          <Button size="sm" className="h-8 flex-1 text-xs" onClick={send} disabled={!note.trim() || sending}>
            {sending ? "Sending…" : "Reply"}
          </Button>
        </div>
      </div>

      {/* Resolving removes the highlight from the essay, so confirm first. */}
      <AlertDialog open={confirmResolve} onOpenChange={(o) => { if (!resolving) setConfirmResolve(o) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resolve this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              The highlight will be removed from the essay and this thread moves
              to the Resolved tab. The conversation is kept, and this can&rsquo;t
              be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resolving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={resolving}
              onClick={async (e) => {
                e.preventDefault()
                setResolving(true)
                await onResolve()
                setResolving(false)
                setConfirmResolve(false)
              }}
            >
              {resolving ? "Resolving…" : "Resolve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function EditorToolbar({
  editor,
  annotateOnly = false,
  onComment,
  leftSlot,
  rightSlot,
}: {
  editor: Editor | null
  annotateOnly?: boolean
  onComment?: () => void
  leftSlot?: React.ReactNode
  rightSlot?: React.ReactNode
}) {
  const liveState = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            underline: editor.isActive("underline"),
            strike: editor.isActive("strike"),
            h1: editor.isActive("heading", { level: 1 }),
            h2: editor.isActive("heading", { level: 2 }),
            h3: editor.isActive("heading", { level: 3 }),
            bulletList: editor.isActive("bulletList"),
            orderedList: editor.isActive("orderedList"),
            blockquote: editor.isActive("blockquote"),
            inTable: editor.isActive("table"),
            selectionEmpty: editor.state.selection.empty,
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
          }
        : null,
  })

  if (!editor) return null

  // useEditorState can be null on the first render — before the editor's first
  // transaction — which would hide the toolbar until the teacher clicks into
  // the page. Fall back to a neutral state so it shows the moment the editor
  // mounts.
  const state = liveState ?? {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    h1: false,
    h2: false,
    h3: false,
    bulletList: false,
    orderedList: false,
    blockquote: false,
    inTable: false,
    selectionEmpty: true,
    canUndo: false,
    canRedo: false,
  }

  const chain = () => editor.chain().focus()

  const commentButton = onComment ? (
    <ToolbarButton
      label="Comment on selection"
      disabled={state.selectionEmpty}
      onClick={onComment}
    >
      <MessageSquarePlus />
    </ToolbarButton>
  ) : null

  // The teacher's annotate-only toolbar carries just the comment action.
  if (annotateOnly) {
    return (
      <div className="bg-background sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-t-lg border-b px-2 py-2">
        {leftSlot && <div className="mr-1 flex items-center gap-2">{leftSlot}</div>}
        {commentButton}
        <span className="text-muted-foreground text-xs">
          Select text and comment — the essay itself stays read-only.
        </span>
        {rightSlot && <div className="ml-auto pl-2">{rightSlot}</div>}
      </div>
    )
  }

  return (
    <div className="bg-background sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-lg border-b px-2 py-2">
      {leftSlot && (
        <>
          <div className="mr-1 flex items-center gap-2">{leftSlot}</div>
          <Separator orientation="vertical" className="mx-1 h-6" />
        </>
      )}
      <ToolbarButton
        label="Bold"
        active={state.bold}
        onClick={() => chain().toggleBold().run()}
      >
        <Bold />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={state.italic}
        onClick={() => chain().toggleItalic().run()}
      >
        <Italic />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={state.underline}
        onClick={() => chain().toggleUnderline().run()}
      >
        <UnderlineIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      >
        <Strikethrough />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        label="Heading 1"
        active={state.h1}
        onClick={() => chain().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={state.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={state.h3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        label="Bullet list"
        active={state.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      >
        <List />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={state.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={state.blockquote}
        onClick={() => chain().toggleBlockquote().run()}
      >
        <TextQuote />
      </ToolbarButton>
      <ToolbarButton
        label="Divider"
        onClick={() => chain().setHorizontalRule().run()}
      >
        <Minus />
      </ToolbarButton>
      <ToolbarButton
        label={state.inTable ? "Delete table" : "Insert table"}
        active={state.inTable}
        onClick={() =>
          state.inTable
            ? chain().deleteTable().run()
            : chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <TableIcon />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        label="Undo"
        disabled={!state.canUndo}
        onClick={() => chain().undo().run()}
      >
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        disabled={!state.canRedo}
        onClick={() => chain().redo().run()}
      >
        <Redo2 />
      </ToolbarButton>

      {commentButton && (
        <>
          <Separator orientation="vertical" className="mx-1 h-6" />
          {commentButton}
        </>
      )}
      {rightSlot && <div className="ml-auto pl-2">{rightSlot}</div>}
    </div>
  )
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className="size-8 [&_svg]:size-4"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
