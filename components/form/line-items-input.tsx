"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LINE_ITEM_KINDS,
  computeUnitEconomics,
  parseLineItems,
  serializeLineItems,
  type LineItem,
  type LineItemKind,
} from "@/lib/line-items"

interface EditorRow {
  id: number
  kind: LineItemKind
  label: string
  amountText: string
}

let rowIdCounter = 1

function toEditorRows(items: LineItem[]): EditorRow[] {
  return items.map((r) => ({
    id: rowIdCounter++,
    kind: r.kind,
    label: r.label,
    amountText: r.amount === null ? "" : String(r.amount),
  }))
}

function fromEditorRows(rows: EditorRow[]): LineItem[] {
  return rows.map((r) => {
    const n = parseFloat(r.amountText.replace(/[^0-9.-]/g, ""))
    return { kind: r.kind, label: r.label.trim(), amount: r.kind === "header" || isNaN(n) ? null : n }
  })
}

function money(n: number | null): string {
  if (n === null || isNaN(n)) return "—"
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const kindPlaceholders: Record<LineItemKind, string> = {
  header: "e.g. Material costs",
  item: "e.g. Hoodie blank",
  unit_cost: "Per unit cost",
  unit_price: "Per unit sale price",
  unit_margin: "Per unit margin",
}

/**
 * Repeating-row editor for Line Items questions. Rows serialize to JSON in
 * the single response, so autosave and the review flow work unchanged.
 */
export function LineItemsInput({
  value,
  onChange,
  onBlur,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
}) {
  const [rows, setRows] = useState<EditorRow[]>(() => toEditorRows(parseLineItems(value)))
  const lastEmitted = useRef(value)

  // Adopt external value changes (initial load, refresh) without fighting typing
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setRows(toEditorRows(parseLineItems(value)))
      lastEmitted.current = value
    }
  }, [value])

  const emit = (next: EditorRow[]) => {
    setRows(next)
    const json = serializeLineItems(fromEditorRows(next))
    lastEmitted.current = json
    onChange(json)
  }

  const persistSoon = () => setTimeout(() => onBlur?.(), 0)

  const updateRow = (id: number, patch: Partial<EditorRow>) => {
    emit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const addRow = (kind: LineItemKind) => {
    emit([...rows, { id: rowIdCounter++, kind, label: "", amountText: "" }])
    persistSoon()
  }

  const removeRow = (id: number) => {
    emit(rows.filter((r) => r.id !== id))
    persistSoon()
  }

  const econ = computeUnitEconomics(fromEditorRows(rows))
  const usedSingletons = new Set(rows.map((r) => r.kind).filter((k) => k.startsWith("unit_")))

  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-1.5">
              <Select
                value={row.kind}
                onValueChange={(v) => {
                  updateRow(row.id, { kind: v as LineItemKind })
                  persistSoon()
                }}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 w-[168px] shrink-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINE_ITEM_KINDS.map((k) => (
                    <SelectItem
                      key={k.value}
                      value={k.value}
                      disabled={k.value.startsWith("unit_") && k.value !== row.kind && usedSingletons.has(k.value)}
                    >
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className={row.kind === "header" ? "flex-1 font-semibold" : "flex-1"}
                placeholder={kindPlaceholders[row.kind]}
                value={row.label}
                onChange={(e) => updateRow(row.id, { label: e.target.value })}
                onBlur={onBlur}
                disabled={disabled}
              />
              {row.kind !== "header" && (
                <div className="relative w-28 shrink-0">
                  <span className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm">
                    $
                  </span>
                  <Input
                    className="pl-6 text-right tabular-nums"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={row.amountText}
                    onChange={(e) => updateRow(row.id, { amountText: e.target.value })}
                    onBlur={onBlur}
                    disabled={disabled}
                  />
                </div>
              )}
              {!disabled && (
                <button
                  type="button"
                  aria-label="Remove row"
                  onClick={() => removeRow(row.id)}
                  className="text-muted-foreground hover:text-destructive flex size-8 shrink-0 items-center justify-center rounded-md transition-colors"
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => addRow("item")}>
            + Cost component
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => addRow("header")}>
            + Group header
          </Button>
          {(["unit_cost", "unit_price", "unit_margin"] as LineItemKind[])
            .filter((k) => !usedSingletons.has(k))
            .map((k) => (
              <Button key={k} type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => addRow(k)}>
                + {LINE_ITEM_KINDS.find((x) => x.value === k)?.label}
              </Button>
            ))}
        </div>
      )}

      {econ.components.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Components total <span className="font-semibold tabular-nums">{money(econ.itemsTotal)}</span>
          {econ.unitPrice !== null && econ.unitMargin !== null && (
            <>
              {" · "}margin {econ.unitMarginIsDerived ? "≈" : ""}
              <span className="font-semibold tabular-nums"> {money(econ.unitMargin)}</span>
            </>
          )}
        </p>
      )}
    </div>
  )
}
