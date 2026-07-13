"use client"

import { useMemo } from "react"
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useBrandTheme, inkFor } from "@/components/brand-display"

export interface UnitComponent {
  name: string
  cost: number | null
  group?: string
}

function money(n: number | null): string {
  if (n === null || isNaN(n)) return "—"
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const hiddenHandle: React.CSSProperties = {
  opacity: 0,
  width: 1,
  height: 1,
  minWidth: 1,
  minHeight: 1,
  border: 0,
  pointerEvents: "none",
}

function ComponentNode({ data }: NodeProps) {
  const d = data as { label: string; cost: number | null; group?: string }
  return (
    <div className="w-[200px] rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 shadow-sm">
      {d.group && (
        <p className="text-muted-foreground mb-0.5 truncate text-[9px] font-semibold uppercase tracking-wider">
          {d.group}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm font-medium text-gray-800">{d.label}</span>
        <span className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">{money(d.cost)}</span>
      </div>
      <Handle type="source" position={Position.Right} style={hiddenHandle} />
    </div>
  )
}

function StatNode({ data }: NodeProps) {
  const d = data as {
    label: string
    value: string
    caption?: string
    captionTone?: "muted" | "warn"
    fill?: string
    border?: string
    hasTarget?: boolean
    hasSource?: boolean
  }
  const filled = !!d.fill
  const ink = filled ? inkFor(d.fill!) : undefined
  return (
    <div
      className="w-[210px] rounded-xl border-2 bg-white px-4 py-3 shadow-sm"
      style={{ borderColor: d.border ?? "#E5E7EB", background: d.fill ?? "#FFFFFF" }}
    >
      {d.hasTarget && <Handle type="target" position={Position.Left} style={hiddenHandle} />}
      <p
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: filled ? ink : "#6B7280", opacity: filled ? 0.75 : 1 }}
      >
        {d.label}
      </p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums" style={{ color: filled ? ink : "#111827" }}>
        {d.value}
      </p>
      {d.caption && (
        <p
          className="mt-1 text-[11px] leading-snug"
          style={{ color: filled ? ink : d.captionTone === "warn" ? "#B45309" : "#9CA3AF", opacity: filled ? 0.7 : 1 }}
        >
          {d.caption}
        </p>
      )}
      {d.hasSource && <Handle type="source" position={Position.Right} style={hiddenHandle} />}
    </div>
  )
}

const nodeTypes = { component: ComponentNode, stat: StatNode }

/**
 * Display-only diagram of a product's unit economics: component costs flow
 * into the per-unit cost, which combines with the sale price to produce the
 * margin. Layout is deterministic; all interaction is disabled so it reads
 * as a graphic, not a widget.
 */
export function UnitEconomicsFlow({
  components,
  unitCost,
  unitCostDerived = false,
  salePrice,
  margin,
  marginDerived = false,
}: {
  components: UnitComponent[]
  unitCost: number | null
  unitCostDerived?: boolean
  salePrice: number | null
  margin: number | null
  marginDerived?: boolean
}) {
  const brand = useBrandTheme()

  const { nodes, edges } = useMemo(() => {
    const primary = brand.primary ?? "#111827"
    const primaryInk = brand.hasBrand ? brand.primaryInk : "#111827"
    const edgeColor = brand.hasBrand ? brand.primaryInk : "#9CA3AF"

    const costVal = unitCost
    const priceVal = salePrice
    const marginVal = margin

    const knownCosts = components.filter((c) => c.cost !== null)
    const componentsSum = knownCosts.reduce((acc, c) => acc + (c.cost ?? 0), 0)
    const sumMatches =
      unitCostDerived || costVal === null || knownCosts.length === 0 || Math.abs(componentsSum - costVal) < 0.01

    const nodes: Node[] = []
    const edges: Edge[] = []

    const compHeight = 58
    const compGap = 26
    const compBlockHeight = components.length * compHeight + (components.length - 1) * compGap
    const costY = Math.max(compBlockHeight / 2 - 45, 60)

    components.forEach((c, i) => {
      nodes.push({
        id: `comp-${i}`,
        type: "component",
        position: { x: 0, y: i * (compHeight + compGap) },
        data: { label: c.name, cost: c.cost, group: c.group },
      })
      edges.push({
        id: `e-comp-${i}`,
        source: `comp-${i}`,
        target: "cost",
        style: { stroke: edgeColor, strokeWidth: 1.5, opacity: 0.55 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 16, height: 16 },
      })
    })

    nodes.push({
      id: "cost",
      type: "stat",
      position: { x: 330, y: costY },
      data: {
        label: "Per Unit Cost",
        value: money(costVal),
        caption:
          knownCosts.length > 0
            ? sumMatches
              ? `= ${knownCosts.length} component${knownCosts.length === 1 ? "" : "s"}`
              : `components total ${money(componentsSum)}`
            : undefined,
        captionTone: sumMatches ? "muted" : "warn",
        border: primaryInk,
        hasTarget: true,
        hasSource: true,
      },
    })

    nodes.push({
      id: "price",
      type: "stat",
      position: { x: 330, y: Math.max(costY - 160, -110) },
      data: { label: "Per Unit Sale Price", value: money(priceVal), hasSource: true },
    })

    const marginY = (Math.max(costY - 160, -110) + costY) / 2
    nodes.push({
      id: "margin",
      type: "stat",
      position: { x: 660, y: marginY },
      data: {
        label: "Per Unit Margin",
        value: money(marginVal),
        caption: marginDerived ? "= sale price − unit cost" : "sale price − unit cost",
        fill: primary,
        border: primary,
        hasTarget: true,
      },
    })

    for (const source of ["price", "cost"]) {
      edges.push({
        id: `e-${source}-margin`,
        source,
        target: "margin",
        style: { stroke: edgeColor, strokeWidth: 1.5, opacity: 0.55 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 16, height: 16 },
      })
    }

    return { nodes, edges }
  }, [components, unitCost, unitCostDerived, salePrice, margin, marginDerived, brand])

  // Uncontrolled flow with a data-keyed remount: a static diagram needs no
  // change handlers, and controlled mode without them never commits node
  // measurements, which keeps edges from rendering.
  const flowKey = `${components.map((c) => `${c.name}:${c.cost}`).join("|")}|${unitCost}|${salePrice}|${margin}|${brand.primary}`

  return (
    <div className="h-[380px] w-full">
      <ReactFlow
        key={flowKey}
        defaultNodes={nodes}
        defaultEdges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#E5E7EB" />
      </ReactFlow>
    </div>
  )
}
