// Line Items question type (question_types id 13): a repeating table of
// typed rows stored as JSON in the response's student_response, so the
// standard review flow (ready / revision / complete, comments) applies to
// the whole table as a single question.

export const LINE_ITEMS_TYPE_ID = 13
export const LINE_ITEMS_TYPE_NAME = "Line Items"

export type LineItemKind = "header" | "item" | "unit_cost" | "unit_price" | "unit_margin"

export interface LineItem {
  kind: LineItemKind
  label: string
  amount: number | null
}

export const LINE_ITEM_KINDS: { value: LineItemKind; label: string; hasAmount: boolean }[] = [
  { value: "item", label: "Cost component", hasAmount: true },
  { value: "header", label: "Group header", hasAmount: false },
  { value: "unit_cost", label: "Per unit cost", hasAmount: true },
  { value: "unit_price", label: "Per unit sale price", hasAmount: true },
  { value: "unit_margin", label: "Per unit margin", hasAmount: true },
]

export function isLineItemsQuestion(q: {
  question_types_id?: number | null
  _question_types?: { id?: number; type?: string } | null
}): boolean {
  const typeId = q.question_types_id ?? q._question_types?.id ?? null
  return typeId === LINE_ITEMS_TYPE_ID || q._question_types?.type === LINE_ITEMS_TYPE_NAME
}

export function parseLineItems(raw: string | null | undefined): LineItem[] {
  if (!raw || !raw.trim()) return []
  try {
    const data = JSON.parse(raw)
    const rows = Array.isArray(data) ? data : data?.rows
    if (!Array.isArray(rows)) return []
    return rows
      .filter((r) => r && typeof r === "object")
      .map((r) => ({
        kind: (["header", "item", "unit_cost", "unit_price", "unit_margin"].includes(r.kind)
          ? r.kind
          : "item") as LineItemKind,
        label: typeof r.label === "string" ? r.label : "",
        amount: typeof r.amount === "number" && !isNaN(r.amount) ? r.amount : null,
      }))
  } catch {
    return []
  }
}

export function serializeLineItems(rows: LineItem[]): string {
  if (rows.length === 0) return ""
  return JSON.stringify({ rows })
}

// ── Products: each product/service carries its own breakdown ──────────────

export interface LineItemProduct {
  name: string
  rows: LineItem[]
}

/**
 * Parse a response into products. Supports the current shape
 * `{ products: [{ name, rows }] }` and migrates the legacy flat
 * `{ rows: [...] }` shape into a single unnamed product.
 */
export function parseLineItemProducts(raw: string | null | undefined): LineItemProduct[] {
  if (!raw || !raw.trim()) return []
  try {
    const data = JSON.parse(raw)
    if (Array.isArray(data?.products)) {
      return data.products
        .filter((p: unknown) => p && typeof p === "object")
        .map((p: { name?: unknown; rows?: unknown }) => ({
          name: typeof p.name === "string" ? p.name : "",
          rows: parseLineItems(JSON.stringify({ rows: p.rows ?? [] })),
        }))
    }
  } catch {
    return []
  }
  const legacyRows = parseLineItems(raw)
  return legacyRows.length > 0 ? [{ name: "", rows: legacyRows }] : []
}

export function serializeLineItemProducts(products: LineItemProduct[]): string {
  const kept = products.filter((p) => p.name.trim() || p.rows.length > 0)
  if (kept.length === 0) return ""
  return JSON.stringify({ products: kept })
}

export interface UnitEconomics {
  /** Cost components in order, with the group header (if any) they sit under. */
  components: { name: string; cost: number | null; group?: string }[]
  itemsTotal: number
  /** Explicit unit-cost row if present, else the components total. */
  unitCost: number | null
  unitCostIsDerived: boolean
  unitPrice: number | null
  /** Explicit margin row if present, else price − cost when both known. */
  unitMargin: number | null
  unitMarginIsDerived: boolean
}

export function computeUnitEconomics(rows: LineItem[]): UnitEconomics {
  const components: UnitEconomics["components"] = []
  let currentGroup: string | undefined
  let unitCost: number | null = null
  let unitPrice: number | null = null
  let unitMargin: number | null = null

  for (const row of rows) {
    if (row.kind === "header") {
      currentGroup = row.label || undefined
    } else if (row.kind === "item") {
      if (row.label || row.amount !== null) {
        components.push({ name: row.label || "Component", cost: row.amount, group: currentGroup })
      }
    } else if (row.kind === "unit_cost") {
      unitCost = row.amount
    } else if (row.kind === "unit_price") {
      unitPrice = row.amount
    } else if (row.kind === "unit_margin") {
      unitMargin = row.amount
    }
  }

  const itemsTotal = components.reduce((acc, c) => acc + (c.cost ?? 0), 0)
  const unitCostIsDerived = unitCost === null && components.length > 0
  const effectiveCost = unitCost ?? (components.length > 0 ? itemsTotal : null)
  const unitMarginIsDerived = unitMargin === null && unitPrice !== null && effectiveCost !== null

  return {
    components,
    itemsTotal,
    unitCost: effectiveCost,
    unitCostIsDerived,
    unitPrice,
    unitMargin: unitMargin ?? (unitMarginIsDerived ? unitPrice! - effectiveCost! : null),
    unitMarginIsDerived,
  }
}
