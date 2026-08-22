"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BrainCircuit,
  Camera,
  Clock3,
  Database,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";

import type {
  Responsibility,
  Role,
} from "@/lib/appliance-types";
import type {
  EvidenceBundle,
  FieldMemoryPolicy,
  PlatformDataSource,
  QueryBinding,
  ReferenceBinding,
  ResponsibilityExtensionConfig,
} from "@/lib/platform-vnext-types";
import {
  apiJson,
} from "./client";
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
    compiledHash?: string | null;
    publishedAt?: string | null;
  };
};

function emptyConfig(): ResponsibilityExtensionConfig {
  return {
    schemaVersion: 1,
    references: [],
    queries: [],
    memoryPolicies: [],
    evidenceBundles: [],
    conditions: [],
    computedFields: [],
    repeatableSections: [],
    schedule: { enabled: false },
    geofence: {
      enabled: false,
      radiusMeters: 200,
      behavior: "warn",
    },
    access: {
      useRoleIds: [],
      readRoleIds: [],
      createRoleIds: [],
      updateRoleIds: [],
      deleteRoleIds: [],
      reviewRoleIds: [],
      recordVisibility: "creator_and_manager",
    },
    offline: {
      enabled: true,
      prefetchReferences: true,
      maxReferenceRows: 500,
      optimisticMutations: true,
    },
  };
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function randomKey(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function roleChecked(
  ids: number[],
  roleId: number,
) {
  return ids.includes(roleId);
}

export default function ResponsibilityVNextClient() {
  const [responsibilities, setResponsibilities] =
    useState<Responsibility[]>([]);
  const [roles, setRoles] =
    useState<Role[]>([]);
  const [sources, setSources] =
    useState<PlatformDataSource[]>([]);

  const [responsibilityId, setResponsibilityId] =
    useState<number | null>(null);
  const [config, setConfig] =
    useState<ResponsibilityExtensionConfig>(emptyConfig());
  const [publishedVersion, setPublishedVersion] =
    useState(0);
  const [compiledHash, setCompiledHash] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  const selectedResponsibility = useMemo(
    () =>
      responsibilities.find(
        (item) => item.id === responsibilityId,
      ) ?? null,
    [responsibilities, responsibilityId],
  );

  const loadBase = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [responsibilityBody, roleBody, sourceBody] =
        await Promise.all([
          apiJson<{ responsibilities: Responsibility[] }>(
            "/api/appliance/responsibilities",
          ),
          apiJson<{ roles: Role[] }>(
            "/api/appliance/roles",
          ),
          apiJson<{ dataSources: PlatformDataSource[] }>(
            "/api/platform/data-sources",
          ),
        ]);

      const active = (
        responsibilityBody.responsibilities ?? []
      ).filter((item) => item.isActive !== false);

      setResponsibilities(active);
      setRoles(roleBody.roles ?? []);
      setSources(
        (sourceBody.dataSources ?? []).filter(
          (item) => item.isActive !== false,
        ),
      );

      setResponsibilityId((current) => {
        if (
          current &&
          active.some((item) => item.id === current)
        ) {
          return current;
        }
        return active[0]?.id ?? null;
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Responsibility Studio.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (!responsibilityId) {
      setConfig(emptyConfig());
      setPublishedVersion(0);
      setCompiledHash(null);
      return;
    }

    let cancelled = false;

    async function loadExtension() {
      setLoading(true);
      try {
        const body =
          await apiJson<ExtensionResponse>(
            `/api/platform/responsibility-extensions/${responsibilityId}`,
          );

        if (!cancelled) {
          setConfig(
            body.extension?.draftConfig ??
              emptyConfig(),
          );
          setPublishedVersion(
            body.extension?.publishedVersion ?? 0,
          );
          setCompiledHash(
            body.extension?.compiledHash ?? null,
          );
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load platform definition.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadExtension();

    return () => {
      cancelled = true;
    };
  }, [responsibilityId]);

  async function saveDraft() {
    if (!responsibilityId) return;

    setSaving(true);
    setMessage(null);

    try {
      await apiJson(
        `/api/platform/responsibility-extensions/${responsibilityId}`,
        {
          method: "PUT",
          body: JSON.stringify({ config }),
        },
      );

      setMessage("Platform draft saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save draft.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!responsibilityId) return;

    await saveDraft();
    setSaving(true);

    try {
      const body = await apiJson<{
        version: number;
        manifestHash: string;
      }>(
        `/api/platform/responsibility-extensions/${responsibilityId}/publish`,
        {
          method: "POST",
        },
      );

      setPublishedVersion(body.version);
      setCompiledHash(body.manifestHash);
      setMessage(
        `Published v${body.version}. Compiled runtime manifest is ready for backend/mobile consumption.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to publish.",
      );
    } finally {
      setSaving(false);
    }
  }

  function toggleRole(
    field:
      | "useRoleIds"
      | "readRoleIds"
      | "createRoleIds"
      | "updateRoleIds"
      | "deleteRoleIds"
      | "reviewRoleIds",
    roleId: number,
  ) {
    const current = config.access[field];
    setConfig({
      ...config,
      access: {
        ...config.access,
        [field]: current.includes(roleId)
          ? current.filter((id) => id !== roleId)
          : [...current, roleId],
      },
    });
  }

  function addReference() {
    const source = sources[0];

    const reference: ReferenceBinding = {
      key: randomKey("reference"),
      label: "Select existing record",
      sourceKey: source?.key ?? "",
      mode: "one",
      searchable: true,
      required: false,
      filter: [],
      offline: {
        enabled: false,
        maxRows: 500,
      },
    };

    setConfig({
      ...config,
      references: [...config.references, reference],
    });
  }

  function updateReference(
    index: number,
    patch: Partial<ReferenceBinding>,
  ) {
    setConfig({
      ...config,
      references: config.references.map(
        (item, itemIndex) =>
          itemIndex === index
            ? { ...item, ...patch }
            : item,
      ),
    });
  }

  function addQuery() {
    const source = sources[0];

    const query: QueryBinding = {
      key: randomKey("query"),
      label: "Previous record",
      sourceKey: source?.key ?? "",
      mode: "latest",
      limit: 1,
      filter: [],
      selectFields: [],
    };

    setConfig({
      ...config,
      queries: [...config.queries, query],
    });
  }

  function updateQuery(
    index: number,
    patch: Partial<QueryBinding>,
  ) {
    setConfig({
      ...config,
      queries: config.queries.map(
        (item, itemIndex) =>
          itemIndex === index
            ? { ...item, ...patch }
            : item,
      ),
    });
  }

  function addMemoryPolicy() {
    const firstField =
      selectedResponsibility?.definition.input.fields[0];

    const policy: FieldMemoryPolicy = {
      fieldKey: firstField?.key ?? "",
      mode: "ttl",
      ttlSeconds: 30 * 24 * 60 * 60,
      confirmationMode: "confirm_or_change",
    };

    setConfig({
      ...config,
      memoryPolicies: [
        ...config.memoryPolicies,
        policy,
      ],
    });
  }

  function updateMemoryPolicy(
    index: number,
    patch: Partial<FieldMemoryPolicy>,
  ) {
    setConfig({
      ...config,
      memoryPolicies:
        config.memoryPolicies.map(
          (item, itemIndex) =>
            itemIndex === index
              ? { ...item, ...patch }
              : item,
        ),
    });
  }

  function addEvidence() {
    const bundle: EvidenceBundle = {
      key: randomKey("evidence"),
      label: "Evidence",
      capture: {
        photo: true,
        location: true,
        timestamp: true,
      },
      required: [
        "photo",
        "location",
        "timestamp",
      ],
    };

    setConfig({
      ...config,
      evidenceBundles: [
        ...config.evidenceBundles,
        bundle,
      ],
    });
  }

  function updateEvidence(
    index: number,
    patch: Partial<EvidenceBundle>,
  ) {
    setConfig({
      ...config,
      evidenceBundles:
        config.evidenceBundles.map(
          (item, itemIndex) =>
            itemIndex === index
              ? { ...item, ...patch }
              : item,
        ),
    });
  }

  if (loading && responsibilities.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (responsibilities.length === 0) {
    return (
      <EmptyState
        title="Create a Responsibility first"
        description="Advanced Data, Memory, Access and Runtime settings attach to an existing Responsibility."
      />
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <Panel className="py-3">
          <div className="text-sm">
            {message}
          </div>
        </Panel>
      )}

      <Panel>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <Field label="Responsibility">
            <select
              value={responsibilityId ?? ""}
              onChange={(event) =>
                setResponsibilityId(
                  Number(event.target.value),
                )
              }
              className={inputClass}
            >
              {responsibilities.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.title}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="info">
              Published v{publishedVersion}
            </Pill>
            {compiledHash && (
              <Pill tone="good">
                Compiled {compiledHash.slice(0, 8)}
              </Pill>
            )}
            <SecondaryButton
              type="button"
              onClick={() => void saveDraft()}
              disabled={saving}
            >
              <Save className="h-4 w-4" />
              Save draft
            </SecondaryButton>
            <PrimaryButton
              type="button"
              onClick={() => void publish()}
              disabled={saving}
            >
              <UploadCloud className="h-4 w-4" />
              Publish
            </PrimaryButton>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <Database className="h-4 w-4" />
                References
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Search/select existing tenant data instead of asking the employee to retype it.
              </div>
            </div>
            <SecondaryButton
              type="button"
              className="h-8"
              onClick={addReference}
              disabled={sources.length === 0}
            >
              <Plus className="h-4 w-4" />
              Reference
            </SecondaryButton>
          </div>

          <div className="mt-4 space-y-3">
            {config.references.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Register a Data Source, then add a Reference such as customer, asset, project or previous record.
              </div>
            ) : (
              config.references.map((reference, index) => (
                <div key={reference.key} className="rounded-lg border p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Label">
                      <input
                        value={reference.label}
                        onChange={(event) =>
                          updateReference(index, {
                            label: event.target.value,
                            key:
                              normalizeKey(
                                event.target.value,
                              ) || reference.key,
                          })
                        }
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Source">
                      <select
                        value={reference.sourceKey}
                        onChange={(event) =>
                          updateReference(index, {
                            sourceKey: event.target.value,
                          })
                        }
                        className={inputClass}
                      >
                        <option value="">
                          Choose source
                        </option>
                        {sources.map((source) => (
                          <option
                            key={source.id}
                            value={source.key}
                          >
                            {source.title}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Selection">
                      <select
                        value={reference.mode}
                        onChange={(event) =>
                          updateReference(index, {
                            mode: event.target.value as
                              | "one"
                              | "many",
                          })
                        }
                        className={inputClass}
                      >
                        <option value="one">
                          One record
                        </option>
                        <option value="many">
                          Multiple records
                        </option>
                      </select>
                    </Field>

                    <div className="flex items-end">
                      <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                        <input
                          type="checkbox"
                          checked={reference.searchable}
                          onChange={(event) =>
                            updateReference(index, {
                              searchable:
                                event.target.checked,
                            })
                          }
                        />
                        Searchable
                      </label>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        references:
                          config.references.filter(
                            (_, itemIndex) =>
                              itemIndex !== index,
                          ),
                      })
                    }
                    className="mt-3 inline-flex items-center gap-1 text-xs text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <BrainCircuit className="h-4 w-4" />
                Queries
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Fetch previous/current data from any Data Source or other Responsibility.
              </div>
            </div>
            <SecondaryButton
              type="button"
              className="h-8"
              onClick={addQuery}
              disabled={sources.length === 0}
            >
              <Plus className="h-4 w-4" />
              Query
            </SecondaryButton>
          </div>

          <div className="mt-4 space-y-3">
            {config.queries.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Example: fetch the latest previous survey for the selected entity.
              </div>
            ) : (
              config.queries.map((query, index) => (
                <div key={query.key} className="rounded-lg border p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Label">
                      <input
                        value={query.label}
                        onChange={(event) =>
                          updateQuery(index, {
                            label: event.target.value,
                            key:
                              normalizeKey(
                                event.target.value,
                              ) || query.key,
                          })
                        }
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Source">
                      <select
                        value={query.sourceKey}
                        onChange={(event) =>
                          updateQuery(index, {
                            sourceKey: event.target.value,
                          })
                        }
                        className={inputClass}
                      >
                        <option value="">
                          Choose source
                        </option>
                        {sources.map((source) => (
                          <option
                            key={source.id}
                            value={source.key}
                          >
                            {source.title}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Return">
                      <select
                        value={query.mode}
                        onChange={(event) =>
                          updateQuery(index, {
                            mode: event.target.value as QueryBinding["mode"],
                          })
                        }
                        className={inputClass}
                      >
                        <option value="latest">
                          Latest record
                        </option>
                        <option value="first">
                          First record
                        </option>
                        <option value="many">
                          Multiple records
                        </option>
                        <option value="count">
                          Count
                        </option>
                        <option value="sum">
                          Sum
                        </option>
                        <option value="average">
                          Average
                        </option>
                      </select>
                    </Field>

                    <Field label="Limit">
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={query.limit ?? 1}
                        onChange={(event) =>
                          updateQuery(index, {
                            limit: Number(
                              event.target.value,
                            ),
                          })
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        queries:
                          config.queries.filter(
                            (_, itemIndex) =>
                              itemIndex !== index,
                          ),
                      })
                    }
                    className="mt-3 inline-flex items-center gap-1 text-xs text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <Clock3 className="h-4 w-4" />
                Remember values
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Avoid repeatedly asking for values that change slowly.
              </div>
            </div>
            <SecondaryButton
              type="button"
              className="h-8"
              onClick={addMemoryPolicy}
            >
              <Plus className="h-4 w-4" />
              Memory
            </SecondaryButton>
          </div>

          <div className="mt-4 space-y-3">
            {config.memoryPolicies.map(
              (policy, index) => (
                <div
                  key={`${policy.fieldKey}:${index}`}
                  className="rounded-lg border p-3"
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Field">
                      <select
                        value={policy.fieldKey}
                        onChange={(event) =>
                          updateMemoryPolicy(index, {
                            fieldKey:
                              event.target.value,
                          })
                        }
                        className={inputClass}
                      >
                        <option value="">
                          Choose field
                        </option>
                        {selectedResponsibility?.definition.input.fields.map(
                          (field) => (
                            <option
                              key={field.key}
                              value={field.key}
                            >
                              {field.label}
                            </option>
                          ),
                        )}
                      </select>
                    </Field>

                    <Field label="Ask policy">
                      <select
                        value={policy.mode}
                        onChange={(event) =>
                          updateMemoryPolicy(index, {
                            mode:
                              event.target.value as FieldMemoryPolicy["mode"],
                          })
                        }
                        className={inputClass}
                      >
                        <option value="every_time">
                          Ask every time
                        </option>
                        <option value="ttl">
                          Remember for a period
                        </option>
                        <option value="remember_forever">
                          Remember indefinitely
                        </option>
                        <option value="until_changed">
                          Until changed
                        </option>
                        <option value="every_n_uses">
                          Ask every N uses
                        </option>
                      </select>
                    </Field>

                    {policy.mode === "ttl" && (
                      <Field label="Valid for days">
                        <input
                          type="number"
                          min={1}
                          value={Math.round(
                            (policy.ttlSeconds ??
                              30 * 86400) / 86400,
                          )}
                          onChange={(event) =>
                            updateMemoryPolicy(index, {
                              ttlSeconds:
                                Number(
                                  event.target.value,
                                ) * 86400,
                            })
                          }
                          className={inputClass}
                        />
                      </Field>
                    )}

                    <Field label="Employee experience">
                      <select
                        value={
                          policy.confirmationMode ??
                          "confirm_or_change"
                        }
                        onChange={(event) =>
                          updateMemoryPolicy(index, {
                            confirmationMode:
                              event.target.value as
                                | "silent_prefill"
                                | "confirm_or_change",
                          })
                        }
                        className={inputClass}
                      >
                        <option value="confirm_or_change">
                          Show previous value → Still correct / Change
                        </option>
                        <option value="silent_prefill">
                          Prefill silently
                        </option>
                      </select>
                    </Field>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        memoryPolicies:
                          config.memoryPolicies.filter(
                            (_, itemIndex) =>
                              itemIndex !== index,
                          ),
                      })
                    }
                    className="mt-3 inline-flex items-center gap-1 text-xs text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              ),
            )}

            {config.memoryPolicies.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Example: remember a slowly-changing value for 30 days, then ask for confirmation again.
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <Camera className="h-4 w-4" />
                Evidence bundles
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Capture multiple pieces of proof as one employee action.
              </div>
            </div>
            <SecondaryButton
              type="button"
              className="h-8"
              onClick={addEvidence}
            >
              <Plus className="h-4 w-4" />
              Evidence
            </SecondaryButton>
          </div>

          <div className="mt-4 space-y-3">
            {config.evidenceBundles.map(
              (bundle, index) => (
                <div
                  key={bundle.key}
                  className="rounded-lg border p-3"
                >
                  <Field label="Label">
                    <input
                      value={bundle.label}
                      onChange={(event) =>
                        updateEvidence(index, {
                          label: event.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </Field>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        "photo",
                        "location",
                        "timestamp",
                        "signature",
                        "audio",
                        "barcode",
                        "qr",
                      ] as const
                    ).map((captureKey) => (
                      <label
                        key={captureKey}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={
                            bundle.capture[
                              captureKey
                            ] === true
                          }
                          onChange={(event) =>
                            updateEvidence(index, {
                              capture: {
                                ...bundle.capture,
                                [captureKey]:
                                  event.target.checked,
                              },
                            })
                          }
                        />
                        {captureKey}
                      </label>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        evidenceBundles:
                          config.evidenceBundles.filter(
                            (_, itemIndex) =>
                              itemIndex !== index,
                          ),
                      })
                    }
                    className="mt-3 inline-flex items-center gap-1 text-xs text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              ),
            )}

            {config.evidenceBundles.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Example: Photo + GPS + timestamp as one evidence capture.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4" />
          Role access
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Empty role lists mean the backend's existing assignment/RBAC rules remain authoritative.
          Add explicit role gates when needed.
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Role</th>
                <th className="p-2 text-center">Use</th>
                <th className="p-2 text-center">Read</th>
                <th className="p-2 text-center">Create</th>
                <th className="p-2 text-center">Update</th>
                <th className="p-2 text-center">Review</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b last:border-0">
                  <td className="py-3 pr-3 font-medium">
                    {role.label}
                  </td>
                  {(
                    [
                      "useRoleIds",
                      "readRoleIds",
                      "createRoleIds",
                      "updateRoleIds",
                      "reviewRoleIds",
                    ] as const
                  ).map((field) => (
                    <td key={field} className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={roleChecked(
                          config.access[field],
                          role.id,
                        )}
                        onChange={() =>
                          toggleRole(field, role.id)
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 max-w-sm">
          <Field label="Who can see resulting records?">
            <select
              value={config.access.recordVisibility}
              onChange={(event) =>
                setConfig({
                  ...config,
                  access: {
                    ...config.access,
                    recordVisibility:
                      event.target
                        .value as ResponsibilityExtensionConfig["access"]["recordVisibility"],
                  },
                })
              }
              className={inputClass}
            >
              <option value="creator">
                Creator only
              </option>
              <option value="creator_and_manager">
                Creator + manager
              </option>
              <option value="department">
                Department
              </option>
              <option value="roles">
                Allowed Roles
              </option>
              <option value="organization">
                Whole organization
              </option>
            </select>
          </Field>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel>
          <div className="flex items-center gap-2 font-semibold">
            <Clock3 className="h-4 w-4" />
            Schedule
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.schedule.enabled}
              onChange={(event) =>
                setConfig({
                  ...config,
                  schedule: {
                    ...config.schedule,
                    enabled: event.target.checked,
                  },
                })
              }
            />
            Limit when this Responsibility is active
          </label>

          {config.schedule.enabled && (
            <div className="mt-3 grid gap-3">
              <Field label="Active from">
                <input
                  type="datetime-local"
                  value={config.schedule.activeFrom ?? ""}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      schedule: {
                        ...config.schedule,
                        activeFrom:
                          event.target.value,
                      },
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Active until">
                <input
                  type="datetime-local"
                  value={config.schedule.activeUntil ?? ""}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      schedule: {
                        ...config.schedule,
                        activeUntil:
                          event.target.value,
                      },
                    })
                  }
                  className={inputClass}
                />
              </Field>
            </div>
          )}
        </Panel>

        <Panel>
          <div className="flex items-center gap-2 font-semibold">
            <MapPin className="h-4 w-4" />
            Geofence
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.geofence.enabled}
              onChange={(event) =>
                setConfig({
                  ...config,
                  geofence: {
                    ...config.geofence,
                    enabled: event.target.checked,
                  },
                })
              }
            />
            Check distance from referenced location
          </label>

          {config.geofence.enabled && (
            <div className="mt-3 space-y-3">
              <Field label="Radius (meters)">
                <input
                  type="number"
                  min={1}
                  value={config.geofence.radiusMeters ?? 200}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      geofence: {
                        ...config.geofence,
                        radiusMeters: Number(
                          event.target.value,
                        ),
                      },
                    })
                  }
                  className={inputClass}
                />
              </Field>

              <Field label="When outside">
                <select
                  value={config.geofence.behavior ?? "warn"}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      geofence: {
                        ...config.geofence,
                        behavior:
                          event.target.value as
                            | "warn"
                            | "block",
                      },
                    })
                  }
                  className={inputClass}
                >
                  <option value="warn">
                    Warn employee
                  </option>
                  <option value="block">
                    Block action
                  </option>
                </select>
              </Field>
            </div>
          )}
        </Panel>

        <Panel>
          <div className="font-semibold">
            Offline / performance
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.offline.enabled}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    offline: {
                      ...config.offline,
                      enabled: event.target.checked,
                    },
                  })
                }
              />
              Offline operation
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  config.offline.prefetchReferences
                }
                onChange={(event) =>
                  setConfig({
                    ...config,
                    offline: {
                      ...config.offline,
                      prefetchReferences:
                        event.target.checked,
                    },
                  })
                }
              />
              Prefetch reference data
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  config.offline.optimisticMutations
                }
                onChange={(event) =>
                  setConfig({
                    ...config,
                    offline: {
                      ...config.offline,
                      optimisticMutations:
                        event.target.checked,
                    },
                  })
                }
              />
              Optimistic submissions
            </label>

            <Field label="Max cached reference rows">
              <input
                type="number"
                min={0}
                max={10000}
                value={
                  config.offline
                    .maxReferenceRows ?? 500
                }
                onChange={(event) =>
                  setConfig({
                    ...config,
                    offline: {
                      ...config.offline,
                      maxReferenceRows: Number(
                        event.target.value,
                      ),
                    },
                  })
                }
                className={inputClass}
              />
            </Field>
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">
              Runtime contract
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Publish freezes a version and generates a compact manifest. Existing in-progress work can remain tied to its previous version.
            </div>
          </div>

          <div className="flex gap-2">
            <SecondaryButton
              type="button"
              onClick={() => void loadBase()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </SecondaryButton>
            <PrimaryButton
              type="button"
              onClick={() => void publish()}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              Publish + compile
            </PrimaryButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}
