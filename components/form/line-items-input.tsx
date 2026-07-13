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
  parseLineItemProducts,
  serializeLineItemProducts,
  type LineItem,
  type LineItemKind,
  type LineItemProduct,
} from "@/lib/line-items"

interface EditorRow {
  id: number
  kind: LineItemKind
  label: string
  amountText: string
}

interface EditorProduct {
  id: number
  name: string
  rows: EditorRow[]
}

let editorIdCounter = 1

function toEditorProducts(products: LineItemProduct[]): EditorProduct[] {
  return products.map((p) => ({
    id: editorIdCounter++,
    name: p.name,
    rows: p.rows.map((r) => ({
      id: editorIdCounter++,
      kind: r.kind,
      label: r.label,
      amountText: r.amount === null ? "" : String(r.amount),
    })),
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
  item: "e.g. Oil filter",
  unit_cost: "Per unit cost",
  unit_price: "Per unit sale price",
  unit_margin: "Per unit margin",
}

/**
 * Product-scoped line-item editor: each product or service carries its own
 * named breakdown with typed rows. Everything serializes to JSON in the
 * single response, so autosave and the review flow work unchanged.
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
  const [products, setProducts] = useState<EditorProduct[]>(() => toEditorProducts(parseLineItemProducts(value)))
  const lastEmitted = useRef(value)

  // Adopt external value changes (initial load, refresh) without fighting typing
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setProducts(toEditorProducts(parseLineItemProducts(value)))
      lastEmitted.current = value
    }
  }, [value])

  const emit = (next: EditorProduct[]) => {
    setProducts(next)
    const json = serializeLineItemProducts(
      next.map((p) => ({ name: p.name, rows: fromEditorRows(p.rows) }))
    )
    lastEmitted.current = json
    onChange(json)
  }

  const persistSoon = () => setTimeout(() => onBlur?.(), 0)

  const updateProduct = (id: number, patch: Partial<EditorProduct>) => {
    emit(products.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const updateRow = (productId: number, rowId: number, patch: Partial<EditorRow>) => {
    emit(
      products.map((p) =>
        p.id === productId ? { ...p, rows: p.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) } : p
      )
    )
  }

  const addProduct = () => {
    emit([
      ...products,
      {
        id: editorIdCounter++,
        name: "",
        rows: [{ id: editorIdCounter++, kind: "item", label: "", amountText: "" }],
      },
    ])
    persistSoon()
  }

  const removeProduct = (id: number) => {
    emit(products.filter((p) => p.id !== id))
    persistSoon()
  }

  const addRow = (productId: number, kind: LineItemKind) => {
    emit(
      products.map((p) =>
        p.id === productId
          ? { ...p, rows: [...p.rows, { id: editorIdCounter++, kind, label: "", amountText: "" }] }
          : p
      )
    )
    persistSoon()
  }

  const removeRow = (productId: number, rowId: number) => {
    emit(products.map((p) => (p.id === productId ? { ...p, rows: p.rows.filter((r) => r.id !== rowId) } : p)))
    persistSoon()
  }

  return (
    <div className="space-y-3">
      {products.map((product, productIdx) => {
        const econ = computeUnitEconomics(fromEditorRows(product.rows))
        const usedSingletons = new Set(product.rows.map((r) => r.kind).filter((k) => k.startsWith("unit_")))
        return (
          <div key={product.id} className="space-y-2 rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground shrink-0 text-[10px] font-semibold uppercase tracking-wider">
                Product / Service {productIdx + 1}
              </span>
              <Input
                className="flex-1 font-semibold"
                placeholder="e.g. Oil Change"
                value={product.name}
                onChange={(e) => updateProduct(product.id, { name: e.target.value })}
                onBlur={onBlur}
                disabled={disabled}
              />
              {!disabled && (
                <button
                  type="button"
                  aria-label="Remove product"
                  onClick={() => removeProduct(product.id)}
                  className="text-muted-foreground hover:text-destructive flex size-8 shrink-0 items-center justify-center rounded-md transition-colors"
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {product.rows.length > 0 && (
              <div className="space-y-1.5">
                {product.rows.map((row) => (
                  <div key={row.id} className="flex items-center gap-1.5">
                    <Select
                      value={row.kind}
                      onValueChange={(v) => {
                        updateRow(product.id, row.id, { kind: v as LineItemKind })
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
                      onChange={(e) => updateRow(product.id, row.id, { label: e.target.value })}
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
                          onChange={(e) => updateRow(product.id, row.id, { amountText: e.target.value })}
                          onBlur={onBlur}
                          disabled={disabled}
                        />
                      </div>
                    )}
                    {!disabled && (
                      <button
                        type="button"
                        aria-label="Remove row"
                        onClick={() => removeRow(product.id, row.id)}
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
                <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => addRow(product.id, "item")}>
                  + Cost component
                </Button>
                {(["unit_cost", "unit_price", "unit_margin"] as LineItemKind[])
                  .filter((k) => !usedSingletons.has(k))
                  .map((k) => (
                    <Button key={k} type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => addRow(product.id, k)}>
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
      })}

      {!disabled && (
        <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={addProduct}>
          + Add product / service
        </Button>
      )}
    </div>
  )
}
