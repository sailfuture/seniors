"use client"

import { useMemo } from "react"
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useBrandTheme } from "@/components/brand-display"

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
  const d = data as { label: string; cost: number | null }
  return (
    <div className="w-[200px] rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 shadow-sm">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-red-400">Cost component</p>
      <div className="mt-0.5 flex items-center justify-between gap-3">
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
    border: string
    tint?: string
    accent?: string
    hasTarget?: boolean
    hasSource?: boolean
  }
  return (
    <div
      className="w-[210px] rounded-xl border-2 px-4 py-3 shadow-sm"
      style={{ borderColor: d.border, background: d.tint ?? "#FFFFFF" }}
    >
      {d.hasTarget && <Handle type="target" position={Position.Left} style={hiddenHandle} />}
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{d.label}</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums" style={{ color: d.accent ?? "#111827" }}>
        {d.value}
      </p>
      {d.caption && (
        <p
          className="mt-1 text-[11px] leading-snug"
          style={{ color: d.captionTone === "warn" ? "#B45309" : "#9CA3AF" }}
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
    const primaryInk = brand.hasBrand ? brand.primaryInk : "#111827"
    const edgeColor = brand.hasBrand ? brand.primaryInk : "#9CA3AF"
    // Solid, weighted connectors read as prominent flow lines against the
    // dotted grid behind them.
    const edgeStyle = { stroke: edgeColor, strokeWidth: 2, strokeLinecap: "round" as const, opacity: 0.9 }
    const edgeMarker = { type: MarkerType.Arrow, color: edgeColor, width: 20, height: 20, strokeWidth: 1.5 }

    const costVal = unitCost
    const priceVal = salePrice
    const marginVal = margin

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
        style: edgeStyle,
        markerEnd: edgeMarker,
      })
    })

    // Cost = red (expense), Sale Price = green (revenue), Margin = branded.
    nodes.push({
      id: "cost",
      type: "stat",
      position: { x: 330, y: costY },
      data: {
        label: "Per Unit Cost",
        value: money(costVal),
        border: "#FECACA",
        tint: "#FEF2F2",
        hasTarget: true,
        hasSource: true,
      },
    })

    nodes.push({
      id: "price",
      type: "stat",
      position: { x: 330, y: Math.max(costY - 160, -110) },
      data: {
        label: "Per Unit Sale Price",
        value: money(priceVal),
        border: "#BBF7D0",
        tint: "#F0FDF4",
        hasSource: true,
      },
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
        border: primaryInk,
        tint: "#FFFFFF",
        accent: primaryInk,
        hasTarget: true,
      },
    })

    for (const source of ["price", "cost"]) {
      edges.push({
        id: `e-${source}-margin`,
        source,
        target: "margin",
        style: edgeStyle,
        markerEnd: edgeMarker,
      })
    }

    return { nodes, edges }
  }, [components, unitCost, unitCostDerived, salePrice, margin, marginDerived, brand])

  // Uncontrolled flow with a data-keyed remount: a static diagram needs no
  // change handlers, and controlled mode without them never commits node
  // measurements, which keeps edges from rendering.
  const flowKey = `${components.map((c) => `${c.name}:${c.cost}`).join("|")}|${unitCost}|${salePrice}|${margin}|${brand.primary}`

  return (
    <div className="h-[380px] w-full overflow-hidden rounded-xl border border-gray-200">
      <ReactFlow
        key={flowKey}
        defaultNodes={nodes}
        defaultEdges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.4}
        maxZoom={1.75}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        panOnDrag
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={2} color="#CBD5E1" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  )
}
