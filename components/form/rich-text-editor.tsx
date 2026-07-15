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
  Undo2,
  Redo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
      const created = await inline.reply(activeThread.threadId, note)
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

  const handleResolve = useCallback(async () => {
    if (!activeThread || !editor) return
    await inline.resolveThread(activeThread.threadId)
    const ranges = threadMarkRanges(editor, activeThread.threadId)
    if (ranges.length) {
      let chain = editor.chain()
      for (const rg of ranges) chain = chain.setTextSelection(rg).unsetCommentThread()
      chain.run()
    }
    setActiveThread(null)
  }, [activeThread, editor, inline])

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

  return (
    <div className={cn("flex flex-col", className)}>
      {showToolbar && (
        <EditorToolbar
          editor={editor}
          annotateOnly={annotateOnly}
          onComment={commentsEnabled ? startCommentOnSelection : undefined}
        />
      )}
      <EditorContent editor={editor} />
      {threadListItems.length > 0 && (
        <div className="border-t px-6 py-4 sm:px-10">
          <p className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wider">
            Inline comments ({threadListItems.length})
          </p>
          <div className="space-y-2">
            {threadListItems.map(({ thread, from, quote }) => (
              <button
                key={thread.threadId}
                type="button"
                onClick={() => openThreadFromList(thread.threadId, from)}
                className="bg-muted/30 hover:bg-muted/60 block w-full rounded-lg border px-3 py-2 text-left transition-colors"
              >
                <p className="text-muted-foreground truncate text-xs italic">“{quote.trim()}”</p>
                <div className="mt-1 space-y-0.5">
                  {thread.comments.map((c) => (
                    <p key={c.id} className="text-xs leading-snug">
                      <span className="font-medium">
                        {c.teacher_name || (c.isStudentReply ? "Student" : "Teacher")}
                        {c.isStudentReply ? " (student)" : ""}:
                      </span>{" "}
                      <span className="text-muted-foreground">{c.note}</span>
                    </p>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {activeThread && (
        <CommentThreadPopover
          anchor={activeThread.anchor}
          comments={inline.threads.get(activeThread.threadId)?.comments ?? []}
          viewer={comments?.viewer ?? "student"}
          isNew={activeThread.isNew}
          onSend={handleSend}
          onMarkRead={inline.markRead}
          onResolve={!disabled ? handleResolve : undefined}
          onClose={() => setActiveThread(null)}
        />
      )}
    </div>
  )
}

function EditorToolbar({
  editor,
  annotateOnly = false,
  onComment,
}: {
  editor: Editor | null
  annotateOnly?: boolean
  onComment?: () => void
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
        {commentButton}
        <span className="text-muted-foreground text-xs">
          Select text and comment — the essay itself stays read-only.
        </span>
      </div>
    )
  }

  return (
    <div className="bg-background sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-lg border-b px-2 py-2">
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
