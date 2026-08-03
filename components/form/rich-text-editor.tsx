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
import { FieldActivityStream } from "./field-activity-stream"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { parseRichText, serializeRichText, type RichTextDoc } from "@/lib/rich-text"
import { richTextExtensions } from "@/lib/rich-text-extensions"
import { COMMENT_MARK_NAME } from "@/lib/rich-text-comment-mark"
import { useInlineComments, generateThreadId, type InlineThread } from "@/lib/inline-comments"
import { CommentThreadPopover } from "./comment-thread-popover"

export interface RichTextCommentConfig {
  commentsEndpoint: string
  /** Section FK on the comments table, e.g. "lifemap_sections_id". */
  sectionIdField: string
  studentId: string
  sectionId: number
  fieldName: string
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

interface ActiveThread {
  threadId: string
  isNew: boolean
  anchor: { x: number; y: number }
  range?: { from: number; to: number }
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
  const [activeThread, setActiveThread] = useState<ActiveThread | null>(null)
  // Floating "Comment" chip that follows a non-empty selection, so starting a
  // thread never requires reaching up to the toolbar.
  const [selTooltip, setSelTooltip] = useState<{ x: number; y: number } | null>(null)
  const [threadsOpen, setThreadsOpen] = useState(false)
  // Sheet state: which tab, and which thread (null = the list).
  const [sheetTab, setSheetTab] = useState<"open" | "resolved">("open")
  const [sheetThreadId, setSheetThreadId] = useState<string | null>(null)

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
      if (empty || from === to) {
        setSelTooltip(null)
        return
      }
      const coords = editor.view.coordsAtPos(to)
      // The chip is centered on this x, so clamp by half its width.
      setSelTooltip({
        x: Math.max(70, Math.min(coords.left, window.innerWidth - 70)),
        y: coords.bottom,
      })
    }
    const hide = () => setSelTooltip(null)
    editor.on("selectionUpdate", update)
    editor.on("blur", hide)
    return () => {
      editor.off("selectionUpdate", update)
      editor.off("blur", hide)
    }
  }, [editor, commentsEnabled])

  // Clicking a highlight opens its thread (works even in read-only mode).
  useEffect(() => {
    if (!editor || !commentsEnabled) return
    const dom = editor.view.dom
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.(".rt-comment") as HTMLElement | null
      const threadId = el?.getAttribute("data-thread-id")
      if (!threadId) return
      setActiveThread({ threadId, isNew: false, anchor: { x: e.clientX, y: e.clientY } })
    }
    dom.addEventListener("click", onClick)
    return () => dom.removeEventListener("click", onClick)
  }, [editor, commentsEnabled])

  const startCommentOnSelection = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) return
    const coords = editor.view.coordsAtPos(to)
    setSelTooltip(null)
    setActiveThread({
      threadId: generateThreadId(),
      isNew: true,
      range: { from, to },
      anchor: { x: coords.left, y: coords.bottom },
    })
  }, [editor])

  const handleSend = useCallback(
    async (note: string): Promise<boolean> => {
      if (!activeThread) return false
      // A new thread stores its highlighted passage so the exchange stays
      // legible after resolution removes the highlight.
      const quote =
        activeThread.isNew && activeThread.range && editor
          ? editor.state.doc.textBetween(
              activeThread.range.from,
              Math.min(activeThread.range.to, activeThread.range.from + 240),
              " "
            )
          : undefined
      const created = await inline.reply(activeThread.threadId, note, quote)
      // A brand-new thread's highlight is applied only once its first comment
      // persists, so cancelling leaves no orphan highlight.
      if (created && activeThread.isNew && activeThread.range && editor) {
        editor.chain().setTextSelection(activeThread.range).setCommentThread(activeThread.threadId).run()
        setActiveThread((prev) => (prev ? { ...prev, isNew: false } : prev))
      }
      return !!created
    },
    [activeThread, inline, editor]
  )

  // Resolve a thread and strip its highlight, from either the popover or the
  // sheet's thread view.
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
            Math.min(ranges[ranges.length - 1].to, ranges[0].from + 240),
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

  const handleResolve = useCallback(async () => {
    if (!activeThread) return
    await resolveThreadById(activeThread.threadId)
    setActiveThread(null)
  }, [activeThread, resolveThreadById])

  // Open a thread from the list: scroll its highlight into view first, then
  // anchor the popover at the highlight's on-screen position.
  const openThreadFromList = useCallback(
    (threadId: string, from: number) => {
      if (!editor) return
      const domAt = editor.view.domAtPos(from).node
      const el = (domAt.nodeType === Node.TEXT_NODE ? domAt.parentElement : (domAt as HTMLElement)) as HTMLElement | null
      el?.scrollIntoView?.({ block: "center" })
      const coords = editor.view.coordsAtPos(from)
      setActiveThread({ threadId, isNew: false, anchor: { x: coords.left, y: coords.bottom } })
    },
    [editor]
  )

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
            const quote = editor.state.doc.textBetween(from, Math.min(ranges[ranges.length - 1].to, from + 140), " ")
            return { thread: t, from, quote }
          })
          .filter((x): x is { thread: InlineThread; from: number; quote: string } => !!x)
          .sort((a, b) => a.from - b.from)
      : []

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

  const threadsButton =
    commentsEnabled && showThreadList ? (
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

      {/* Floating comment chip at the selection — mousedown is prevented so
          clicking it doesn't collapse the selection before the click lands.
          Offset below the selection's last line so it never sits on the text
          being read; hidden entirely while the essay is locked. */}
      {selTooltip && !activeThread && !disabled && (
        <button
          type="button"
          style={{
            position: "fixed",
            left: selTooltip.x,
            top: selTooltip.y + 10,
            zIndex: 50,
          }}
          className="flex -translate-x-1/2 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg transition-colors hover:bg-blue-700"
          onMouseDown={(e) => e.preventDefault()}
          onClick={startCommentOnSelection}
        >
          <MessageSquarePlus className="size-3.5" />
          Comment
        </button>
      )}

      <Sheet
        open={threadsOpen}
        onOpenChange={(o) => {
          setThreadsOpen(o)
          if (!o) setSheetThreadId(null)
        }}
      >
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="shrink-0 border-b px-6 py-4">
            {sheetThreadId ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSheetThreadId(null)}
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

          {sheetThreadId ? (
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
              onResolve={async () => {
                await resolveThreadById(sheetThreadId)
                setSheetThreadId(null)
              }}
              onShowInEssay={
                threadListItems.some((i) => i.thread.threadId === sheetThreadId)
                  ? () => {
                      const item = threadListItems.find((i) => i.thread.threadId === sheetThreadId)
                      if (!item) return
                      setThreadsOpen(false)
                      setSheetThreadId(null)
                      openThreadFromList(sheetThreadId, item.from)
                    }
                  : undefined
              }
            />
          ) : (
            <div className="flex-1 divide-y overflow-y-auto px-4 py-2">
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
                        viewer={viewer}
                        hasUnread={hasUnread}
                        onOpen={() => setSheetThreadId(thread.threadId)}
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
                    viewer={viewer}
                    resolved
                    onOpen={() => setSheetThreadId(thread.threadId)}
                  />
                ))
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
      {activeThread && (
        <CommentThreadPopover
          anchor={activeThread.anchor}
          comments={inline.threads.get(activeThread.threadId)?.comments ?? []}
          viewer={comments?.viewer ?? "student"}
          isNew={activeThread.isNew}
          onSend={handleSend}
          onMarkRead={inline.markRead}
          onResolve={
            !disabled && !inline.threads.get(activeThread.threadId)?.resolved
              ? handleResolve
              : undefined
          }
          onClose={() => setActiveThread(null)}
        />
      )}
    </div>
  )
}

/**
 * One thread in the sheet's list, rendered as an activity-log excerpt: the
 * quoted passage as a header line, then the exchange as chat bubbles. The
 * whole block is clickable and opens the thread view.
 */
function ThreadListEntry({
  thread,
  quote,
  viewer,
  hasUnread = false,
  resolved = false,
  onOpen,
}: {
  thread: InlineThread
  quote?: string
  viewer: "teacher" | "student"
  hasUnread?: boolean
  resolved?: boolean
  onOpen: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        "hover:bg-muted/40 -mx-2 cursor-pointer rounded-lg px-2 py-3 transition-colors",
        resolved && "opacity-75"
      )}
    >
      <div className="flex items-center gap-2">
        {resolved && (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-green-700">
            ✓ Resolved
          </span>
        )}
        {quote && (
          <p className="text-muted-foreground min-w-0 flex-1 truncate border-l-2 border-amber-300 pl-2 text-xs">
            “{quote.trim()}”
          </p>
        )}
        {hasUnread && (
          <span className="size-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden />
        )}
      </div>
      {/* The stream is display-only here — clicks land on the wrapper. */}
      <div className="pointer-events-none mt-2">
        <FieldActivityStream comments={thread.comments} viewer={viewer} />
      </div>
    </div>
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
  onResolve,
  onShowInEssay,
}: {
  thread: InlineThread | undefined
  quote?: string
  viewer: "teacher" | "student"
  canResolve: boolean
  onReply: (note: string) => Promise<boolean>
  onMarkRead: (commentId: number) => void
  onResolve: () => Promise<void>
  /** Present only while the thread's highlight still exists in the document. */
  onShowInEssay?: () => void
}) {
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [resolving, setResolving] = useState(false)

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
          <div className="bg-muted/40 mb-3 rounded-md border-l-2 border-amber-300 px-3 py-2">
            <p className="text-muted-foreground text-xs">“{quote.trim()}”</p>
            {onShowInEssay && (
              <button
                type="button"
                onClick={onShowInEssay}
                className="mt-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
              >
                Show in essay
              </button>
            )}
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
              className="h-8 flex-1 gap-1 text-xs text-green-700 hover:bg-green-50 hover:text-green-800"
              disabled={sending || resolving}
              onClick={async () => {
                setResolving(true)
                await onResolve()
                setResolving(false)
              }}
              title="Resolve and remove the highlight"
            >
              {resolving ? "Resolving…" : "Resolve"}
            </Button>
          )}
          <Button size="sm" className="h-8 flex-1 text-xs" onClick={send} disabled={!note.trim() || sending}>
            {sending ? "Sending…" : "Reply"}
          </Button>
        </div>
      </div>
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
