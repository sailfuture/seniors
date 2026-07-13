"use client"

import {
  computeUnitEconomics,
  parseLineItemProducts,
  type LineItem,
  type LineItemProduct,
} from "@/lib/line-items"

function money(n: number | null): string {
  if (n === null || isNaN(n)) return "—"
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const SUMMARY_LABELS: Record<string, string> = {
  unit_cost: "Per Unit Cost",
  unit_price: "Per Unit Sale Price",
  unit_margin: "Per Unit Margin",
}

/** Read-only table for one product's rows. */
export function ProductLineItemsTable({ product }: { product: LineItemProduct }) {
  const rows = product.rows
  if (rows.length === 0) return null
  const econ = computeUnitEconomics(rows)
  const body = rows.filter((r) => r.kind === "header" || r.kind === "item")
  const summary = rows.filter((r) => r.kind === "unit_cost" || r.kind === "unit_price" || r.kind === "unit_margin")

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <tbody>
          {product.name && (
            <tr className="bg-gray-100/80">
              <td colSpan={2} className="px-3 py-2 text-sm font-semibold text-gray-900">
                {product.name}
              </td>
            </tr>
          )}
          {body.map((row: LineItem, i: number) =>
            row.kind === "header" ? (
              <tr key={i} className="bg-gray-50">
                <td colSpan={2} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {row.label || "Group"}
                </td>
              </tr>
            ) : (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-1.5 text-gray-700">{row.label || "Component"}</td>
                <td className="px-3 py-1.5 text-right font-medium text-gray-900 tabular-nums">{money(row.amount)}</td>
              </tr>
            )
          )}
          {econ.components.length > 0 && (
            <tr className="border-t border-gray-200 bg-gray-50/60">
              <td className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Components total
              </td>
              <td className="px-3 py-1.5 text-right font-semibold text-gray-900 tabular-nums">{money(econ.itemsTotal)}</td>
            </tr>
          )}
          {summary.map((row, i) => (
            <tr key={`s-${i}`} className="border-t border-gray-200">
              <td className="px-3 py-1.5 font-medium text-gray-900">{SUMMARY_LABELS[row.kind] ?? row.label}</td>
              <td className="px-3 py-1.5 text-right font-bold text-gray-900 tabular-nums">{money(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Read-only rendering of a Line Items response for teacher review and public fallback. */
export function LineItemsTable({ raw }: { raw: string }) {
  const products = parseLineItemProducts(raw).filter((p) => p.rows.length > 0)
  if (products.length === 0) {
    return <p className="text-muted-foreground text-sm italic">—</p>
  }
  return (
    <div className="space-y-3">
      {products.map((p, i) => (
        <ProductLineItemsTable key={i} product={p} />
      ))}
    </div>
  )
}
