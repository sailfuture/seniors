"use client"

import { useEffect, useRef, useState } from "react"
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
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
  Undo2,
  Redo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { parseRichText, serializeRichText, type RichTextDoc } from "@/lib/rich-text"

/**
 * Controlled TipTap editor: `value` is the serialized JSON string stored in
 * student_response ("" when empty), mirroring the LineItemsInput contract so
 * it plugs into the standard dirty/debounce/autosave path unchanged.
 */
export function RichTextEditor({
  value,
  onChange,
  onBlur,
  disabled = false,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  placeholder?: string
  className?: string
}) {
  const lastEmitted = useRef(value)
  const [loadError, setLoadError] = useState(false)
  const loadErrorRef = useRef(false)
  const markLoadError = () => {
    loadErrorRef.current = true
    setLoadError(true)
  }

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
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder || "Start writing...",
      }),
    ],
    content: parseRichText(value) ?? "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none min-h-[55vh] px-1 py-4 focus:outline-none",
      },
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

  return (
    <div className={cn("flex flex-col", className)}>
      {!disabled && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

function EditorToolbar({ editor }: { editor: Editor | null }) {
  const state = useEditorState({
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
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
          }
        : null,
  })

  if (!editor || !state) return null

  const chain = () => editor.chain().focus()

  return (
    <div className="bg-background sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b py-2">
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
