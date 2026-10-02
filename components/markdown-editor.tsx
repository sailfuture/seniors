"use client"

import { useEffect, useRef, useState } from "react"
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { TableKit } from "@tiptap/extension-table"
import { Placeholder } from "@tiptap/extensions"
import { Markdown as MarkdownExtension } from "@tiptap/markdown"
import { Marked, type marked } from "marked"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link01Icon,
  QuoteDownIcon,
  Redo02Icon,
  SolidLine01Icon,
  TextBoldIcon,
  TextItalicIcon,
  Undo02Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { markdownProseClassName } from "@/components/markdown"
import { cn } from "@/lib/utils"

// Instructions written before Markdown support were plain text, often pasted
// from a doc with indented lines. The student renderer (components/markdown)
// doesn't treat a 4-space indent as a code block, so the editor's parser
// mustn't either — or one edit would save those lines as code.
const instructionsMarked = new Marked()
instructionsMarked.use({ tokenizer: { code: () => undefined } })

/**
 * Formatted editor for teacher-written instructions. The teacher sees the
 * formatting as they type (toolbar or Markdown shortcuts like `## ` and
 * `**bold**`); the value going in and out is Markdown, rendered for students
 * by <Markdown>.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  // The Markdown last loaded into or emitted by the editor, so a value echoed
  // back from the parent doesn't reset the content (and the cursor).
  const lastValue = useRef(value)

  const editor = useEditor({
    // Required in the Next.js App Router: rendering the editor during SSR /
    // prerender causes hydration mismatches.
    immediatelyRender: false,
    // Without the check, content the schema can't hold is silently replaced
    // with an empty doc — and the next keystroke would save that wipe.
    enableContentCheck: true,
    onContentError: () => setLoadFailed(true),
    extensions: [
      StarterKit.configure({
        // Markdown has no underline, so it couldn't be saved.
        underline: false,
        link: { openOnClick: false, defaultProtocol: "https" },
      }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: placeholder || "Write instructions..." }),
      MarkdownExtension.configure({ marked: instructionsMarked as unknown as typeof marked }),
    ],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: cn(markdownProseClassName, "min-h-72 px-3 py-2.5 focus:outline-none"),
        spellcheck: "true",
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          setLinkOpen(true)
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      // Tables serialize with a leading newline; trailing blank lines are noise.
      const markdown = editor.getMarkdown().replace(/^\n+/, "").trimEnd()
      lastValue.current = markdown
      onChangeRef.current(markdown)
    },
  })

  useEffect(() => {
    if (!editor || value === lastValue.current) return
    lastValue.current = value
    editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false })
  }, [editor, value])

  if (loadFailed) {
    return (
      <div className="space-y-1.5">
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={12} />
        <p className="text-muted-foreground text-xs">
          These instructions couldn&apos;t be opened in the formatted editor, so they&apos;re shown as Markdown.
        </p>
      </div>
    )
  }

  return (
    <div className="border-input dark:bg-input/30 focus-within:border-ring bg-background rounded-lg border transition-colors">
      <Toolbar editor={editor} linkOpen={linkOpen} onLinkOpenChange={setLinkOpen} />
      <EditorContent editor={editor} />
    </div>
  )
}

function Toolbar({
  editor,
  linkOpen,
  onLinkOpenChange,
}: {
  editor: Editor | null
  linkOpen: boolean
  onLinkOpenChange: (open: boolean) => void
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            h1: editor.isActive("heading", { level: 1 }),
            h2: editor.isActive("heading", { level: 2 }),
            h3: editor.isActive("heading", { level: 3 }),
            bulletList: editor.isActive("bulletList"),
            orderedList: editor.isActive("orderedList"),
            blockquote: editor.isActive("blockquote"),
            link: editor.isActive("link"),
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
          }
        : null,
  })

  // Sticky so it stays in reach while editing long instructions in a
  // scrolling sheet; opaque so text doesn't show through.
  return (
    <div className="bg-background sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-lg border-b p-1">
      {editor ? (
        <>
          <ToolbarButton
            label="Bold"
            active={state?.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <HugeiconsIcon icon={TextBoldIcon} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            active={state?.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <HugeiconsIcon icon={TextItalicIcon} strokeWidth={2} />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <ToolbarButton
            label="Heading 1"
            active={state?.h1}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <HugeiconsIcon icon={Heading01Icon} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 2"
            active={state?.h2}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <HugeiconsIcon icon={Heading02Icon} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 3"
            active={state?.h3}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <HugeiconsIcon icon={Heading03Icon} strokeWidth={2} />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <ToolbarButton
            label="Bullet list"
            active={state?.bulletList}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <HugeiconsIcon icon={LeftToRightListBulletIcon} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Numbered list"
            active={state?.orderedList}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <HugeiconsIcon icon={LeftToRightListNumberIcon} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Quote"
            active={state?.blockquote}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <HugeiconsIcon icon={QuoteDownIcon} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <HugeiconsIcon icon={SolidLine01Icon} strokeWidth={2} />
          </ToolbarButton>
          <LinkButton editor={editor} active={!!state?.link} open={linkOpen} onOpenChange={onLinkOpenChange} />

          <Separator orientation="vertical" className="mx-1 h-5" />

          <ToolbarButton
            label="Undo"
            disabled={!state?.canUndo}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <HugeiconsIcon icon={Undo02Icon} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Redo"
            disabled={!state?.canRedo}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <HugeiconsIcon icon={Redo02Icon} strokeWidth={2} />
          </ToolbarButton>
        </>
      ) : (
        // Holds the toolbar's height while the editor mounts.
        <div className="h-8" />
      )}
    </div>
  )
}

/** Adds, edits or removes a link on the selection (also opened with Ctrl/⌘+K). */
function LinkButton({
  editor,
  active,
  open,
  onOpenChange,
}: {
  editor: Editor
  active: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [url, setUrl] = useState("")
  const [text, setText] = useState("")
  // With nothing selected there's no text to turn into a link, so ask for it.
  const [needsText, setNeedsText] = useState(false)

  // Reset the fields as the popover opens — during render rather than in an
  // effect, so the popover's autofocus lands on the right first field.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setUrl(editor.getAttributes("link").href ?? "")
      setText("")
      setNeedsText(editor.state.selection.empty && !editor.isActive("link"))
    }
  }

  const apply = () => {
    const trimmed = url.trim()
    if (!trimmed) return
    const href = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
    if (needsText) {
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: text.trim() || trimmed, marks: [{ type: "link", attrs: { href } }] })
        // Keep typing after the link from extending it.
        .unsetMark("link")
        .run()
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
    }
    onOpenChange(false)
  }

  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run()
    onOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <ToolbarButton label="Link" active={active}>
          <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80"
        // Back to the text, not the toolbar button, whether the link was
        // applied or the popover was dismissed.
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          editor.commands.focus()
        }}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            // The popover is portaled out of the DOM, but React events still
            // bubble to any form the editor sits in.
            e.stopPropagation()
            apply()
          }}
        >
          {needsText && (
            <div className="space-y-1.5">
              <Label htmlFor="md-link-text" className="text-xs">
                Text
              </Label>
              <Input
                id="md-link-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What the student clicks"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="md-link-url" className="text-xs">
              Link
            </Label>
            <Input
              id="md-link-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="flex justify-end gap-2">
            {active && (
              <Button type="button" variant="ghost" size="sm" onClick={remove} className="mr-auto">
                Remove link
              </Button>
            )}
            <Button type="submit" size="sm" disabled={!url.trim()}>
              {active ? "Update" : "Add link"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function ToolbarButton({
  label,
  active = false,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { label: string; active?: boolean }) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className={cn("size-8 [&_svg]:size-4", className)}
      title={label}
      aria-label={label}
      aria-pressed={active}
      // Keep the editor's selection when the button is clicked.
      onMouseDown={(e) => e.preventDefault()}
      {...props}
    />
  )
}
