"use client";

import {
  Plus,
  Trash2,
} from "lucide-react";

import type {
  FieldAppConfig,
  FieldLensKind,
  FieldListLens,
} from "@/lib/field-app-contract";

import type {
  PlatformEntityType,
} from "@/lib/platform-vnext-types";

import {
  Field,
  inputClass,
  SecondaryButton,
} from "./primitives";


const LENS_TYPES: Array<{
  value: FieldLensKind;
  label: string;
}> = [
  { value: "mine", label: "Assigned to me" },
  { value: "todo", label: "To do / not visited" },
  { value: "active", label: "In progress" },
  { value: "followups", label: "Has follow-up" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "Everything" },
  { value: "stages", label: "Specific stages" },
  { value: "field", label: "CRM / answer value" },
];


function nextLensKey(
  config: FieldAppConfig,
) {
  const used =
    new Set(
      config.experience.list.lenses.map(
        (lens) => lens.key,
      ),
    );

  let index = 1;

  while (
    used.has(`view_${index}`)
  ) {
    index += 1;
  }

  return `view_${index}`;
}


function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
      />
      {label}
    </label>
  );
}


export default function AppExperienceControls({
  entity,
  config,
  onChange,
}: {
  entity: PlatformEntityType;
  config: FieldAppConfig;
  onChange: (config: FieldAppConfig) => void;
}) {
  const experience =
    config.experience;

  const list =
    experience.list;

  const detail =
    experience.detail;

  const management =
    experience.management;


  function patchList(
    patch: Partial<typeof list>,
  ) {
    onChange({
      ...config,
      experience: {
        ...experience,
        list: {
          ...list,
          ...patch,
        },
      },
    });
  }


  function patchDetail(
    patch: Partial<typeof detail>,
  ) {
    onChange({
      ...config,
      experience: {
        ...experience,
        detail: {
          ...detail,
          ...patch,
        },
      },
    });
  }


  function patchManagement(
    patch: Partial<typeof management>,
  ) {
    onChange({
      ...config,
      experience: {
        ...experience,
        management: {
          ...management,
          ...patch,
        },
      },
    });
  }


  function patchLens(
    index: number,
    patch: Partial<FieldListLens>,
  ) {
    patchList({
      lenses:
        list.lenses.map(
          (lens, position) =>
            position === index
              ? {
                  ...lens,
                  ...patch,
                }
              : lens,
        ),
    });
  }


  function removeLens(
    index: number,
  ) {
    const removed =
      list.lenses[index];

    if (!removed)
      return;

    const lenses =
      list.lenses.filter(
        (_, position) =>
          position !== index,
      );

    if (
      lenses.length === 0
    ) {
      return;
    }

    patchList({
      lenses,

      defaultLens:
        list.defaultLens ===
        removed.key
          ? lenses[0].key
          : list.defaultLens,
    });

    patchManagement({
      summaryLensKeys:
        management.summaryLensKeys.filter(
          (key) =>
            key !== removed.key,
        ),
    });
  }


  function addLens() {
    const key =
      nextLensKey(
        config,
      );

    patchList({
      lenses: [
        ...list.lenses,
        {
          key,
          label: "New view",
          kind: "all",
          field: null,
          values: [],
          stageKeys: [],
        },
      ],
    });
  }


  function toggleCardField(
    key: string,
  ) {
    const current =
      list.cardFields;

    const exists =
      current.includes(
        key,
      );

    patchList({
      cardFields:
        exists
          ? current.filter(
              (item) =>
                item !== key,
            )
          : current.length >=
              4
            ? [
                ...current.slice(
                  1,
                ),
                key,
              ]
            : [
                ...current,
                key,
              ],
    });
  }


  function toggleSummaryLens(
    key: string,
  ) {
    const current =
      management.summaryLensKeys;

    patchManagement({
      summaryLensKeys:
        current.includes(
          key,
        )
          ? current.filter(
              (item) =>
                item !== key,
            )
          : [
              ...current,
              key,
            ].slice(
              0,
              8,
            ),
    });
  }


  return (
    <div className="space-y-6">

      <div>
        <div className="text-lg font-semibold">
          List experience
        </div>

        <div className="mt-1 text-sm text-muted-foreground">
          Control what the salesman sees before opening a CRM record.
        </div>
      </div>


      <div className="grid gap-4 md:grid-cols-2">

        <Field
          label="Which records may the employee see?"
        >
          <select
            className={inputClass}
            value={
              list.recordScope
            }
            onChange={(event) =>
              patchList({
                recordScope:
                  event.target
                    .value ===
                  "assigned_to_me"
                    ? "assigned_to_me"
                    : "all",
              })
            }
          >
            <option value="all">
              All available records
            </option>

            <option value="assigned_to_me">
              Only records assigned to them
            </option>
          </select>
        </Field>


        <Field label="Default view">
          <select
            className={inputClass}
            value={
              list.defaultLens
            }
            onChange={(event) =>
              patchList({
                defaultLens:
                  event.target
                    .value,
              })
            }
          >
            {list.lenses.map(
              (lens) => (
                <option
                  key={
                    lens.key
                  }
                  value={
                    lens.key
                  }
                >
                  {
                    lens.label
                  }
                </option>
              ),
            )}
          </select>
        </Field>


        <Field label="Default sorting">
          <select
            className={inputClass}
            value={
              list.sort
            }
            onChange={(event) =>
              patchList({
                sort:
                  event.target
                    .value as typeof list.sort,
              })
            }
          >
            <option value="smart">
              Smart: distance → priority → recent
            </option>
            <option value="distance">
              Nearest first
            </option>
            <option value="priority">
              Highest priority
            </option>
            <option value="updated">
              Recently updated
            </option>
            <option value="follow_up">
              Follow-up date
            </option>
          </select>
        </Field>


        <Field
          label="Prominent badge"
          hint="Example: Hot / Warm / Cold."
        >
          <select
            className={inputClass}
            value={
              list.badgeField ??
              ""
            }
            onChange={(event) =>
              patchList({
                badgeField:
                  event.target
                    .value ||
                  null,
              })
            }
          >
            <option value="">
              No extra badge
            </option>

            {entity.fieldDefinitions.map(
              (field) => (
                <option
                  key={
                    field.key
                  }
                  value={
                    field.key
                  }
                >
                  {
                    field.label
                  }
                </option>
              ),
            )}
          </select>
        </Field>

      </div>


      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">

        <Toggle
          label="Search"
          checked={
            list.search
          }
          onChange={(value) =>
            patchList({
              search:
                value,
            })
          }
        />

        <Toggle
          label="Distance"
          checked={
            list.showDistance
          }
          onChange={(value) =>
            patchList({
              showDistance:
                value,
            })
          }
        />

        <Toggle
          label="Assigned person"
          checked={
            list.showAssignee
          }
          onChange={(value) =>
            patchList({
              showAssignee:
                value,
            })
          }
        />

        <Toggle
          label="Follow-up"
          checked={
            list.showFollowUp
          }
          onChange={(value) =>
            patchList({
              showFollowUp:
                value,
            })
          }
        />

        <Toggle
          label="Last activity"
          checked={
            list.showLastActivity
          }
          onChange={(value) =>
            patchList({
              showLastActivity:
                value,
            })
          }
        />

      </div>


      <div className="space-y-2">

        <div className="text-sm font-semibold">
          Extra information on each card
        </div>

        <div className="text-xs text-muted-foreground">
          Choose up to four CRM/captured values.
        </div>

        <div className="flex flex-wrap gap-2">

          {entity.fieldDefinitions.map(
            (field) => {
              const active =
                list.cardFields.includes(
                  field.key,
                );

              return (
                <button
                  key={
                    field.key
                  }
                  type="button"
                  onClick={() =>
                    toggleCardField(
                      field.key,
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background"
                  }`}
                >
                  {
                    field.label
                  }
                </button>
              );
            },
          )}

        </div>

      </div>


      <div className="space-y-3">

        <div className="flex items-center justify-between gap-3">

          <div>
            <div className="text-sm font-semibold">
              Views / filters
            </div>

            <div className="text-xs text-muted-foreground">
              These become the pills above the salesman&apos;s list.
            </div>
          </div>

          <SecondaryButton
            type="button"
            onClick={
              addLens
            }
          >
            <Plus className="h-4 w-4" />
            Add view
          </SecondaryButton>

        </div>


        {list.lenses.map(
          (
            lens,
            index,
          ) => (

            <div
              key={
                lens.key
              }
              className="grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(130px,1fr)_190px_minmax(180px,1fr)_auto]"
            >

              <div>
                <input
                  className={inputClass}
                  value={
                    lens.label
                  }
                  onChange={(event) =>
                    patchLens(
                      index,
                      {
                        label:
                          event.target
                            .value,
                      },
                    )
                  }
                />

                <div className="mt-1 font-mono text-[9px] text-muted-foreground">
                  {
                    lens.key
                  }
                </div>
              </div>


              <select
                className={inputClass}
                value={
                  lens.kind
                }
                onChange={(event) =>
                  patchLens(
                    index,
                    {
                      kind:
                        event.target
                          .value as FieldLensKind,
                    },
                  )
                }
              >
                {LENS_TYPES.map(
                  (type) => (
                    <option
                      key={
                        type.value
                      }
                      value={
                        type.value
                      }
                    >
                      {
                        type.label
                      }
                    </option>
                  ),
                )}
              </select>


              {lens.kind ===
              "field" ? (

                <div className="grid gap-2 sm:grid-cols-2">

                  <select
                    className={inputClass}
                    value={
                      lens.field ??
                      ""
                    }
                    onChange={(event) =>
                      patchLens(
                        index,
                        {
                          field:
                            event.target
                              .value ||
                            null,
                        },
                      )
                    }
                  >
                    <option value="">
                      Choose field…
                    </option>

                    {entity.fieldDefinitions.map(
                      (field) => (
                        <option
                          key={
                            field.key
                          }
                          value={
                            field.key
                          }
                        >
                          {
                            field.label
                          }
                        </option>
                      ),
                    )}
                  </select>


                  <input
                    className={inputClass}
                    value={
                      lens.values.join(
                        ", ",
                      )
                    }
                    placeholder="Hot, Warm"
                    onChange={(event) =>
                      patchLens(
                        index,
                        {
                          values:
                            event.target
                              .value
                              .split(
                                ",",
                              )
                              .map(
                                (
                                  value,
                                ) =>
                                  value.trim(),
                              )
                              .filter(
                                Boolean,
                              ),
                        },
                      )
                    }
                  />

                </div>

              ) : lens.kind ===
                "stages" ||
                lens.kind ===
                  "todo" ? (

                <input
                  className={inputClass}
                  value={
                    lens.stageKeys.join(
                      ", ",
                    )
                  }
                  placeholder="new, verified, pitched"
                  onChange={(event) =>
                    patchLens(
                      index,
                      {
                        stageKeys:
                          event.target
                            .value
                            .split(
                              ",",
                            )
                            .map(
                              (
                                value,
                              ) =>
                                value.trim(),
                            )
                            .filter(
                              Boolean,
                            ),
                      },
                    )
                  }
                />

              ) : (

                <div className="flex items-center text-xs text-muted-foreground">
                  Built-in behaviour
                </div>

              )}


              <button
                type="button"
                aria-label="Delete view"
                disabled={
                  list.lenses
                    .length <=
                  1
                }
                onClick={() =>
                  removeLens(
                    index,
                  )
                }
                className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-700 disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>

            </div>

          ),
        )}

      </div>


      <div className="border-t pt-5">

        <div className="text-lg font-semibold">
          Record screen
        </div>

        <div className="mt-1 text-sm text-muted-foreground">
          Choose what surrounds the operational steps after a record is opened.
        </div>


        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">

          <Toggle
            label="Map"
            checked={
              detail.showMap
            }
            onChange={(value) =>
              patchDetail({
                showMap:
                  value,
              })
            }
          />

          <Toggle
            label="Navigate"
            checked={
              detail.showNavigate
            }
            onChange={(value) =>
              patchDetail({
                showNavigate:
                  value,
              })
            }
          />

          <Toggle
            label="Copy map link"
            checked={
              detail.showCopyLink
            }
            onChange={(value) =>
              patchDetail({
                showCopyLink:
                  value,
              })
            }
          />

          <Toggle
            label="Imported CRM info"
            checked={
              detail.showImportedInfo
            }
            onChange={(value) =>
              patchDetail({
                showImportedInfo:
                  value,
              })
            }
          />

          <Toggle
            label="Timeline"
            checked={
              detail.showTimeline
            }
            onChange={(value) =>
              patchDetail({
                showTimeline:
                  value,
              })
            }
          />

        </div>

      </div>


      <div className="border-t pt-5">

        <div className="text-lg font-semibold">
          Management summary
        </div>

        <div className="mt-1 text-sm text-muted-foreground">
          Pick which app views become live count cards in CMS → Data input.
        </div>


        <div className="mt-4 flex flex-wrap gap-2">

          {list.lenses.map(
            (lens) => {
              const active =
                management.summaryLensKeys.includes(
                  lens.key,
                );

              return (
                <button
                  key={
                    lens.key
                  }
                  type="button"
                  onClick={() =>
                    toggleSummaryLens(
                      lens.key,
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background"
                  }`}
                >
                  {
                    lens.label
                  }
                </button>
              );
            },
          )}

        </div>

      </div>

    </div>
  );
}
