"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  NodeResizer,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
} from "@xyflow/react";
import type { Connection, EdgeProps, Node, NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Download, FileJson, ImageDown, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ColourInput, StatBox, usePersistedState } from "@/components/tools/shared";
import { ShareButton } from "@/components/tools/share-button";
import { ToolNote } from "@/components/tools/tool-note";
import { downloadBlob } from "@/lib/download";
import {
  DEFAULT_FILL,
  DEFAULT_STROKE,
  EDGE_STROKE,
  FLOW_FONT,
  FLOW_FONT_SIZE,
  FLOW_LINE_HEIGHT,
  KIND_LABELS,
  MAX_NODE_SIZE,
  NODE_DEFAULTS,
  NODE_KINDS,
  NODE_MIN,
  docBounds,
  edgePath,
  flowToSvg,
  makeFlowId,
  nodePath,
  nodeSize,
  parseFlowDoc,
  sampleFlowDoc,
  serializeFlowDoc,
  wrapText,
  type FlowDoc,
  type FlowNodeKind,
} from "@/lib/logic/flowchart";

type FlowData = {
  label: string;
  kind: FlowNodeKind;
  fill?: string;
  stroke?: string;
};

type RFNode = Node<FlowData, "flow">;

const STORAGE_KEY = "avixia:flowchart:doc";
const SHORT_LABELS: Record<FlowNodeKind, string> = {
  terminator: "Start",
  process: "Process",
  decision: "Decision",
  io: "I/O",
  connector: "Dot",
};

// Canvas text measurement shared with the SVG export so the editor and the
// exported file wrap labels identically.
let measureCtx: CanvasRenderingContext2D | null = null;
function canvasMeasure(s: string): number {
  if (typeof document === "undefined") return s.length * 7;
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
    if (measureCtx) measureCtx.font = `${FLOW_FONT_SIZE}px ${FLOW_FONT}`;
  }
  return measureCtx ? measureCtx.measureText(s).width : s.length * 7;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't render the diagram for PNG export."));
    img.src = src;
  });
}

function toDoc(nodes: RFNode[], edges: { id: string; source: string; target: string; label?: unknown }[]): FlowDoc {
  return {
    version: 1,
    nodes: nodes.map((n) => {
      const size = nodeSize({ kind: n.data.kind, w: n.width, h: n.height });
      const def = NODE_DEFAULTS[n.data.kind];
      return {
        id: n.id,
        kind: n.data.kind,
        x: Math.round(n.position.x),
        y: Math.round(n.position.y),
        label: n.data.label.slice(0, 500),
        ...(n.data.fill && n.data.fill !== DEFAULT_FILL ? { fill: n.data.fill } : {}),
        ...(n.data.stroke && n.data.stroke !== DEFAULT_STROKE ? { stroke: n.data.stroke } : {}),
        ...(size.w !== def.w ? { w: size.w } : {}),
        ...(size.h !== def.h ? { h: size.h } : {}),
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(typeof e.label === "string" && e.label ? { label: e.label.slice(0, 200) } : {}),
    })),
  };
}

function fromNodes(doc: FlowDoc): RFNode[] {
  return doc.nodes.map((n) => {
    const { w, h } = nodeSize(n);
    return {
      id: n.id,
      type: "flow",
      position: { x: n.x, y: n.y },
      data: {
        kind: n.kind,
        label: n.label,
        fill: n.fill ?? DEFAULT_FILL,
        stroke: n.stroke ?? DEFAULT_STROKE,
      },
      width: w,
      height: h,
    };
  });
}

function fromEdges(doc: FlowDoc) {
  return doc.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.label ? { label: e.label } : {}),
    type: "flow",
  }));
}

function FlowShapeNode({ data, selected, width, height }: NodeProps) {
  const d = data as unknown as FlowData;
  const { w, h } = nodeSize({ kind: d.kind, w: width ?? undefined, h: height ?? undefined });
  const min = NODE_MIN[d.kind] ?? NODE_MIN.process;
  const lines = wrapText(d.label || "", Math.max(24, w - 24), canvasMeasure);
  const cx = w / 2;
  const startY = h / 2 - ((lines.length - 1) * FLOW_LINE_HEIGHT) / 2;
  return (
    <div style={{ width: w, height: h }} className={selected ? "outline-2 outline-offset-2 outline-primary rounded" : undefined}>
      {selected && (
        <NodeResizer
          minWidth={min.w}
          minHeight={min.h}
          maxWidth={MAX_NODE_SIZE}
          maxHeight={MAX_NODE_SIZE}
          color="var(--primary)"
        />
      )}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <path
          d={nodePath(d.kind, w, h)}
          fill={d.fill || DEFAULT_FILL}
          stroke={selected ? "var(--primary)" : d.stroke || DEFAULT_STROKE}
          strokeWidth={selected ? 3 : 2}
        />
        {lines.length > 0 && (
          <text
            x={cx}
            y={startY}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={FLOW_FONT}
            fontSize={FLOW_FONT_SIZE}
            fill="#0f172a"
          >
            {lines.map((line, i) => (
              <tspan key={i} x={cx} dy={i === 0 ? 0 : FLOW_LINE_HEIGHT}>
                {line || " "}
              </tspan>
            ))}
          </text>
        )}
      </svg>
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  );
}

function FlowElbowEdge({ sourceX, sourceY, targetX, targetY, label, selected }: EdgeProps) {
  const d = edgePath(sourceX, sourceY, targetX, targetY);
  const dir = targetY >= sourceY ? 1 : -1;
  const labelText = typeof label === "string" ? label : "";
  return (
    <g>
      <path d={d} fill="none" stroke={selected ? "var(--primary)" : EDGE_STROKE} strokeWidth={selected ? 3 : 2} />
      <polygon
        points={`${targetX},${targetY} ${targetX - 5},${targetY - 8 * dir} ${targetX + 5},${targetY - 8 * dir}`}
        fill={selected ? "var(--primary)" : EDGE_STROKE}
      />
      {labelText && (
        <text
          x={(sourceX + targetX) / 2}
          y={(sourceY + targetY) / 2 - 6}
          textAnchor="middle"
          fontFamily={FLOW_FONT}
          fontSize={12}
          fill={EDGE_STROKE}
          stroke="#ffffff"
          strokeWidth={4}
          paintOrder="stroke"
        >
          {labelText}
        </text>
      )}
    </g>
  );
}

const nodeTypes = { flow: FlowShapeNode };
const edgeTypes = { flow: FlowElbowEdge };

export default function FlowchartCanvas() {
  const [saved, setSaved] = usePersistedState<FlowDoc | null>(STORAGE_KEY, null);
  const initial = useMemo(() => saved ?? sampleFlowDoc(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes, onNodesChange] = useNodesState(initial ? fromNodes(initial) : []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial ? (fromEdges(initial) as any) : []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ blob: Blob; filename: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const doc = useMemo(() => toDoc(nodes, edges), [nodes, edges]);
  useEffect(() => {
    setSaved(doc);
  }, [doc, setSaved]);

  const selectedNode = nodes.find((n) => n.selected);
  const selectedEdge = edges.find((e) => e.selected);

  const addNode = useCallback(
    (kind: FlowNodeKind) => {
      const { w, h } = NODE_DEFAULTS[kind];
      const offset = (nodes.length % 8) * 24;
      setNodes((ns) => [
        ...ns,
        {
          id: makeFlowId("n"),
          type: "flow",
          position: { x: 80 + offset, y: 80 + offset },
          data: { kind, label: SHORT_LABELS[kind], fill: DEFAULT_FILL, stroke: DEFAULT_STROKE },
          width: w,
          height: h,
        },
      ]);
      setError("");
    },
    [nodes.length, setNodes]
  );

  const updateNode = useCallback(
    (id: string, patch: Partial<FlowData>) => {
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n;
          const next = { ...n, data: { ...n.data, ...patch } };
          if (patch.kind) {
            // Keep the current box, raised to the new shape's minimums.
            const kept = nodeSize({ kind: patch.kind, w: n.width, h: n.height });
            next.width = kept.w;
            next.height = kept.h;
          }
          return next;
        })
      );
    },
    [setNodes]
  );

  const setNodeSize = useCallback(
    (id: string, w: number, h: number) => {
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n;
          const size = nodeSize({ kind: n.data.kind, w, h });
          return { ...n, width: size.w, height: size.h };
        })
      );
    },
    [setNodes]
  );

  const updateEdgeLabel = useCallback(
    (id: string, label: string) => {
      setEdges((es) => es.map((e) => (e.id === id ? { ...e, label: label || undefined } : e)));
    },
    [setEdges]
  );

  const onConnect = useCallback(
    (conn: Connection) => setEdges((es) => addEdge({ ...conn, id: makeFlowId("e"), type: "flow" }, es)),
    [setEdges]
  );

  const loadSample = useCallback(() => {
    const s = sampleFlowDoc();
    setNodes(fromNodes(s));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setEdges(fromEdges(s) as any);
    setError("");
  }, [setNodes, setEdges]);

  const clearAll = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setError("");
  }, [setNodes, setEdges]);

  const exportSvgBlob = useCallback(() => {
    const d = toDoc(nodes, edges);
    return new Blob([flowToSvg(d, canvasMeasure)], { type: "image/svg+xml;charset=utf-8" });
  }, [nodes, edges]);

  const exportSvg = useCallback(() => {
    if (nodes.length === 0) {
      setError("Add a shape first — there's nothing to export yet.");
      return;
    }
    const blob = exportSvgBlob();
    const filename = `flowchart-${Date.now()}.svg`;
    downloadBlob(blob, filename);
    setShareTarget({ blob, filename });
    setError("");
  }, [nodes.length, exportSvgBlob]);

  const exportJson = useCallback(() => {
    if (nodes.length === 0) {
      setError("Add a shape first — there's nothing to export yet.");
      return;
    }
    const blob = new Blob([serializeFlowDoc(toDoc(nodes, edges))], { type: "application/json" });
    const filename = `flowchart-${Date.now()}.json`;
    downloadBlob(blob, filename);
    setShareTarget({ blob, filename });
    setError("");
  }, [nodes, edges]);

  const exportPng = useCallback(async () => {
    if (nodes.length === 0) {
      setError("Add a shape first — there's nothing to export yet.");
      return;
    }
    setBusy(true);
    setError("");
    const svgUrl = URL.createObjectURL(exportSvgBlob());
    try {
      const d = toDoc(nodes, edges);
      const bounds = docBounds(d);
      const scale = 2;
      const img = await loadImage(svgUrl);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bounds.w * scale));
      canvas.height = Math.max(1, Math.round(bounds.h * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas isn't available in this browser.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("PNG export failed — try the SVG export instead.");
      const filename = `flowchart-${Date.now()}.png`;
      downloadBlob(blob, filename);
      setShareTarget({ blob, filename });
    } catch (e) {
      setError(e instanceof Error ? e.message : "PNG export failed.");
    } finally {
      setTimeout(() => URL.revokeObjectURL(svgUrl), 10000);
      setBusy(false);
    }
  }, [nodes, edges, exportSvgBlob]);

  const onImportFile = useCallback(
    async (file: File) => {
      setError("");
      try {
        if (file.size > 1_000_000) throw new Error("That file is too large (max 1MB).");
        const doc = parseFlowDoc(await file.text());
        setNodes(fromNodes(doc));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setEdges(fromEdges(doc) as any);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't open that file.");
      }
    },
    [setNodes, setEdges]
  );

  return (
    <div className="flex flex-col gap-4">
      <ToolNote>
        Everything runs in your browser and auto-saves here. PNG exports at 2× on a white
        background using system fonts; SVG stays crisp at any size. There&apos;s no undo yet —
        export JSON as a backup before big changes.
      </ToolNote>

      <div className="flex flex-wrap items-center gap-2">
        {NODE_KINDS.map((kind) => {
          const { w, h } = NODE_DEFAULTS[kind];
          return (
            <Button key={kind} variant="outline" size="sm" onClick={() => addNode(kind)} title={`Add ${KIND_LABELS[kind]}`}>
              <svg width="26" height="18" viewBox={`0 0 ${w} ${h}`} aria-hidden>
                <path d={nodePath(kind, w, h)} fill="none" stroke="currentColor" strokeWidth={8} />
              </svg>
              {SHORT_LABELS[kind]}
            </Button>
          );
        })}
        <div className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Button variant="ghost" size="sm" onClick={loadSample}>
          Sample
        </Button>
        <Button variant="ghost" size="sm" onClick={clearAll} disabled={nodes.length === 0 && edges.length === 0}>
          Clear
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="h-[480px] overflow-hidden rounded-lg border bg-card">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            snapToGrid
            snapGrid={[16, 16]}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
            colorMode="system"
            proOptions={{ hideAttribution: false }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#94a3b880" />
            <Controls showInteractive={false} />
            {nodes.length === 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center">
                <p className="rounded-md border bg-background/90 px-3 py-1.5 text-sm text-muted-foreground">
                  Add a shape to begin — drag to move, drag between dots to connect.
                </p>
              </div>
            )}
          </ReactFlow>
        </div>

        <aside className="grid content-start gap-4 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap gap-2">
            <StatBox label="Shapes" value={String(nodes.length)} />
            <StatBox label="Connections" value={String(edges.length)} />
          </div>

          {selectedNode ? (
            <div className="grid gap-3">
              <p className="text-sm font-semibold">Selected shape</p>
              <div className="grid gap-1.5">
                <Label htmlFor="flow-label">Label</Label>
                <Textarea
                  id="flow-label"
                  value={selectedNode.data.label}
                  maxLength={500}
                  rows={3}
                  onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="flow-kind">Shape</Label>
                <Select
                  value={selectedNode.data.kind}
                  onValueChange={(v) => updateNode(selectedNode.id, { kind: v as FlowNodeKind })}
                >
                  <SelectTrigger id="flow-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NODE_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ColourInput
                label="Fill"
                value={selectedNode.data.fill || DEFAULT_FILL}
                onChange={(v) => updateNode(selectedNode.id, { fill: v })}
              />
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["flow-w", "Width", "w"],
                    ["flow-h", "Height", "h"],
                  ] as const
                ).map(([id, label, dim]) => {
                  const size = nodeSize({
                    kind: selectedNode.data.kind,
                    w: selectedNode.width,
                    h: selectedNode.height,
                  });
                  const min = NODE_MIN[selectedNode.data.kind] ?? NODE_MIN.process;
                  return (
                    <div key={id} className="grid gap-1.5">
                      <Label htmlFor={id}>{label}</Label>
                      <Input
                        id={id}
                        type="number"
                        value={size[dim]}
                        min={min[dim]}
                        max={MAX_NODE_SIZE}
                        step={dim === "w" ? 8 : 4}
                        onChange={(e) => {
                          const v = e.target.valueAsNumber;
                          if (!Number.isFinite(v)) return;
                          setNodeSize(
                            selectedNode.id,
                            dim === "w" ? v : size.w,
                            dim === "h" ? v : size.h
                          );
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <ColourInput
                label="Line"
                value={selectedNode.data.stroke || DEFAULT_STROKE}
                onChange={(v) => updateNode(selectedNode.id, { stroke: v })}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNodes((ns) => ns.filter((n) => n.id !== selectedNode.id))}
              >
                Delete shape
              </Button>
            </div>
          ) : selectedEdge ? (
            <div className="grid gap-3">
              <p className="text-sm font-semibold">Selected connection</p>
              <div className="grid gap-1.5">
                <Label htmlFor="flow-edge-label">Label (optional)</Label>
                <Input
                  id="flow-edge-label"
                  value={typeof selectedEdge.label === "string" ? selectedEdge.label : ""}
                  maxLength={200}
                  placeholder="yes"
                  onChange={(e) => updateEdgeLabel(selectedEdge.id, e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEdges((es) => es.filter((e) => e.id !== selectedEdge.id))}
              >
                Delete connection
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a shape or connection to edit its label, shape, size, and colours. Drag a
              selected shape&apos;s corner to resize. Delete key removes the selection.
            </p>
          )}
        </aside>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={exportPng} disabled={busy || nodes.length === 0}>
          <ImageDown className="mr-2 size-4" />
          {busy ? "Exporting…" : "PNG"}
        </Button>
        <Button variant="outline" onClick={exportSvg} disabled={nodes.length === 0}>
          <Download className="mr-2 size-4" />
          SVG
        </Button>
        <Button variant="outline" onClick={exportJson} disabled={nodes.length === 0}>
          <FileJson className="mr-2 size-4" />
          JSON
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-2 size-4" />
          Open JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImportFile(f);
            e.target.value = "";
          }}
        />
        {shareTarget && (
          <ShareButton blob={shareTarget.blob} filename={shareTarget.filename} variant="outline" />
        )}
      </div>
    </div>
  );
}
