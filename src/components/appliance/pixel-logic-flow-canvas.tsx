"use client";

// BRIXTA_UNIVERSAL_INTEGRATION_V1
// React Flow owns graph-editor mechanics. PixelLogicProgram remains canonical.

import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useMemo, useRef } from "react";

import type {
  PixelLogicNodeSpec,
  PixelLogicProgram,
} from "@/lib/pixel-logic-types";

type PortView = {
  key: string;
  label: string;
  kind: "flow" | "data";
};

type LogicNodeData = Record<string, unknown> & {
  label: string;
  nodeType: string;
  kind: string;
  inputs: PortView[];
  outputs: PortView[];
};

type LogicFlowNode = Node<LogicNodeData, "logic">;

type Props = {
  program: PixelLogicProgram;
  specs: PixelLogicNodeSpec[];
  selectedNodeId: string | null;
  onProgramChange: (program: PixelLogicProgram) => void;
  onSelectNode: (nodeId: string | null) => void;
  onAddNode: (
    type: string,
    position: { x: number; y: number },
  ) => void;
};

function handleId(
  direction: "in" | "out",
  port: PortView,
) {
  return `${direction}:${port.kind}:${port.key}`;
}

function parseHandle(value: string | null | undefined) {
  const [direction, kind, ...keyParts] = String(value ?? "").split(":");
  const key = keyParts.join(":");
  if (
    (direction !== "in" && direction !== "out") ||
    (kind !== "flow" && kind !== "data") ||
    !key
  ) {
    return null;
  }
  return {
    direction,
    kind: kind as "flow" | "data",
    key,
  };
}

function LogicNodeView({ data, selected }: NodeProps<LogicFlowNode>) {
  const inputs = data.inputs;
  const outputs = data.outputs;
  const rows = Math.max(inputs.length, outputs.length, 1);

  return (
    <div
      className={[
        "relative min-w-[230px] rounded-xl border bg-background px-4 py-3 shadow-sm",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border",
      ].join(" ")}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {data.kind}
      </div>
      <div className="mt-0.5 max-w-[210px] truncate text-sm font-semibold">
        {data.label}
      </div>
      <div className="max-w-[210px] truncate font-mono text-[9px] text-muted-foreground">
        {data.nodeType}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-[10px]">
        <div className="space-y-1">
          {inputs.map((port, index) => (
            <div key={port.key} className="relative min-h-5 truncate pl-1 text-muted-foreground">
              <Handle
                id={handleId("in", port)}
                type="target"
                position={Position.Left}
                style={{ top: 72 + index * 20 }}
              />
              {port.label}
              <span className="ml-1 opacity-60">· {port.kind}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1 text-right">
          {outputs.map((port, index) => (
            <div key={port.key} className="relative min-h-5 truncate pr-1 text-muted-foreground">
              {port.label}
              <span className="ml-1 opacity-60">· {port.kind}</span>
              <Handle
                id={handleId("out", port)}
                type="source"
                position={Position.Right}
                style={{ top: 72 + index * 20 }}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: Math.max(0, rows * 3 - 3) }} />
    </div>
  );
}

const nodeTypes = {
  logic: LogicNodeView,
};

export function PixelLogicFlowCanvas({
  program,
  specs,
  selectedNodeId,
  onProgramChange,
  onSelectNode,
  onAddNode,
}: Props) {
  const instanceRef = useRef<ReactFlowInstance<LogicFlowNode, Edge> | null>(null);

  const specByType = useMemo(
    () => new Map(specs.map((spec) => [spec.type, spec])),
    [specs],
  );

  const nodes = useMemo<LogicFlowNode[]>(
    () =>
      program.nodes.map((node) => {
        const spec = specByType.get(node.type);
        return {
          id: node.id,
          type: "logic",
          position: node.position,
          selected: node.id === selectedNodeId,
          data: {
            label: node.label ?? spec?.label ?? node.type,
            nodeType: node.type,
            kind: spec?.kind ?? "custom",
            inputs: (spec?.inputs ?? []).map((port) => ({
              key: port.key,
              label: port.label,
              kind: port.kind,
            })),
            outputs: (spec?.outputs ?? []).map((port) => ({
              key: port.key,
              label: port.label,
              kind: port.kind,
            })),
          },
        };
      }),
    [program.nodes, selectedNodeId, specByType],
  );

  const edges = useMemo<Edge[]>(
    () =>
      program.edges.map((edge) => ({
        id: edge.id,
        source: edge.fromNodeId,
        target: edge.toNodeId,
        sourceHandle: `out:${edge.kind}:${edge.fromPort}`,
        targetHandle: `in:${edge.kind}:${edge.toPort}`,
        type: "smoothstep",
        label: edge.kind,
      })),
    [program.edges],
  );

  function updateNodes(changes: NodeChange<LogicFlowNode>[]) {
    const changed = applyNodeChanges(changes, nodes);
    const changedById = new Map(changed.map((node) => [node.id, node]));
    const retained = new Set(changedById.keys());

    onProgramChange({
      ...program,
      nodes: program.nodes
        .filter((node) => retained.has(node.id))
        .map((node) => ({
          ...node,
          position: changedById.get(node.id)?.position ?? node.position,
        })),
      edges: program.edges.filter(
        (edge) => retained.has(edge.fromNodeId) && retained.has(edge.toNodeId),
      ),
    });
  }

  function updateEdges(changes: EdgeChange<Edge>[]) {
    const changed = applyEdgeChanges(changes, edges);
    const retained = new Set(changed.map((edge) => edge.id));
    onProgramChange({
      ...program,
      edges: program.edges.filter((edge) => retained.has(edge.id)),
    });
  }

  function connect(connection: Connection) {
    if (!connection.source || !connection.target) return;

    const from = parseHandle(connection.sourceHandle);
    const to = parseHandle(connection.targetHandle);
    if (!from || !to || from.direction !== "out" || to.direction !== "in") {
      return;
    }
    if (from.kind !== to.kind) return;

    const targetNode = program.nodes.find((node) => node.id === connection.target);
    const targetSpec = targetNode ? specByType.get(targetNode.type) : undefined;
    const targetPort = targetSpec?.inputs.find((port) => port.key === to.key);

    const withoutOccupiedTarget = targetPort?.many
      ? program.edges
      : program.edges.filter(
          (edge) =>
            !(
              edge.toNodeId === connection.target &&
              edge.toPort === to.key &&
              edge.kind === from.kind
            ),
        );

    onProgramChange({
      ...program,
      edges: [
        ...withoutOccupiedTarget,
        {
          id: `edge_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
          kind: from.kind,
          fromNodeId: connection.source,
          fromPort: from.key,
          toNodeId: connection.target,
          toPort: to.key,
        },
      ],
    });
  }

  return (
    <div
      className="mt-4 h-[560px] overflow-hidden rounded-lg border bg-muted/[0.08]"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const type = event.dataTransfer.getData("application/x-brixta-pixel-logic");
        if (!type) return;
        const position =
          instanceRef.current?.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          }) ?? { x: 80, y: 80 };
        onAddNode(type, position);
      }}
    >
      <ReactFlow<LogicFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(instance) => {
          instanceRef.current = instance;
        }}
        onNodesChange={updateNodes}
        onEdgesChange={updateEdges}
        onConnect={connect}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onPaneClick={() => onSelectNode(null)}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={["Backspace", "Delete"]}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
