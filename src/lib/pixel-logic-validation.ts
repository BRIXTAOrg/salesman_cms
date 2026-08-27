// BRIXTA_PIXEL_LOGIC_KERNEL_V1
// BRIXTA_PIXEL_LOGIC_AI_BRIDGE_V1
import { getPixelLogicNodeSpec } from "@/lib/pixel-logic-registry";
import type { PixelLogicProgram } from "@/lib/pixel-logic-types";

export type PixelLogicValidationIssue = {
  severity: "error" | "warning";
  message: string;
  nodeId?: string;
  edgeId?: string;
};

export function validatePixelLogicProgram(
  program: PixelLogicProgram,
): PixelLogicValidationIssue[] {
  const issues: PixelLogicValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  for (const node of program.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({
        severity: "error",
        nodeId: node.id,
        message: `Duplicate node ID: ${node.id}`,
      });
    }
    nodeIds.add(node.id);

    if (!getPixelLogicNodeSpec(node.type)) {
      issues.push({
        severity: "error",
        nodeId: node.id,
        message: `No registered Pixel Logic node type "${node.type}".`,
      });
    }
  }

  for (const edge of program.edges) {
    if (edgeIds.has(edge.id)) {
      issues.push({
        severity: "error",
        edgeId: edge.id,
        message: `Duplicate edge ID: ${edge.id}`,
      });
    }
    edgeIds.add(edge.id);

    const from = program.nodes.find((node) => node.id === edge.fromNodeId);
    const to = program.nodes.find((node) => node.id === edge.toNodeId);

    if (!from || !to) {
      issues.push({
        severity: "error",
        edgeId: edge.id,
        message: "Edge references a node that does not exist.",
      });
      continue;
    }

    const fromSpec = getPixelLogicNodeSpec(from.type);
    const toSpec = getPixelLogicNodeSpec(to.type);
    const output = fromSpec?.outputs.find((port) => port.key === edge.fromPort);
    const input = toSpec?.inputs.find((port) => port.key === edge.toPort);

    if (!output) {
      issues.push({
        severity: "error",
        edgeId: edge.id,
        message: `${from.label ?? from.type} has no output "${edge.fromPort}".`,
      });
    }
    if (!input) {
      issues.push({
        severity: "error",
        edgeId: edge.id,
        message: `${to.label ?? to.type} has no input "${edge.toPort}".`,
      });
    }
    if (output && input && (output.kind !== edge.kind || input.kind !== edge.kind)) {
      issues.push({
        severity: "error",
        edgeId: edge.id,
        message: `Edge kind "${edge.kind}" does not match its ports.`,
      });
    }

    if (
      output &&
      input &&
      output.kind === "data" &&
      input.kind === "data"
    ) {
      const outputType = output.valueType ?? "any";
      const inputType = input.valueType ?? "any";
      if (
        outputType !== "any" &&
        inputType !== "any" &&
        outputType !== inputType
      ) {
        issues.push({
          severity: "error",
          edgeId: edge.id,
          message: `Data type mismatch: ${from.label ?? from.type}.${edge.fromPort} is ${outputType}, but ${to.label ?? to.type}.${edge.toPort} expects ${inputType}.`,
        });
      }
    }
  }

  for (const node of program.nodes) {
    const spec = getPixelLogicNodeSpec(node.type);
    if (!spec) continue;

    for (const input of spec.inputs.filter((port) => port.required)) {
      const connected = program.edges.some(
        (edge) =>
          edge.toNodeId === node.id &&
          edge.toPort === input.key &&
          edge.kind === input.kind,
      );
      if (!connected) {
        issues.push({
          severity: "warning",
          nodeId: node.id,
          message: `${node.label ?? spec.label}: required input "${input.label}" is not connected.`,
        });
      }
    }
  }

  if (
    program.enabled &&
    program.nodes.length > 0 &&
    !program.nodes.some((node) => node.type.startsWith("event."))
  ) {
    issues.push({
      severity: "warning",
      message: "Program has nodes but no event node, so nothing can start it.",
    });
  }

  // Data edges must remain acyclic. Control-flow loops can be introduced later
  // by dedicated loop nodes with explicit runtime guards.
  const dataAdj = new Map<string, string[]>();
  for (const edge of program.edges.filter((item) => item.kind === "data")) {
    dataAdj.set(edge.fromNodeId, [
      ...(dataAdj.get(edge.fromNodeId) ?? []),
      edge.toNodeId,
    ]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const next of dataAdj.get(nodeId) ?? []) {
      if (dfs(next)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  for (const node of program.nodes) {
    if (dfs(node.id)) {
      issues.push({
        severity: "error",
        nodeId: node.id,
        message: "Data dependency cycle detected.",
      });
      break;
    }
  }

  return issues;
}
