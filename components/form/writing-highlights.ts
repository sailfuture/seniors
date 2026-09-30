import { Extension } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { flagTint } from "./writing-check"

/**
 * Writing-check highlights for the essay editor: the flagged words get an
 * inline decoration that moves with the student's edits and drops away once
 * those words change (announced with a WRITING_EDITED_EVENT on the editor
 * element, so the checklist can mark the item as being fixed). Decorations
 * aren't content — nothing is saved.
 */
export const WRITING_EDITED_EVENT = "writingcheckedited"

export interface WritingHighlight {
  index: number
  from: number
  to: number
  blocks: boolean
}

type Meta = { set: WritingHighlight[] } | { active: number | null } | { clear: true }

interface HighlightState {
  decorations: DecorationSet
  active: number | null
  /** Flags whose words the last transaction changed. */
  edited: number[]
}

interface HighlightSpec {
  index: number
  blocks: boolean
  text: string
}

export const writingHighlightsKey = new PluginKey<HighlightState>("writingHighlights")

function decorate(from: number, to: number, spec: HighlightSpec, active: number | null) {
  return Decoration.inline(
    from,
    to,
    { class: flagTint(spec.blocks, spec.index === active), "data-wc": String(spec.index) },
    spec
  )
}

export const WritingHighlights = Extension.create({
  name: "writingHighlights",

  addProseMirrorPlugins() {
    return [
      new Plugin<HighlightState>({
        key: writingHighlightsKey,
        state: {
          init: () => ({ decorations: DecorationSet.empty, active: null, edited: [] }),
          apply(tr, prev) {
            const meta = tr.getMeta(writingHighlightsKey) as Meta | undefined
            if (meta && "clear" in meta) {
              return { decorations: DecorationSet.empty, active: null, edited: [] }
            }
            if (meta && "set" in meta) {
              const decorations = meta.set
                .filter((h) => h.from < h.to && h.to <= tr.doc.content.size)
                .map((h) =>
                  decorate(h.from, h.to, { index: h.index, blocks: h.blocks, text: tr.doc.textBetween(h.from, h.to) }, null)
                )
              return { decorations: DecorationSet.create(tr.doc, decorations), active: null, edited: [] }
            }

            let decorations = prev.decorations
            let edited: number[] = []
            if (tr.docChanged) {
              decorations = decorations.map(tr.mapping, tr.doc)
              // A flag whose own words changed is being fixed: drop it.
              const changed = decorations
                .find()
                .filter((d) => tr.doc.textBetween(d.from, d.to) !== (d.spec as HighlightSpec).text)
              if (changed.length) {
                // Read the indexes first: remove() nulls out the array it's given.
                edited = changed.map((d) => (d.spec as HighlightSpec).index)
                decorations = decorations.remove(changed)
              }
            }

            const active = meta && "active" in meta ? meta.active : prev.active
            if (active !== prev.active) {
              decorations = DecorationSet.create(
                tr.doc,
                decorations.find().map((d) => decorate(d.from, d.to, d.spec as HighlightSpec, active))
              )
            }
            return { decorations, active, edited }
          },
        },
        props: {
          decorations(state) {
            return writingHighlightsKey.getState(state)?.decorations
          },
        },
        view: () => ({
          update(view, prevState) {
            // Only for a new state: the view also updates when the editor's
            // props are reset (every React render), and announcing the same
            // edit again would re-render the page into a loop.
            if (view.state === prevState) return
            const edited = writingHighlightsKey.getState(view.state)?.edited
            if (edited?.length) {
              view.dom.dispatchEvent(new CustomEvent(WRITING_EDITED_EVENT, { detail: edited }))
            }
          },
        }),
      }),
    ]
  },
})

/** The editor range currently highlighted for a flag, if it's still there. */
export function findHighlight(doc: PMNode, state: HighlightState | undefined, index: number) {
  return state?.decorations.find(0, doc.content.size, (spec) => (spec as HighlightSpec).index === index)[0]
}

const BLOCK_NODE_TYPES = new Set(["paragraph", "heading", "listItem", "blockquote", "codeBlock"])

/**
 * The essay's text exactly as extractParagraphText produces it from the
 * saved document, plus the editor position of every character (-1 for the
 * line breaks between blocks) — so offsets from a check of that text can be
 * turned back into editor ranges.
 */
export function paragraphTextMap(doc: PMNode): { text: string; pos: number[] } {
  const chars: string[] = []
  const pos: number[] = []
  const walk = (node: PMNode, contentStart: number) => {
    node.forEach((child, offset) => {
      const at = contentStart + offset
      if (child.isText) {
        const text = child.text ?? ""
        for (let i = 0; i < text.length; i++) {
          chars.push(text[i])
          pos.push(at + i)
        }
      } else if (child.childCount > 0) {
        walk(child, at + 1)
      }
      if (child.type.name === "hardBreak" || BLOCK_NODE_TYPES.has(child.type.name)) {
        chars.push("\n")
        pos.push(-1)
      }
    })
  }
  walk(doc, 0)

  // Same normalization as extractParagraphText: runs of spaces become one,
  // a line break swallows the whitespace around it, and the ends are trimmed.
  const outChars: string[] = []
  const outPos: number[] = []
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    if (c === "\n" || /\s/.test(c) === false) {
      if (c === "\n") {
        if (outChars[outChars.length - 1] === " ") {
          outChars.pop()
          outPos.pop()
        }
        outChars.push("\n")
        outPos.push(-1)
        while (i + 1 < chars.length && /\s/.test(chars[i + 1])) i++
      } else {
        outChars.push(c)
        outPos.push(pos[i])
      }
      continue
    }
    // Whitespace other than a line break: collapse the run to one space.
    outChars.push(" ")
    outPos.push(pos[i])
    while (i + 1 < chars.length && /[^\S\n]/.test(chars[i + 1])) i++
  }
  let start = 0
  let end = outChars.length
  while (start < end && /\s/.test(outChars[start])) start++
  while (end > start && /\s/.test(outChars[end - 1])) end--
  return { text: outChars.slice(start, end).join(""), pos: outPos.slice(start, end) }
}
