"use client";

import {
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  PlatformEntityType,
} from "@/lib/platform-vnext-types";

import {
  apiJson,
  formatDateTime,
} from "./client";

import {
  inputClass,
  Notice,
  SecondaryButton,
} from "./primitives";

type EntityRecord = {
  id: string;
  externalKey?: string | null;
  status?: string;
  data?: Record<string, unknown>;
  updatedAt?: string | null;
};

type FieldActivity = {
  id: string;

  status: string;

  values:
    Record<string, unknown>;

  createdAt?: string | null;
  updatedAt?: string | null;
  submittedAt?: string | null;

  responsibilityId: number;
  responsibilityKey: string;
  responsibilityTitle: string;

  employeeId?: number | null;
  employeeName?: string | null;
  employeeCode?: string | null;

  workItemId?: string | null;
  workStatus?: string | null;
  workPriority?: string | null;
  workTitle?: string | null;

  dueAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;

  sourceContext?:
    Record<string, unknown>;

  assignmentContext?:
    Record<string, unknown>;
};

type RecordDetail = {
  record:
    EntityRecord;

  activity:
    FieldActivity[];
};

function readable(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (
    typeof value ===
      "boolean"
  ) {
    return value
      ? "Yes"
      : "No";
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number"
  ) {
    return String(
      value,
    );
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return value
      .map(readable)
      .join(", ");
  }

  if (
    typeof value ===
      "object"
  ) {
    const object =
      value as Record<
        string,
        unknown
      >;

    const label =
      object.label ??
      object.name ??
      object.title ??
      object.id;

    if (
      label !== undefined
    ) {
      return String(
        label,
      );
    }

    try {
      return JSON.stringify(
        object,
      );
    } catch {
      return "Object";
    }
  }

  return String(
    value,
  );
}

function recordLabel(
  entity: PlatformEntityType,
  record: EntityRecord,
) {
  const data =
    record.data ?? {};

  const keys = [
    entity.fieldDefinitions[0]
      ?.key,
    "name",
    "title",
    "label",
    "dealer_name",
    "site_name",
    "shop_name",
    "code",
  ].filter(
    (
      value,
    ): value is string =>
      Boolean(value),
  );

  for (
    const key
    of keys
  ) {
    const value =
      data[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value)
        .trim()
    ) {
      return String(
        value,
      );
    }
  }

  return (
    record.externalKey ??
    record.id
  );
}

function toneForStatus(
  status: string | null | undefined,
) {
  const normalized =
    String(
      status ?? "",
    ).toLowerCase();

  if (
    [
      "completed",
      "approved",
      "verified",
      "won",
      "done",
    ].includes(
      normalized,
    )
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    [
      "assigned",
      "in_progress",
      "pending",
      "visited",
      "contacted",
      "follow_up",
    ].includes(
      normalized,
    )
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (
    [
      "rejected",
      "lost",
      "cancelled",
      "deleted",
    ].includes(
      normalized,
    )
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-border bg-muted/40 text-muted-foreground";
}

function Status({
  value,
}: {
  value:
    string | null | undefined;
}) {
  if (
    !value
  ) {
    return null;
  }

  return (
    <span
      className={[
        "inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
        toneForStatus(
          value,
        ),
      ].join(
        " ",
      )}
    >
      {value.replace(
        /_/g,
        " ",
      )}
    </span>
  );
}

export default function EntityRecordsBrowser({
  entity,
  onClose,
}: {
  entity:
    PlatformEntityType;

  onClose:
    () => void;
}) {
  const [
    records,
    setRecords,
  ] =
    useState<
      EntityRecord[]
    >([]);

  const [
    selectedId,
    setSelectedId,
  ] =
    useState<
      string | null
    >(null);

  const [
    detail,
    setDetail,
  ] =
    useState<
      RecordDetail | null
    >(null);

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    detailLoading,
    setDetailLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const loadRecords =
    useCallback(
      async (
        q = "",
      ) => {
        setLoading(true);

        try {
          const body =
            await apiJson<{
              records:
                EntityRecord[];
            }>(
              `/api/platform/entity-records?entityTypeId=${entity.id}&limit=100&q=${encodeURIComponent(q)}`,
            );

          setRecords(
            body.records ??
            [],
          );

          if (
            !selectedId &&
            body.records?.[0]
          ) {
            setSelectedId(
              body.records[0]
                .id,
            );
          }
        } catch (
          failure
        ) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not load records.",
          );
        } finally {
          setLoading(false);
        }
      },
      [
        entity.id,
        selectedId,
      ],
    );

  const loadDetail =
    useCallback(
      async (
        recordId: string,
      ) => {
        setDetailLoading(
          true,
        );

        try {
          const body =
            await apiJson<
              RecordDetail
            >(
              `/api/platform/entity-records/${encodeURIComponent(recordId)}`,
            );

          setDetail(
            body,
          );
        } catch (
          failure
        ) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not load record activity.",
          );
        } finally {
          setDetailLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(
    () => {
      const timer =
        window.setTimeout(
          () => {
            void loadRecords(
              query.trim(),
            );
          },
          250,
        );

      return () =>
        window.clearTimeout(
          timer,
        );
    },
    [
      query,
      loadRecords,
    ],
  );

  useEffect(
    () => {
      if (
        selectedId
      ) {
        void loadDetail(
          selectedId,
        );
      } else {
        setDetail(
          null,
        );
      }
    },
    [
      selectedId,
      loadDetail,
    ],
  );

  const selectedRecord =
    useMemo(
      () =>
        detail?.record ??
        records.find(
          (record) =>
            record.id ===
            selectedId,
        ) ??
        null,
      [
        detail,
        records,
        selectedId,
      ],
    );

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]">
      <div className="flex h-[90vh] w-full max-w-[1280px] flex-col overflow-hidden rounded-[20px] border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
          <div>
            <div className="text-lg font-semibold">
              {entity.title}
            </div>

            <div className="mt-1 text-sm text-muted-foreground">
              CRM records and their live field activity.
            </div>
          </div>

          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="px-5 pt-4">
            <Notice
              tone="danger"
              onDismiss={() =>
                setError(
                  null,
                )
              }
            >
              {error}
            </Notice>
          </div>
        )}

        <div className="grid min-h-0 flex-1 md:grid-cols-[360px_1fr]">
          <div className="flex min-h-0 flex-col border-r">
            <div className="border-b p-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

                <input
                  className={`${inputClass} pl-9`}
                  value={query}
                  onChange={(
                    event,
                  ) =>
                    setQuery(
                      event.target.value,
                    )
                  }
                  placeholder={`Search ${entity.title}...`}
                />

                {loading && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {!loading &&
              records.length ===
                0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No records found.
                </div>
              ) : (
                <div className="divide-y">
                  {records.map(
                    (
                      record,
                    ) => {
                      const selected =
                        record.id ===
                        selectedId;

                      return (
                        <button
                          type="button"
                          key={
                            record.id
                          }
                          onClick={() =>
                            setSelectedId(
                              record.id,
                            )
                          }
                          className={[
                            "w-full px-5 py-4 text-left transition",
                            selected
                              ? "bg-primary/[0.055]"
                              : "hover:bg-muted/30",
                          ].join(
                            " ",
                          )}
                        >
                          <div className="truncate text-sm font-semibold">
                            {recordLabel(
                              entity,
                              record,
                            )}
                          </div>

                          <div className="mt-1 flex items-center gap-2">
                            <Status
                              value={
                                record.status
                              }
                            />

                            {record.updatedAt && (
                              <span className="truncate text-[11px] text-muted-foreground">
                                {formatDateTime(
                                  record.updatedAt,
                                )}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto">
            {!selectedRecord ? (
              <div className="flex h-full items-center justify-center p-10 text-sm text-muted-foreground">
                Select a record.
              </div>
            ) : detailLoading &&
              !detail ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-8 p-6 lg:p-8">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {recordLabel(
                        entity,
                        selectedRecord,
                      )}
                    </h2>

                    <Status
                      value={
                        selectedRecord.status
                      }
                    />
                  </div>

                  {selectedRecord.externalKey && (
                    <div className="mt-2 font-mono text-xs text-muted-foreground">
                      {selectedRecord.externalKey}
                    </div>
                  )}
                </div>

                <section>
                  <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    CRM data
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {entity.fieldDefinitions.map(
                      (
                        field,
                      ) => (
                        <div
                          key={
                            field.key
                          }
                          className="rounded-xl border bg-card p-4"
                        >
                          <div className="text-[11px] text-muted-foreground">
                            {field.label}
                          </div>

                          <div className="mt-1 break-words text-sm font-medium">
                            {readable(
                              selectedRecord
                                .data?.[
                                field.key
                              ],
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Employee input & results
                      </div>

                      <div className="mt-1 text-sm text-muted-foreground">
                        Employee-entered values from Responsibilities linked to this CRM record. Original CRM fields remain unchanged.
                      </div>
                    </div>

                    {selectedId && (
                      <SecondaryButton
                        type="button"
                        className="h-9"
                        onClick={() =>
                          void loadDetail(
                            selectedId,
                          )
                        }
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                      </SecondaryButton>
                    )}
                  </div>

                  {!detail?.activity
                    ?.length ? (
                    <div className="rounded-xl border border-dashed p-8 text-center">
                      <div className="text-sm font-medium">
                        No employee input yet
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        Assign this CRM record to a Responsibility to collect additional information from an employee.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {detail.activity.map(
                        (
                          activity,
                          index,
                        ) => (
                          <div
                            key={
                              activity.id
                            }
                            className="overflow-hidden rounded-[16px] border bg-card"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-[15px] font-semibold">
                                    {activity.responsibilityTitle}
                                  </div>

                                  {index ===
                                    0 && (
                                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                                      LATEST
                                    </span>
                                  )}

                                  <Status
                                    value={
                                      activity.status
                                    }
                                  />

                                  <Status
                                    value={
                                      activity.workStatus
                                    }
                                  />
                                </div>

                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1.5">
                                    <UserRound className="h-3.5 w-3.5" />

                                    {activity.employeeName ??
                                      activity.employeeCode ??
                                      `Employee ${activity.employeeId ?? ""}`}
                                  </span>

                                  {activity.updatedAt && (
                                    <span className="inline-flex items-center gap-1.5">
                                      <Clock3 className="h-3.5 w-3.5" />

                                      {formatDateTime(
                                        activity.updatedAt,
                                      )}
                                    </span>
                                  )}

                                  {activity.completedAt && (
                                    <span className="inline-flex items-center gap-1.5 text-emerald-700">
                                      <CheckCircle2 className="h-3.5 w-3.5" />

                                      completed
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right">
                                {activity.workPriority && (
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {activity.workPriority} priority
                                  </div>
                                )}

                                {activity.dueAt && (
                                  <div className="mt-1 text-xs">
                                    Due {formatDateTime(
                                      activity.dueAt,
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="p-5">
                              {Object.keys(
                                activity.values ??
                                  {},
                              ).length ===
                              0 ? (
                                <div className="text-sm text-muted-foreground">
                                  No employee-entered values yet.
                                </div>
                              ) : (
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                  {Object.entries(
                                    activity.values,
                                  ).map(
                                    ([
                                      key,
                                      value,
                                    ]) => (
                                      <div
                                        key={
                                          key
                                        }
                                        className="rounded-xl bg-muted/25 p-3"
                                      >
                                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                          {key.replace(
                                            /_/g,
                                            " ",
                                          )}
                                        </div>

                                        <div className="mt-1 break-words text-sm font-medium">
                                          {readable(
                                            value,
                                          )}
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
