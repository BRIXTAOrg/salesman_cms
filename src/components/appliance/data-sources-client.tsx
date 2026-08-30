"use client";

import {
  ArrowRight,
  Boxes,
  Check,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { Responsibility } from "@/lib/appliance-types";
import type {
  PlatformDataSource,
  PlatformEntityType,
  ResponsibilityExtensionConfig,
} from "@/lib/platform-vnext-types";
import type {
  KernelCapture,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";
import { RESPONSIBILITY_KERNEL_METADATA_KEY } from "@/lib/responsibility-kernel-types";
import { blankResponsibilityKernel } from "@/lib/responsibility-kernel-catalog";
import { hydrateKernelFromBaseDefinition } from "@/lib/responsibility-kernel-compiler";

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

// BRIXTA_SMART_CONNECTIONS_V1

const CONNECTIONS_METADATA_KEY = "responsibilityConnections";

type ExtensionResponse = {
  responsibility: {
    id: number;
    key: string;
    title: string;
    config: Record<string, unknown>;
  };
  extension: {
    responsibilityId: number;
    draftConfig: ResponsibilityExtensionConfig;
    publishedConfig: ResponsibilityExtensionConfig;
    publishedVersion: number;
  };
};

type SavedConnection = {
  id: string;
  sourceKey: string;
  sourceTitle: string;
  captureId: string;
  captureLabel: string;
  mode: "single_select";
  previousCapture: {
    kind: KernelCapture["kind"];
    config: Record<string, unknown>;
  };
};

type CaptureCandidate = {
  captureId: string;
  label: string;
  kind: KernelCapture["kind"];
  score: number;
  reason: string;
};

const COMPATIBLE_CAPTURE_KINDS = new Set<KernelCapture["kind"]>([
  "short_text",
  "long_text",
  "choice",
  "entity_reference",
]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function singular(value: string) {
  if (value.endsWith("ies") && value.length > 4) {
    return `${value.slice(0, -3)}y`;
  }
  if (value.endsWith("s") && value.length > 3) {
    return value.slice(0, -1);
  }
  return value;
}

function tokens(value: unknown) {
  const ignored = new Set([
    "name",
    "code",
    "id",
    "field",
    "record",
    "records",
    "select",
    "choose",
    "current",
  ]);

  return new Set(
    normalize(value)
      .split(" ")
      .map(singular)
      .filter((token) => token && !ignored.has(token)),
  );
}

function asKernel(
  config: ResponsibilityExtensionConfig,
  responsibility?: Responsibility | null,
): ResponsibilityKernel {
  const metadata =
    config.metadata && typeof config.metadata === "object"
      ? config.metadata
      : {};

  const candidate = metadata[RESPONSIBILITY_KERNEL_METADATA_KEY];

  if (
    candidate
    && typeof candidate === "object"
    && !Array.isArray(candidate)
    && (candidate as { kernelVersion?: unknown }).kernelVersion === 3
  ) {
    return candidate as ResponsibilityKernel;
  }

  if (responsibility?.definition) {
    return hydrateKernelFromBaseDefinition(
      responsibility.definition,
      responsibility.title,
    );
  }

  return blankResponsibilityKernel();
}

function readConnections(
  config: ResponsibilityExtensionConfig,
): SavedConnection[] {
  const raw = config.metadata?.[CONNECTIONS_METADATA_KEY];
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (item) =>
        item
        && typeof item === "object"
        && !Array.isArray(item),
    )
    .map((item) => item as SavedConnection);
}

function entityIdFor(
  source: PlatformDataSource,
  entities: PlatformEntityType[],
) {
  const configured = Number(source.config?.["entityTypeId"]);

  if (Number.isInteger(configured) && configured > 0) {
    return configured;
  }

  return (
    entities.find(
      (entity) =>
        entity.key === source.sourceRef
        || entity.key === source.key,
    )?.id
    ?? null
  );
}

function scoreCapture(
  source: PlatformDataSource,
  entity: PlatformEntityType | null,
  capture: KernelCapture,
) {
  const sourceWords = new Set<string>();

  for (const word of tokens(source.title)) sourceWords.add(word);
  for (const word of tokens(source.key)) sourceWords.add(word);
  for (const word of tokens(entity?.title ?? "")) sourceWords.add(word);

  const displayField =
    entity?.fieldDefinitions.find(
      (field) => field.key === source.displayField,
    );

  for (const word of tokens(displayField?.label ?? "")) {
    sourceWords.add(word);
  }

  const captureWords = new Set<string>();
  for (const word of tokens(capture.label)) captureWords.add(word);
  for (const word of tokens(capture.id)) captureWords.add(word);
  for (const word of tokens(capture.storeAs ?? "")) captureWords.add(word);

  let overlap = 0;
  for (const word of sourceWords) {
    if (captureWords.has(word)) overlap += 1;
  }

  let score = overlap * 45;
  const normalizedCapture =
    normalize(`${capture.label} ${capture.id} ${capture.storeAs ?? ""}`);

  for (const word of sourceWords) {
    if (word.length >= 3 && normalizedCapture.includes(word)) {
      score += 20;
    }
  }

  if (capture.kind === "entity_reference") score += 20;
  if (capture.kind === "choice") score += 8;
  if (capture.kind === "short_text") score += 6;

  if (!COMPATIBLE_CAPTURE_KINDS.has(capture.kind)) {
    score -= 500;
  }

  const reason =
    overlap > 0
      ? `Matched ${overlap} business term${overlap === 1 ? "" : "s"}`
      : capture.kind === "entity_reference"
        ? "Existing business-record field"
        : "Compatible app field";

  return { score, reason };
}

export default function DataSourcesClient() {
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [responsibilityId, setResponsibilityId] = useState<number | null>(null);
  const [sources, setSources] = useState<PlatformDataSource[]>([]);
  const [entities, setEntities] = useState<PlatformEntityType[]>([]);

  const [extension, setExtension] =
    useState<ResponsibilityExtensionConfig | null>(null);
  const [kernel, setKernel] =
    useState<ResponsibilityKernel>(blankResponsibilityKernel());
  const [connections, setConnections] = useState<SavedConnection[]>([]);

  const [selectedSourceKey, setSelectedSourceKey] = useState("");
  const [targetCaptureId, setTargetCaptureId] = useState("");
  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedResponsibility = useMemo(
    () =>
      responsibilities.find((item) => item.id === responsibilityId) ?? null,
    [responsibilities, responsibilityId],
  );

  const entitySources = useMemo(
    () =>
      sources.filter(
        (source) =>
          source.isActive !== false
          && source.sourceType === "entity_store",
      ),
    [sources],
  );

  const selectedSource = useMemo(
    () =>
      entitySources.find((source) => source.key === selectedSourceKey) ?? null,
    [entitySources, selectedSourceKey],
  );

  const selectedEntity = useMemo(() => {
    if (!selectedSource) return null;

    const id = entityIdFor(selectedSource, entities);

    return (
      entities.find((entity) => entity.id === id)
      ?? entities.find(
        (entity) =>
          entity.key === selectedSource.sourceRef
          || entity.key === selectedSource.key,
      )
      ?? null
    );
  }, [selectedSource, entities]);

  const loadBase = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [responsibilityBody, sourceBody, entityBody] = await Promise.all([
        apiJson<{ responsibilities: Responsibility[] }>(
          "/api/appliance/responsibilities",
        ),
        apiJson<{ dataSources: PlatformDataSource[] }>(
          "/api/platform/data-sources",
        ),
        apiJson<{ entityTypes: PlatformEntityType[] }>(
          "/api/platform/entities",
        ),
      ]);

      const active =
        (responsibilityBody.responsibilities ?? [])
          .filter((item) => item.isActive !== false);

      setResponsibilities(active);
      setSources(sourceBody.dataSources ?? []);
      setEntities(entityBody.entityTypes ?? []);

      setResponsibilityId((current) =>
        current && active.some((item) => item.id === current)
          ? current
          : active[0]?.id ?? null,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load Connections.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(
    async (id: number) => {
      setDetailLoading(true);
      setMessage(null);

      try {
        const body = await apiJson<ExtensionResponse>(
          `/api/platform/responsibility-extensions/${id}`,
        );

        const responsibility =
          responsibilities.find((item) => item.id === id) ?? null;

        setExtension(body.extension.draftConfig);
        setKernel(asKernel(body.extension.draftConfig, responsibility));
        setConnections(readConnections(body.extension.draftConfig));
        setSelectedSourceKey("");
        setTargetCaptureId("");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load Responsibility wiring.",
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [responsibilities],
  );

  useEffect(() => { void loadBase(); }, [loadBase]);

  useEffect(() => {
    if (responsibilityId) void loadDetail(responsibilityId);
  }, [responsibilityId, loadDetail]);

  const candidateCaptures = useMemo<CaptureCandidate[]>(() => {
    if (!selectedSource) return [];

    return kernel.possibilities
      .filter(
        (
          possibility,
        ): possibility is Extract<
          ResponsibilityKernel["possibilities"][number],
          { type: "capture" }
        > => possibility.type === "capture",
      )
      .map((possibility) => {
        const scoring = scoreCapture(
          selectedSource,
          selectedEntity,
          possibility.capture,
        );

        return {
          captureId: possibility.capture.id,
          label: possibility.capture.label,
          kind: possibility.capture.kind,
          score: scoring.score,
          reason: scoring.reason,
        };
      })
      .filter((candidate) => COMPATIBLE_CAPTURE_KINDS.has(candidate.kind))
      .sort((a, b) => b.score - a.score);
  }, [kernel, selectedSource, selectedEntity]);

  useEffect(() => {
    if (!selectedSource) {
      setTargetCaptureId("");
      return;
    }

    setTargetCaptureId((current) =>
      current
      && candidateCaptures.some(
        (candidate) => candidate.captureId === current,
      )
        ? current
        : candidateCaptures[0]?.captureId ?? "",
    );
  }, [selectedSource, candidateCaptures]);

  const filteredSources = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entitySources;

    return entitySources.filter((source) => {
      const entity =
        entities.find(
          (item) =>
            item.id === entityIdFor(source, entities),
        );

      const haystack = [
        source.title,
        source.key,
        entity?.title,
        ...(entity?.fieldDefinitions.map((field) => field.label) ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [query, entitySources, entities]);

  async function saveWiring(
    nextKernel: ResponsibilityKernel,
    nextConnections: SavedConnection[],
    nextMessage: string,
  ) {
    if (!responsibilityId || !extension) {
      throw new Error("Choose a Responsibility first.");
    }

    const nextExtension: ResponsibilityExtensionConfig = {
      ...extension,
      metadata: {
        ...(extension.metadata ?? {}),
        [RESPONSIBILITY_KERNEL_METADATA_KEY]: nextKernel,
        [CONNECTIONS_METADATA_KEY]: nextConnections,
      },
    };

    await apiJson(
      `/api/platform/responsibility-extensions/${responsibilityId}`,
      {
        method: "PUT",
        body: JSON.stringify({ config: nextExtension }),
      },
    );

    setExtension(nextExtension);
    setKernel(nextKernel);
    setConnections(nextConnections);
    setMessage(nextMessage);
  }

  async function connect() {
    if (
      !selectedSource
      || !targetCaptureId
      || !responsibilityId
      || !extension
    ) {
      return;
    }

    const currentConnection =
      connections.find(
        (connection) => connection.captureId === targetCaptureId,
      );

    if (currentConnection) {
      setMessage(
        `"${currentConnection.captureLabel}" is already connected to `
          + `"${currentConnection.sourceTitle}". Disconnect it first.`,
      );
      return;
    }

    const nextKernel = clone(kernel);

    const possibility =
      nextKernel.possibilities.find(
        (item) =>
          item.type === "capture"
          && item.capture.id === targetCaptureId,
      );

    if (!possibility || possibility.type !== "capture") {
      setMessage("The selected App Builder field no longer exists. Reload Connections.");
      return;
    }

    if (!COMPATIBLE_CAPTURE_KINDS.has(possibility.capture.kind)) {
      setMessage("That field type is not safe to convert into a business-record selector.");
      return;
    }

    const previousCapture = {
      kind: possibility.capture.kind,
      config: clone(possibility.capture.config ?? {}),
    };

    possibility.capture = {
      ...possibility.capture,
      kind: "entity_reference",
      config: {
        ...(possibility.capture.config ?? {}),
        source: selectedSource.key,
        searchable: true,
        connectionMode: "single_select",
        displayField: selectedSource.displayField ?? undefined,
        valueField: selectedSource.valueField ?? "id",
      },
    };

    const nextConnection: SavedConnection = {
      id: `${selectedSource.key}:${targetCaptureId}`,
      sourceKey: selectedSource.key,
      sourceTitle: selectedSource.title,
      captureId: targetCaptureId,
      captureLabel: possibility.capture.label,
      mode: "single_select",
      previousCapture,
    };

    setSaving(true);

    try {
      await saveWiring(
        nextKernel,
        [...connections, nextConnection],
        `Connected "${selectedSource.title}" to "${possibility.capture.label}". `
          + "The same capture ID and visual placement were preserved. "
          + "This is saved in the Responsibility draft; Publish from Studio when ready.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save connection.");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect(connection: SavedConnection) {
    if (!responsibilityId || !extension) return;

    const nextKernel = clone(kernel);

    const possibility =
      nextKernel.possibilities.find(
        (item) =>
          item.type === "capture"
          && item.capture.id === connection.captureId,
      );

    if (!possibility || possibility.type !== "capture") {
      setMessage("The connected App Builder field no longer exists. Nothing was changed.");
      return;
    }

    possibility.capture = {
      ...possibility.capture,
      kind: connection.previousCapture.kind,
      config: clone(connection.previousCapture.config),
    };

    const nextConnections =
      connections.filter((item) => item.id !== connection.id);

    setSaving(true);

    try {
      await saveWiring(
        nextKernel,
        nextConnections,
        `Disconnected "${connection.sourceTitle}" and restored `
          + `"${connection.captureLabel}" to its previous field configuration.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to disconnect.");
    } finally {
      setSaving(false);
    }
  }

  const bestCandidate = candidateCaptures[0] ?? null;
  const selectedCandidate =
    candidateCaptures.find(
      (candidate) => candidate.captureId === targetCaptureId,
    ) ?? null;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Link2 className="h-5 w-5" />
              Connections
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Choose a Responsibility, choose an Entity, and BRIXTA inspects
              the actual App Builder fields to recommend where the records
              belong. A connection changes the existing capture instead of
              creating a second field, so its ID, visual position and action
              wiring survive.
            </p>
          </div>

          <div className="flex min-w-[280px] items-end gap-2">
            <Field label="Responsibility">
              <select
                className={inputClass}
                value={responsibilityId ?? ""}
                onChange={(event) =>
                  setResponsibilityId(Number(event.target.value) || null)
                }
              >
                {responsibilities.map((responsibility) => (
                  <option key={responsibility.id} value={responsibility.id}>
                    {responsibility.title}
                  </option>
                ))}
              </select>
            </Field>

            <SecondaryButton type="button" onClick={() => void loadBase()}>
              <RefreshCw className="h-4 w-4" />
              Reload
            </SecondaryButton>
          </div>
        </div>
      </Panel>

      {message && <Panel className="py-3"><div className="text-sm">{message}</div></Panel>}

      {detailLoading ? (
        <div className="flex h-48 items-center justify-center rounded-lg border">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(300px,.8fr)_minmax(0,1.2fr)]">
            <Panel>
              <div className="flex items-center gap-2 text-base font-semibold">
                <Boxes className="h-4 w-4" />
                Available Entities
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Only reusable Entity data is shown. Internal platform tables are hidden.
              </div>

              <div className="relative mt-4">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  className={`${inputClass} pl-9`}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search Dealers, Products, Sites..."
                />
              </div>

              {filteredSources.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    title="No Entities available"
                    description="Create or import an Entity in the Entities tab first."
                  />
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {filteredSources.map((source) => {
                    const entity =
                      entities.find(
                        (item) =>
                          item.id === entityIdFor(source, entities),
                      );
                    const active = selectedSourceKey === source.key;

                    return (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => setSelectedSourceKey(source.key)}
                        className={[
                          "w-full rounded-lg border p-3 text-left transition",
                          active
                            ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20"
                            : "hover:bg-muted/30",
                        ].join(" ")}
                      >
                        <div className="font-medium">{source.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {entity?.fieldDefinitions.length
                            ?? source.allowedFields.length} fields
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(entity?.fieldDefinitions ?? [])
                            .slice(0, 5)
                            .map((field) => (
                              <Pill key={field.key}>{field.label}</Pill>
                            ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel>
              {!selectedSource ? (
                <EmptyState
                  title="Choose an Entity"
                  description="BRIXTA will inspect this Responsibility's App Builder and rank compatible fields."
                />
              ) : (
                <div className="space-y-5">
                  <div>
                    <div className="text-base font-semibold">
                      Connect {selectedSource.title}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Responsibility: {selectedResponsibility?.title ?? "Unknown"}
                    </div>
                  </div>

                  {candidateCaptures.length === 0 ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                      No safe App Builder field exists yet. Add a Text, Choice
                      or Business Record field in Studio first, then return
                      here. BRIXTA will not invent a visual field in an unknown position.
                    </div>
                  ) : (
                    <>
                      {bestCandidate && (
                        <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-primary">
                            Recommended
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="font-medium">{selectedSource.title}</span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{bestCandidate.label}</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {bestCandidate.reason}. Existing field type: {bestCandidate.kind}.
                          </div>
                        </div>
                      )}

                      <Field label="Where should this Entity be used?">
                        <select
                          className={inputClass}
                          value={targetCaptureId}
                          onChange={(event) => setTargetCaptureId(event.target.value)}
                        >
                          {candidateCaptures.map((candidate, index) => (
                            <option key={candidate.captureId} value={candidate.captureId}>
                              {index === 0 ? "Recommended — " : ""}
                              {candidate.label} ({candidate.kind})
                            </option>
                          ))}
                        </select>
                      </Field>

                      <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium">Connection type</div>
                        <div className="mt-3 flex items-start gap-3">
                          <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-primary">
                            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">
                              Searchable business-record selector
                            </div>
                            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              Correct for dynamic Entity data. The employee
                              selects one real record and BRIXTA stores the
                              record identity instead of copying a static choice list.
                            </div>
                          </div>
                        </div>

                        {selectedCandidate && (
                          <div className="mt-4 rounded-md bg-muted/20 p-3 text-xs">
                            <b>{selectedCandidate.label}</b> keeps capture ID{" "}
                            <code>{selectedCandidate.captureId}</code>. Only its
                            data semantics become an Entity reference.
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border p-4 text-xs leading-relaxed text-muted-foreground">
                        Display field: <b>{selectedSource.displayField ?? "automatic"}</b>
                        <br />
                        Search fields:{" "}
                        <b>
                          {selectedSource.searchableFields.length
                            ? selectedSource.searchableFields.join(", ")
                            : "automatic"}
                        </b>
                      </div>

                      <div className="flex justify-end">
                        <PrimaryButton
                          type="button"
                          disabled={
                            saving
                            || !targetCaptureId
                            || Boolean(
                              connections.find(
                                (connection) =>
                                  connection.captureId === targetCaptureId,
                              ),
                            )
                          }
                          onClick={() => void connect()}
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Link2 className="h-4 w-4" />
                          )}
                          Connect to field
                        </PrimaryButton>
                      </div>
                    </>
                  )}
                </div>
              )}
            </Panel>
          </div>

          <Panel>
            <div className="text-base font-semibold">
              Connected to {selectedResponsibility?.title ?? "Responsibility"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              These are draft App Builder bindings. Publish from Studio when
              you want employee devices to receive the change.
            </div>

            {connections.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="Nothing connected yet"
                  description="Choose an Entity above and let BRIXTA map it to an existing App Builder field."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {connections.map((connection) => (
                  <div
                    key={connection.id}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-500" />
                        <span className="font-medium">{connection.sourceTitle}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{connection.captureLabel}</span>
                        <Pill>searchable selector</Pill>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Capture ID: {connection.captureId}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void disconnect(connection)}
                      className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      aria-label={`Disconnect ${connection.sourceTitle}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
