"use client";

import {
  Check,
  Loader2,
  Search,
  Send,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  Employee,
  Responsibility,
} from "@/lib/appliance-types";

import type {
  PlatformEntityType,
} from "@/lib/platform-vnext-types";

import {
  apiJson,
} from "./client";

import {
  inputClass,
  Notice,
  PrimaryButton,
  SecondaryButton,
} from "./primitives";

type EntityRecord = {
  id: string;
  externalKey?: string | null;
  status?: string;
  data?: Record<string, unknown>;
};

type Props = {
  entity: PlatformEntityType;
  onClose: () => void;
};

function recordLabel(
  entity: PlatformEntityType,
  record: EntityRecord,
) {
  const data =
    record.data ?? {};

  const firstField =
    entity.fieldDefinitions[0]?.key;

  const candidates = [
    firstField,
    "name",
    "title",
    "label",
    "dealer_name",
    "site_name",
    "code",
  ].filter(
    (value): value is string =>
      Boolean(value),
  );

  for (
    const key
    of candidates
  ) {
    const value =
      data[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim()
    ) {
      return String(value);
    }
  }

  return (
    record.externalKey ||
    record.id
  );
}

function recordSubtitle(
  record: EntityRecord,
) {
  const data =
    record.data ?? {};

  const values =
    Object.entries(data)
      .filter(
        ([, value]) =>
          value !== null &&
          value !== undefined &&
          typeof value !== "object",
      )
      .slice(1, 4)
      .map(
        ([key, value]) =>
          `${key.replace(/_/g, " ")}: ${String(value)}`,
      );

  return values.join(" · ");
}

export default function AssignListWork({
  entity,
  onClose,
}: Props) {
  const [
    records,
    setRecords,
  ] =
    useState<EntityRecord[]>([]);

  const [
    employees,
    setEmployees,
  ] =
    useState<Employee[]>([]);

  const [
    responsibilities,
    setResponsibilities,
  ] =
    useState<Responsibility[]>([]);

  const [
    selected,
    setSelected,
  ] =
    useState<Set<string>>(
      new Set(),
    );

  const [
    employeeId,
    setEmployeeId,
  ] =
    useState("");

  const [
    responsibilityKey,
    setResponsibilityKey,
  ] =
    useState("");

  const [
    priority,
    setPriority,
  ] =
    useState("normal");

  const [
    dueAt,
    setDueAt,
  ] =
    useState("");

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
    searching,
    setSearching,
  ] =
    useState(false);

  const [
    assigning,
    setAssigning,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null,
    );

  const loadRecords =
    useCallback(
      async (
        q = "",
      ) => {
        setSearching(true);

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
        } catch (
          error
        ) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not load records.",
          );
        } finally {
          setSearching(false);
        }
      },
      [
        entity.id,
      ],
    );

  useEffect(
    () => {
      let active =
        true;

      void (
        async () => {
          setLoading(true);

          try {
            const [
              employeeBody,
              responsibilityBody,
            ] =
              await Promise.all([
                apiJson<{
                  employees:
                    Employee[];
                }>(
                  "/api/appliance/employees",
                ),

                apiJson<{
                  responsibilities:
                    Responsibility[];
                }>(
                  "/api/appliance/responsibilities",
                ),
              ]);

            if (
              !active
            ) {
              return;
            }

            const employeeRows =
              (
                employeeBody.employees ??
                []
              ).filter(
                (employee) =>
                  employee.status ===
                    "active" &&
                  employee.mobileAccess !==
                    false,
              );

            const responsibilityRows =
              (
                responsibilityBody.responsibilities ??
                []
              ).filter(
                (responsibility) =>
                  responsibility.isActive !==
                  false,
              );

            setEmployees(
              employeeRows,
            );

            setResponsibilities(
              responsibilityRows,
            );

            setEmployeeId(
              employeeRows[0]
                ?.id
                ?.toString() ??
                "",
            );

            setResponsibilityKey(
              responsibilityRows[0]
                ?.key ??
                "",
            );

            await loadRecords();
          } catch (
            error
          ) {
            if (
              !active
            ) {
              return;
            }

            setMessage(
              error instanceof Error
                ? error.message
                : "Could not prepare assignment.",
            );
          } finally {
            if (
              active
            ) {
              setLoading(false);
            }
          }
        }
      )();

      return () => {
        active =
          false;
      };
    },
    [
      loadRecords,
    ],
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
          300,
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

  const allSelected =
    useMemo(
      () =>
        records.length >
          0 &&
        records.every(
          (record) =>
            selected.has(
              record.id,
            ),
        ),
      [
        records,
        selected,
      ],
    );

  function toggle(
    id: string,
  ) {
    setSelected(
      (current) => {
        const next =
          new Set(
            current,
          );

        if (
          next.has(id)
        ) {
          next.delete(id);
        } else {
          next.add(id);
        }

        return next;
      },
    );
  }

  function togglePage() {
    setSelected(
      (current) => {
        const next =
          new Set(
            current,
          );

        if (
          allSelected
        ) {
          for (
            const record
            of records
          ) {
            next.delete(
              record.id,
            );
          }
        } else {
          for (
            const record
            of records
          ) {
            next.add(
              record.id,
            );
          }
        }

        return next;
      },
    );
  }

  async function assign() {
    if (
      selected.size === 0
    ) {
      setMessage(
        "Choose at least one record.",
      );

      return;
    }

    if (
      !employeeId
    ) {
      setMessage(
        "Choose an employee.",
      );

      return;
    }

    if (
      !responsibilityKey
    ) {
      setMessage(
        "Choose a Responsibility.",
      );

      return;
    }

    setAssigning(true);
    setMessage(null);

    try {
      const body =
        await apiJson<{
          created?: Array<{
            workItemId:
              string;
          }>;

          skipped?: Array<{
            sourceRecordId:
              string;

            reason:
              string;
          }>;
        }>(
          "/api/appliance/work-items",
          {
            method:
              "POST",

            body:
              JSON.stringify({
                responsibilityKey,

                sourceEntityTypeKey:
                  entity.key,

                sourceRecordIds:
                  [
                    ...selected,
                  ],

                assigneeUserId:
                  Number(
                    employeeId,
                  ),

                priority,

                dueAt:
                  dueAt
                    ? new Date(
                        dueAt,
                      ).toISOString()
                    : null,
              }),
          },
        );

      const created =
        body.created?.length ??
        0;

      const skipped =
        body.skipped?.length ??
        0;

      setMessage(
        skipped
          ? `${created} assigned. ${skipped} already had active work and were skipped.`
          : `${created} record${created === 1 ? "" : "s"} assigned to the employee app.`,
      );

      setSelected(
        new Set(),
      );
    } catch (
      error
    ) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not assign work.",
      );
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[92vh] w-full max-w-[980px] flex-col overflow-hidden rounded-[20px] border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
          <div>
            <div className="text-lg font-semibold">
              Assign field work
            </div>

            <div className="mt-1 text-sm text-muted-foreground">
              Send selected {entity.title} records directly to an employee&apos;s BRIXTA app.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {message && (
          <div className="px-6 pt-4">
            <Notice
              tone={
                /could not|required|choose|not found|error/i.test(
                  message,
                )
                  ? "danger"
                  : "good"
              }
              onDismiss={() =>
                setMessage(
                  null,
                )
              }
            >
              {message}
            </Notice>
          </div>
        )}

        {loading ? (
          <div className="flex h-[420px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 lg:grid-cols-[1.25fr_.75fr]">
            <div className="flex min-h-0 flex-col border-r">
              <div className="border-b p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

                  <input
                    className={`${inputClass} pl-9`}
                    value={query}
                    onChange={(event) =>
                      setQuery(
                        event.target.value,
                      )
                    }
                    placeholder={`Search ${entity.title}...`}
                  />

                  {searching && (
                    <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={togglePage}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {allSelected
                      ? "Clear this page"
                      : "Select this page"}
                  </button>

                  <span className="text-xs text-muted-foreground">
                    {selected.size} selected
                  </span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {records.length ===
                0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No matching records.
                  </div>
                ) : (
                  <div className="divide-y">
                    {records.map(
                      (
                        record,
                      ) => {
                        const checked =
                          selected.has(
                            record.id,
                          );

                        return (
                          <button
                            type="button"
                            key={
                              record.id
                            }
                            onClick={() =>
                              toggle(
                                record.id,
                              )
                            }
                            className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-muted/30"
                          >
                            <span
                              className={[
                                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                                checked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-input bg-background",
                              ].join(
                                " ",
                              )}
                            >
                              {checked && (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {recordLabel(
                                  entity,
                                  record,
                                )}
                              </span>

                              {recordSubtitle(
                                record,
                              ) && (
                                <span className="mt-1 block truncate text-xs text-muted-foreground">
                                  {recordSubtitle(
                                    record,
                                  )}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="text-[13px] font-semibold">
                What should happen?
              </div>

              <div className="mt-5 space-y-5">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium">
                    Responsibility
                  </span>

                  <select
                    className={inputClass}
                    value={
                      responsibilityKey
                    }
                    onChange={(
                      event,
                    ) =>
                      setResponsibilityKey(
                        event
                          .target
                          .value,
                      )
                    }
                  >
                    {responsibilities.map(
                      (
                        responsibility,
                      ) => (
                        <option
                          key={
                            responsibility.id
                          }
                          value={
                            responsibility.key
                          }
                        >
                          {
                            responsibility.title
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium">
                    Assign to
                  </span>

                  <select
                    className={inputClass}
                    value={
                      employeeId
                    }
                    onChange={(
                      event,
                    ) =>
                      setEmployeeId(
                        event
                          .target
                          .value,
                      )
                    }
                  >
                    {employees.map(
                      (
                        employee,
                      ) => (
                        <option
                          key={
                            employee.id
                          }
                          value={
                            employee.id
                          }
                        >
                          {employee.name ??
                            employee.employeeCode ??
                            `Employee ${employee.id}`}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium">
                    Priority
                  </span>

                  <select
                    className={inputClass}
                    value={priority}
                    onChange={(
                      event,
                    ) =>
                      setPriority(
                        event
                          .target
                          .value,
                      )
                    }
                  >
                    <option value="normal">
                      Normal
                    </option>

                    <option value="high">
                      High
                    </option>

                    <option value="urgent">
                      Urgent
                    </option>

                    <option value="low">
                      Low
                    </option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium">
                    Due
                  </span>

                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={dueAt}
                    onChange={(
                      event,
                    ) =>
                      setDueAt(
                        event
                          .target
                          .value,
                      )
                    }
                  />
                </label>

                <div className="rounded-xl border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
                  BRIXTA will create linked work — not a CSV copy.
                  The selected business record remains the canonical source,
                  and the employee&apos;s Responsibility record is traceably
                  linked back to it.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          <SecondaryButton
            type="button"
            onClick={onClose}
          >
            Cancel
          </SecondaryButton>

          <PrimaryButton
            type="button"
            disabled={
              loading ||
              assigning ||
              selected.size ===
                0 ||
              !employeeId ||
              !responsibilityKey
            }
            onClick={() =>
              void assign()
            }
          >
            {assigning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}

            Assign {selected.size || ""} to app
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
