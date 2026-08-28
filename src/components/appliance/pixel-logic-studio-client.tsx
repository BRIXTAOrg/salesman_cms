// BRIXTA_PIXEL_LOGIC_KERNEL_V1
// BRIXTA_PIXEL_LOGIC_AI_BRIDGE_V1
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
} from "react";
import {
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Zap,
} from "lucide-react";

import type { Responsibility } from "@/lib/appliance-types";
import type { ResponsibilityExtensionConfig } from "@/lib/platform-vnext-types";
import {
  getPixelLogicNodeSpec,
  listPixelLogicNodeSpecs,
} from "@/lib/pixel-logic-registry";
import {
  autoLayoutPixelLogicProgram,
  buildPixelLogicAIContext,
  parsePixelLogicAIImport,
  pixelLogicRegistryFingerprint,
  type PixelLogicAIImportResult,
} from "@/lib/pixel-logic-ai-bridge";
import {
  blankPixelLogicProgram,
  normalizePixelLogicProgram,
  PIXEL_LOGIC_METADATA_KEY,
  type PixelLogicNode,
  type PixelLogicPortKind,
  type PixelLogicProgram,
} from "@/lib/pixel-logic-types";
import {
  validatePixelLogicProgram,
  type PixelLogicValidationIssue,
} from "@/lib/pixel-logic-validation";
import { validatePixelLogicAgainstResponsibility } from "@/lib/pixel-logic-context-validation";

import {
  applyPixelRealityToKernel,
} from "@/lib/pixel-reality-compiler";

import {
  PIXEL_REALITY_METADATA_KEY,
  normalizePixelReality,
  type PixelRealityProposal,
} from "@/lib/pixel-reality-types";

import {
  RESPONSIBILITY_KERNEL_METADATA_KEY,
  type ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";

import { apiJson } from "./client";
import {
  EmptyState,
  Field,
  inputClass,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
} from "./primitives";

type ExtensionResponse = {
  extension: {
    draftConfig: ResponsibilityExtensionConfig;
    publishedVersion: number;
  };
};

function randomKey(prefix: string) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`;
}

function asKernel(
  extension: ResponsibilityExtensionConfig | null,
): ResponsibilityKernel | null {
  const candidate = extension?.metadata?.[RESPONSIBILITY_KERNEL_METADATA_KEY];
  return candidate &&
    typeof candidate === "object" &&
    !Array.isArray(candidate) &&
    (candidate as { kernelVersion?: unknown }).kernelVersion === 3
    ? (candidate as ResponsibilityKernel)
    : null;
}

function programFromExtension(
  extension: ResponsibilityExtensionConfig | null,
  title?: string,
) {
  const raw = extension?.metadata?.[PIXEL_LOGIC_METADATA_KEY];
  return raw
    ? normalizePixelLogicProgram(raw, `${title ?? "Responsibility"} Logic`)
    : blankPixelLogicProgram(`${title ?? "Responsibility"} Logic`);
}

function withProgram(
  extension: ResponsibilityExtensionConfig,
  program: PixelLogicProgram,
): ResponsibilityExtensionConfig {
  return {
    ...extension,
    metadata: {
      ...(extension.metadata ?? {}),
      [PIXEL_LOGIC_METADATA_KEY]: {
        ...program,
        metadata: {
          ...program.metadata,
          updatedAt: new Date().toISOString(),
        },
      },
    },
  };
}

/*
 * PIXEL REALITY IS NOT VALIDATION METADATA.
 *
 * It is the business declaration layer that must be compiled into the
 * canonical Responsibility Kernel.
 *
 * Pixel Program:
 *   "when approve_leave happens..."
 *
 * Pixel Reality:
 *   "approve_leave exists, belongs to reporting_manager, and is available
 *    in pending_manager."
 *
 * Both halves must survive import/save/publish.
 */
function withReality(
  extension: ResponsibilityExtensionConfig,
  reality: PixelRealityProposal,
): ResponsibilityExtensionConfig {
  const currentKernel =
    asKernel(extension);

  const nextKernel =
    applyPixelRealityToKernel(
      currentKernel,
      reality,
    );

  return {
    ...extension,

    metadata: {
      ...(extension.metadata ?? {}),

      [PIXEL_REALITY_METADATA_KEY]:
        reality,

      [RESPONSIBILITY_KERNEL_METADATA_KEY]:
        nextKernel,
    },
  };
}

export default function PixelLogicStudioClient() {
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [responsibilityId, setResponsibilityId] = useState<number | null>(null);
  const [extension, setExtension] =
    useState<ResponsibilityExtensionConfig | null>(null);
  const [program, setProgram] = useState<PixelLogicProgram>(
    blankPixelLogicProgram(),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [fromNodeId, setFromNodeId] = useState("");
  const [fromPort, setFromPort] = useState("");
  const [toNodeId, setToNodeId] = useState("");
  const [toPort, setToPort] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiImportText, setAiImportText] = useState("");
  const [aiImportResult, setAiImportResult] =
    useState<PixelLogicAIImportResult | null>(null);
  const [aiIssues, setAiIssues] = useState<PixelLogicValidationIssue[]>([]);

  const selectedResponsibility = useMemo(
    () => responsibilities.find((item) => item.id === responsibilityId) ?? null,
    [responsibilities, responsibilityId],
  );

  const kernel = useMemo(() => asKernel(extension), [extension]);
  const nodeSpecs = useMemo(() => listPixelLogicNodeSpecs(), []);
  const categories = useMemo(
    () => [...new Set(nodeSpecs.map((item) => item.category))],
    [nodeSpecs],
  );

  const selectedNode = useMemo(
    () => program.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [program.nodes, selectedNodeId],
  );
  const selectedSpec = selectedNode
    ? getPixelLogicNodeSpec(selectedNode.type)
    : undefined;

  const fromNode = program.nodes.find((node) => node.id === fromNodeId);
  const toNode = program.nodes.find((node) => node.id === toNodeId);
  const fromSpec = fromNode ? getPixelLogicNodeSpec(fromNode.type) : undefined;
  const toSpec = toNode ? getPixelLogicNodeSpec(toNode.type) : undefined;

  const validation = useMemo(
    () => [
      ...validatePixelLogicProgram(program),
      ...validatePixelLogicAgainstResponsibility(program, kernel),
    ],
    [program, kernel],
  );
  const errorCount = validation.filter((item) => item.severity === "error").length;
  const warningCount = validation.filter(
    (item) => item.severity === "warning",
  ).length;

  const loadBase = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const body = await apiJson<{ responsibilities: Responsibility[] }>(
        "/api/appliance/responsibilities",
      );
      const active = (body.responsibilities ?? []).filter(
        (item) => item.isActive !== false,
      );
      setResponsibilities(active);
      setResponsibilityId((current) =>
        current && active.some((item) => item.id === current)
          ? current
          : (active[0]?.id ?? null),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Responsibilities.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(
    async (id: number) => {
      setLoading(true);
      setMessage(null);
      try {
        const body = await apiJson<ExtensionResponse>(
          `/api/platform/responsibility-extensions/${id}`,
        );
        const nextExtension = body.extension.draftConfig;
        const title =
          responsibilities.find((item) => item.id === id)?.title ??
          "Responsibility";
        setExtension(nextExtension);
        setProgram(programFromExtension(nextExtension, title));
        setSelectedNodeId(null);
        setAiImportResult(null);
        setAiIssues([]);
        setAiImportText("");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load Pixel Logic.",
        );
      } finally {
        setLoading(false);
      }
    },
    [responsibilities],
  );

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (responsibilityId) void loadDetail(responsibilityId);
  }, [responsibilityId, loadDetail]);

  function addNode(
    type: string,
    config: Record<string, unknown> = {},
    label?: string,
  ) {
    const spec = getPixelLogicNodeSpec(type);
    if (!spec) {
      setMessage(`Node type "${type}" is not registered.`);
      return;
    }
    const id = randomKey("pixel");
    const next: PixelLogicNode = {
      id,
      type,
      label: label ?? spec.label,
      position: {
        x: (program.nodes.length % 4) * 220,
        y: Math.floor(program.nodes.length / 4) * 140,
      },
      config,
    };
    setProgram((current) => ({
      ...current,
      nodes: [...current.nodes, next],
    }));
    setSelectedNodeId(id);
  }

  function removeNode(id: string) {
    setProgram((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.id !== id),
      edges: current.edges.filter(
        (edge) => edge.fromNodeId !== id && edge.toNodeId !== id,
      ),
    }));
    if (selectedNodeId === id) setSelectedNodeId(null);
  }

  function updateSelectedNodeConfig(key: string, value: unknown) {
    if (!selectedNodeId) return;
    setProgram((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === selectedNodeId
          ? { ...node, config: { ...node.config, [key]: value } }
          : node,
      ),
    }));
  }

  function beginPaletteDrag(event: DragEvent<HTMLButtonElement>, type: string) {
    event.dataTransfer.setData("application/x-brixta-pixel-logic", type);
    event.dataTransfer.effectAllowed = "copy";
  }

  function dropOnCanvas(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const type = event.dataTransfer.getData(
      "application/x-brixta-pixel-logic",
    );
    if (type) addNode(type);
  }

  function connectNodes() {
    if (!fromNode || !toNode || !fromSpec || !toSpec || !fromPort || !toPort) {
      setMessage("Choose source node/port and target node/port.");
      return;
    }

    const output = fromSpec.outputs.find((item) => item.key === fromPort);
    const input = toSpec.inputs.find((item) => item.key === toPort);
    if (!output || !input || output.kind !== input.kind) {
      setMessage("Only matching Data→Data or Flow→Flow ports can be connected.");
      return;
    }

    const kind = output.kind as PixelLogicPortKind;
    setProgram((current) => ({
      ...current,
      edges: [
        ...current.edges.filter(
          (edge) =>
            !(
              edge.toNodeId === toNode.id &&
              edge.toPort === toPort &&
              !input.many
            ),
        ),
        {
          id: randomKey("edge"),
          kind,
          fromNodeId: fromNode.id,
          fromPort,
          toNodeId: toNode.id,
          toPort,
        },
      ],
    }));
    setMessage(`${kind === "flow" ? "Flow" : "Data"} connection added.`);
  }

  async function copyAIContext() {
    if (!selectedResponsibility) {
      setMessage("Choose a Responsibility before generating AI context.");
      return;
    }

    try {
      const context = buildPixelLogicAIContext({
        responsibilityId: selectedResponsibility.id,
        responsibilityTitle: selectedResponsibility.title,
        kernel,
        currentProgram: program,
      });
      await navigator.clipboard.writeText(context);
      setMessage(
        "AI context copied. Paste it into ChatGPT, add your business requirement, then paste the returned JSON back here.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to copy Pixel Logic AI context.",
      );
    }
  }

  function validateAIImport() {
    if (!selectedResponsibility) return;
    try {
      const result = parsePixelLogicAIImport(
        aiImportText,
        `${selectedResponsibility.title} Logic`,
      );
      /*
       * AI may declare brand-new business actors/actions/states.
       *
       * Validate the Pixel graph against:
       *
       *   EXISTING RESPONSIBILITY
       *            +
       *   PROPOSED PIXEL REALITY
       *
       * rather than against the stale Kernel that existed before import.
       */
      const proposedKernel =
        applyPixelRealityToKernel(
          kernel,
          result.reality,
        );

      const issues: PixelLogicValidationIssue[] = [
        ...validatePixelLogicProgram(
          result.program,
        ),

        ...validatePixelLogicAgainstResponsibility(
          result.program,
          proposedKernel,
        ),
      ];

      const currentFingerprint = pixelLogicRegistryFingerprint();
      if (
        result.registryFingerprint &&
        result.registryFingerprint !== currentFingerprint
      ) {
        issues.push({
          severity: "warning",
          message: `This AI result was generated against registry ${result.registryFingerprint}, while the current registry is ${currentFingerprint}. It has been revalidated against the current registry.`,
        });
      }

      if (
        result.responsibilityId !== undefined &&
        String(result.responsibilityId) !== String(selectedResponsibility.id)
      ) {
        issues.push({
          severity: "error",
          message: `AI result targets Responsibility ${String(result.responsibilityId)}, not the currently selected Responsibility ${selectedResponsibility.id}.`,
        });
      }

      if (result.unsupportedCapabilities.length > 0) {
        issues.push({
          severity: "error",
          message: `The requested workflow needs unsupported capabilities: ${result.unsupportedCapabilities.join(", ")}. Install/register those capabilities or revise the workflow before importing.`,
        });
      }

      setAiImportResult(result);
      setAiIssues(issues);
      const errors = issues.filter((item) => item.severity === "error").length;
      setMessage(
        errors > 0
          ? `AI logic parsed, but ${errors} blocking validation error${errors === 1 ? "" : "s"} must be fixed.`
          : "AI logic is valid for this Responsibility. Review it, then import it into the canvas.",
      );
    } catch (error) {
      setAiImportResult(null);
      setAiIssues([
        {
          severity: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to parse AI-generated Pixel Logic.",
        },
      ]);
      setMessage("AI import could not be validated.");
    }
  }

  function applyAIImport() {
    if (!aiImportResult) return;
    if (aiIssues.some((item) => item.severity === "error")) {
      setMessage("Fix the blocking AI import errors before importing.");
      return;
    }

    if (!extension) {
      setMessage(
        "Responsibility extension is not loaded.",
      );
      return;
    }

    const next =
      autoLayoutPixelLogicProgram(
        aiImportResult.program,
      );

    /*
     * THIS WAS THE MISSING BRIDGE.
     *
     * Previously we imported only `program`.
     * The AI's `reality` declarations were thrown away, so events could
     * reference approve_leave while the actual Responsibility Kernel had
     * no approve_leave action at all.
     */
    const nextExtension =
      withReality(
        extension,
        aiImportResult.reality,
      );

    setExtension(
      nextExtension,
    );

    setProgram({
      ...next,

      metadata: {
        ...next.metadata,

        generatedBy:
          next.metadata.generatedBy ??
          "external-ai",

        updatedAt:
          new Date().toISOString(),
      },
    });
    setSelectedNodeId(null);
    setFromNodeId("");
    setFromPort("");
    setToNodeId("");
    setToPort("");
    setAiOpen(false);
    setMessage(
      "AI Pixel Logic imported into the canvas. Review the graph and Validation panel, then click Save logic.",
    );
  }

  async function save() {
    if (!responsibilityId || !extension) return;
    if (errorCount > 0) {
      setMessage("Fix Pixel Logic validation errors before saving.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      /*
       * Defensive repair:
       *
       * If this Responsibility already carries Pixel Reality, always
       * rematerialize it into the Kernel before Save + Publish.
       *
       * This makes stale-Kernel publication much harder to reintroduce.
       */
      const storedRealityRaw =
        extension.metadata
          ?.[PIXEL_REALITY_METADATA_KEY];

      const extensionWithReality =
        storedRealityRaw
          ? withReality(
              extension,
              normalizePixelReality(
                storedRealityRaw,
              ),
            )
          : extension;

      const nextExtension =
        withProgram(
          extensionWithReality,
          program,
        );

      await apiJson(
        `/api/platform/responsibility-extensions/${responsibilityId}`,
        {
          method: "PUT",
          body: JSON.stringify({ config: nextExtension }),
        },
      );

      // BRIXTA_PIXEL_LOGIC_SAVE_AND_PUBLISH_V1
      //
      // Logic is application behavior. Once the graph passes
      // validation, Save Logic publishes the Responsibility so
      // runtime does not continue executing a stale graph.
      const publishResult =
        await apiJson<{
          success: boolean;
          version?: number;
          message?: string;
        }>(
          `/api/platform/responsibility-extensions/${responsibilityId}/publish`,
          {
            method: "POST",
          },
        );

      setExtension(
        nextExtension,
      );

      setMessage(
        publishResult.version
          ? `Pixel Logic saved + published as Responsibility version ${publishResult.version}.`
          : "Pixel Logic saved + published.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save Pixel Logic.",
      );
    } finally {
      setSaving(false);
    }
  }

  const actionPorts =
    kernel?.possibilities
      .filter(
        (
          item,
        ): item is Extract<
          ResponsibilityKernel["possibilities"][number],
          { type: "action" }
        > => item.type === "action",
      )
      .map((item) => item.action) ?? [];

  const capturePorts =
    kernel?.possibilities
      .filter(
        (
          item,
        ): item is Extract<
          ResponsibilityKernel["possibilities"][number],
          { type: "capture" }
        > => item.type === "capture",
      )
      .map((item) => item.capture) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-5">
      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              <div className="text-xl font-semibold">Pixel Logic</div>
              <Pill tone={program.enabled ? "info" : undefined}>
                {program.enabled ? "enabled" : "disabled"}
              </Pill>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Wire the selected Responsibility&apos;s events, data, calculations,
              conditions and effects. This extends the existing builder; it does
              not replace it.
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Field label="Responsibility">
              <select
                value={responsibilityId ?? ""}
                onChange={(event) =>
                  setResponsibilityId(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                className={inputClass}
              >
                {responsibilities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </Field>

            <SecondaryButton type="button" onClick={() => void loadBase()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </SecondaryButton>

            <SecondaryButton
              type="button"
              onClick={() => setAiOpen((current) => !current)}
              disabled={!selectedResponsibility || loading}
            >
              <Zap className="h-4 w-4" />
              Generate with AI
            </SecondaryButton>

            <PrimaryButton
              type="button"
              onClick={() => void save()}
              disabled={saving || loading || !extension}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save logic
            </PrimaryButton>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={program.enabled}
              onChange={(event) =>
                setProgram((current) => ({
                  ...current,
                  enabled: event.target.checked,
                }))
              }
            />
            Program enabled
          </label>
          <Pill>{program.nodes.length} nodes</Pill>
          <Pill>{program.edges.length} wires</Pill>
          <Pill tone={errorCount ? "danger" : undefined}>
            {errorCount} errors
          </Pill>
          <Pill tone={warningCount ? "warning" : undefined}>
            {warningCount} warnings
          </Pill>
          {selectedResponsibility && (
            <span className="text-muted-foreground">
              Draft logic for {selectedResponsibility.title}
            </span>
          )}
        </div>
      </Panel>

      {message && (
        <Panel className="py-3">
          <div className="text-sm">{message}</div>
        </Panel>
      )}

      {aiOpen && selectedResponsibility && (
        <Panel>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-base font-semibold">Generate with AI</div>
              <div className="mt-1 max-w-3xl text-sm text-muted-foreground">
                BRIXTA exports the live Pixel Logic Registry plus this Responsibility's
                actions, captures, contexts, states and actors. ChatGPT is constrained
                to that contract; BRIXTA still validates everything before import.
              </div>
            </div>
            <Pill>{pixelLogicRegistryFingerprint()}</Pill>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="text-sm font-semibold">1. Copy BRIXTA AI context</div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Paste this into ChatGPT and add your business requirement after the
                BUSINESS REQUIREMENT marker. The Registry is the language; GPT is
                only composing legal blocks from it.
              </div>
              <div className="mt-4">
                <PrimaryButton type="button" onClick={() => void copyAIContext()}>
                  Copy AI context
                </PrimaryButton>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-sm font-semibold">2. Paste generated Pixel Logic</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Paste the JSON object ChatGPT returns. Markdown fences are tolerated,
                but alternate workflow formats are rejected.
              </div>
              <textarea
                value={aiImportText}
                onChange={(event) => {
                  setAiImportText(event.target.value);
                  setAiImportResult(null);
                  setAiIssues([]);
                }}
                placeholder='{"format":"brixta.pixel-logic","formatVersion":1,...}'
                className="mt-3 min-h-52 w-full rounded-md border bg-background p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <SecondaryButton type="button" onClick={validateAIImport}>
                  Validate AI JSON
                </SecondaryButton>
                <PrimaryButton
                  type="button"
                  onClick={applyAIImport}
                  disabled={
                    !aiImportResult ||
                    aiIssues.some((item) => item.severity === "error")
                  }
                >
                  Import into canvas
                </PrimaryButton>
              </div>
            </div>
          </div>

          {(aiImportResult || aiIssues.length > 0) && (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="text-sm font-semibold">Import validation</div>
                {aiIssues.length === 0 ? (
                  <div className="mt-2 text-sm text-muted-foreground">
                    No blocking issues detected.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {aiIssues.map((issue, index) => (
                      <div
                        key={`ai-issue:${index}`}
                        className="rounded-md border p-2 text-xs"
                      >
                        <div className="font-medium uppercase">{issue.severity}</div>
                        <div className="mt-1 text-muted-foreground">
                          {issue.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-4">
                <div className="text-sm font-semibold">AI result summary</div>
                {aiImportResult ? (
                  <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                    <div>{aiImportResult.program.nodes.length} nodes · {aiImportResult.program.edges.length} wires</div>
                    <div>Registry: {aiImportResult.registryFingerprint ?? "not supplied"}</div>
                    <div>
                      Unsupported capabilities: {aiImportResult.unsupportedCapabilities.length}
                    </div>
                    {aiImportResult.notes.length > 0 && (
                      <div>
                        Notes: {aiImportResult.notes.join(" · ")}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Validate a pasted result to inspect it.
                  </div>
                )}
              </div>
            </div>
          )}
        </Panel>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : responsibilities.length === 0 ? (
        <EmptyState
          title="No Responsibilities"
          description="Create a Responsibility first, then wire its behavior here."
        />
      ) : (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[290px_minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <Panel>
              <div className="text-sm font-semibold">This Responsibility</div>
              <div className="mt-1 text-xs text-muted-foreground">
                These ports come from the blocks already present in your
                Responsibility Builder.
              </div>

              <div className="mt-3 space-y-2">
                {actionPorts.map((action) => (
                  <button
                    type="button"
                    key={`action:${action.id}`}
                    onClick={() =>
                      addNode(
                        "event.responsibility.action",
                        { actionId: action.id },
                        `When ${action.label}`,
                      )
                    }
                    className="flex w-full items-center justify-between rounded-md border p-2 text-left text-sm hover:bg-muted/40"
                  >
                    <span className="truncate">When {action.label}</span>
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                  </button>
                ))}

                {capturePorts.map((capture) => (
                  <button
                    type="button"
                    key={`capture:${capture.id}`}
                    onClick={() =>
                      addNode(
                        "value.ref",
                        { scope: "capture", key: capture.id },
                        capture.label,
                      )
                    }
                    className="flex w-full items-center justify-between rounded-md border p-2 text-left text-sm hover:bg-muted/40"
                  >
                    <span className="truncate">{capture.label}</span>
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                  </button>
                ))}

                {(kernel?.runtimeWorld.contexts ?? []).map((context) => (
                  <button
                    type="button"
                    key={`context:${context.id}`}
                    onClick={() =>
                      addNode(
                        "value.ref",
                        { scope: "context", key: context.id },
                        context.label,
                      )
                    }
                    className="flex w-full items-center justify-between rounded-md border p-2 text-left text-sm hover:bg-muted/40"
                  >
                    <span className="truncate">{context.label}</span>
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                  </button>
                ))}

                {!kernel && (
                  <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    This Responsibility has no Kernel metadata yet. Core logic
                    blocks remain available below.
                  </div>
                )}
              </div>
            </Panel>

            {categories.map((category) => (
              <Panel key={category}>
                <div className="text-sm font-semibold">{category}</div>
                <div className="mt-2 space-y-2">
                  {nodeSpecs
                    .filter((spec) => spec.category === category)
                    .map((spec) => (
                      <button
                        type="button"
                        draggable
                        key={spec.type}
                        onDragStart={(event) =>
                          beginPaletteDrag(event, spec.type)
                        }
                        onClick={() => addNode(spec.type)}
                        className="w-full rounded-md border p-2 text-left hover:bg-muted/40"
                        title="Click or drag onto the canvas"
                      >
                        <div className="text-sm font-medium">{spec.label}</div>
                        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                          {spec.description}
                        </div>
                      </button>
                    ))}
                </div>
              </Panel>
            ))}
          </div>

          <div className="min-w-0 space-y-4">
            <Panel>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Logic canvas</div>
                  <div className="text-xs text-muted-foreground">
                    Drag blocks here. Data wires calculate values; Flow wires
                    decide what executes.
                  </div>
                </div>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </div>

              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={dropOnCanvas}
                className="mt-4 min-h-[430px] rounded-lg border border-dashed bg-muted/[0.12] p-3"
              >
                {program.nodes.length === 0 ? (
                  <div className="flex min-h-[390px] items-center justify-center text-center text-sm text-muted-foreground">
                    Drop an event, value, operation or effect here.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {program.nodes.map((node) => {
                      const spec = getPixelLogicNodeSpec(node.type);
                      const active = node.id === selectedNodeId;
                      return (
                        <button
                          type="button"
                          key={node.id}
                          onClick={() => setSelectedNodeId(node.id)}
                          className={[
                            "min-w-0 rounded-lg border bg-background p-3 text-left shadow-sm",
                            active
                              ? "border-primary ring-1 ring-primary/20"
                              : "hover:bg-muted/20",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">
                                {node.label ?? spec?.label ?? node.type}
                              </div>
                              <div className="truncate font-mono text-[10px] text-muted-foreground">
                                {node.type}
                              </div>
                            </div>
                            <Pill>{spec?.kind ?? "custom"}</Pill>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <div className="mb-1 font-medium">INPUTS</div>
                              {(spec?.inputs ?? []).map((port) => (
                                <div key={port.key} className="truncate text-muted-foreground">
                                  ◀ {port.label} · {port.kind}
                                </div>
                              ))}
                            </div>
                            <div className="text-right">
                              <div className="mb-1 font-medium">OUTPUTS</div>
                              {(spec?.outputs ?? []).map((port) => (
                                <div key={port.key} className="truncate text-muted-foreground">
                                  {port.label} · {port.kind} ▶
                                </div>
                              ))}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </Panel>

            <Panel>
              <div className="font-semibold">Wire blocks</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Choose an output and matching input. A Data port carries a value.
                A Flow port carries execution.
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="From node">
                  <select
                    className={inputClass}
                    value={fromNodeId}
                    onChange={(event) => {
                      setFromNodeId(event.target.value);
                      setFromPort("");
                    }}
                  >
                    <option value="">Choose…</option>
                    {program.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label ?? node.type}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Output">
                  <select
                    className={inputClass}
                    value={fromPort}
                    onChange={(event) => setFromPort(event.target.value)}
                  >
                    <option value="">Choose…</option>
                    {(fromSpec?.outputs ?? []).map((port) => (
                      <option key={port.key} value={port.key}>
                        {port.label} · {port.kind}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="To node">
                  <select
                    className={inputClass}
                    value={toNodeId}
                    onChange={(event) => {
                      setToNodeId(event.target.value);
                      setToPort("");
                    }}
                  >
                    <option value="">Choose…</option>
                    {program.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label ?? node.type}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Input">
                  <select
                    className={inputClass}
                    value={toPort}
                    onChange={(event) => setToPort(event.target.value)}
                  >
                    <option value="">Choose…</option>
                    {(toSpec?.inputs ?? []).map((port) => (
                      <option key={port.key} value={port.key}>
                        {port.label} · {port.kind}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-3">
                <SecondaryButton type="button" onClick={connectNodes}>
                  <GitBranch className="h-4 w-4" />
                  Connect
                </SecondaryButton>
              </div>

              {program.edges.length > 0 && (
                <div className="mt-4 space-y-2">
                  {program.edges.map((edge) => {
                    const from = program.nodes.find(
                      (node) => node.id === edge.fromNodeId,
                    );
                    const to = program.nodes.find(
                      (node) => node.id === edge.toNodeId,
                    );
                    return (
                      <div
                        key={edge.id}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 truncate">
                          <Pill>{edge.kind}</Pill>{" "}
                          {from?.label ?? from?.type}.{edge.fromPort} →{" "}
                          {to?.label ?? to?.type}.{edge.toPort}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setProgram((current) => ({
                              ...current,
                              edges: current.edges.filter(
                                (item) => item.id !== edge.id,
                              ),
                            }))
                          }
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          aria-label="Delete wire"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel>
              <div className="font-semibold">Inspector</div>
              {!selectedNode || !selectedSpec ? (
                <div className="mt-3 text-sm text-muted-foreground">
                  Select a node to configure it.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <Field label="Label">
                    <input
                      className={inputClass}
                      value={selectedNode.label ?? ""}
                      onChange={(event) =>
                        setProgram((current) => ({
                          ...current,
                          nodes: current.nodes.map((node) =>
                            node.id === selectedNode.id
                              ? { ...node, label: event.target.value }
                              : node,
                          ),
                        }))
                      }
                    />
                  </Field>

                  {(selectedSpec.configFields ?? []).map((field) => {
                    const raw = selectedNode.config[field.key];
                    if (field.kind === "boolean") {
                      return (
                        <label
                          key={field.key}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={raw === true}
                            onChange={(event) =>
                              updateSelectedNodeConfig(
                                field.key,
                                event.target.checked,
                              )
                            }
                          />
                          {field.label}
                        </label>
                      );
                    }

                    if (field.kind === "select") {
                      return (
                        <Field key={field.key} label={field.label}>
                          <select
                            className={inputClass}
                            value={typeof raw === "string" ? raw : ""}
                            onChange={(event) =>
                              updateSelectedNodeConfig(
                                field.key,
                                event.target.value,
                              )
                            }
                          >
                            <option value="">Choose…</option>
                            {(field.options ?? []).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      );
                    }

                    return (
                      <Field key={field.key} label={field.label}>
                        <input
                          className={inputClass}
                          type={field.kind === "number" ? "number" : "text"}
                          placeholder={field.placeholder}
                          value={
                            typeof raw === "string" || typeof raw === "number"
                              ? String(raw)
                              : ""
                          }
                          onChange={(event) =>
                            updateSelectedNodeConfig(
                              field.key,
                              field.kind === "number"
                                ? Number(event.target.value)
                                : event.target.value,
                            )
                          }
                        />
                      </Field>
                    );
                  })}

                  <SecondaryButton
                    type="button"
                    onClick={() => removeNode(selectedNode.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete node
                  </SecondaryButton>
                </div>
              )}
            </Panel>

            <Panel>
              <div className="font-semibold">Validation</div>
              {validation.length === 0 ? (
                <div className="mt-3 text-sm text-muted-foreground">
                  Graph is structurally valid.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {validation.map((issue, index) => (
                    <div
                      key={`${issue.nodeId ?? issue.edgeId ?? "program"}:${index}`}
                      className="rounded-md border p-2 text-xs"
                    >
                      <div className="font-medium uppercase">
                        {issue.severity}
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {issue.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel>
              <div className="text-sm font-semibold">Execution contract</div>
              <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Pixel Logic evaluates deterministic graph nodes and emits
                effects. The host runtime applies permitted effects. New packages
                can register new node types and executors without changing this
                graph format.
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
