"use client";

import type {
  Employee,
  ReportingPolicy,
  ReportingPolicyMode,
  ReportingScope,
  ReportingSnapshot,
  Role,
} from "@/lib/appliance-types";

import {
  inputClass,
  Pill,
  SecondaryButton,
} from "./primitives";

const SCOPES: Array<{
  value: ReportingScope;
  label: string;
}> = [
  {
    value:
      "same_department",
    label:
      "This employee's department",
  },
  {
    value:
      "same_area",
    label:
      "This employee's area",
  },
  {
    value:
      "same_zone",
    label:
      "This employee's zone",
  },
  {
    value:
      "same_department_area",
    label:
      "Same department and area",
  },
  {
    value:
      "same_department_zone",
    label:
      "Same department and zone",
  },
  {
    value:
      "organization",
    label:
      "Anywhere in the organization",
  },
];

function roleLabel(
  role: Role,
) {
  return (
    role.label ??
    [
      role.orgRole,
      role.jobRole,
    ]
      .filter(Boolean)
      .join(" · ") ??
    `Role ${role.id}`
  );
}

function personLabel(
  employee: Employee,
) {
  const name =
    employee.name ??
    employee.employeeCode ??
    `Employee ${employee.id}`;

  const meta = [
    employee.designation,
    employee.department,
    employee.area,
  ]
    .filter(Boolean)
    .join(" · ");

  return meta
    ? `${name} — ${meta}`
    : name;
}

function statusTone(
  status?: string,
):
  | "good"
  | "info"
  | "danger"
  | "neutral" {
  if (
    status === "resolved"
  ) return "good";

  if (
    status === "top_level"
  ) return "info";

  if (
    status === "ambiguous" ||
    status === "invalid"
  ) return "danger";

  return "neutral";
}

function statusLabel(
  snapshot?: ReportingSnapshot | null,
) {
  const status =
    snapshot?.resolution
      ?.status;

  switch (status) {
    case "resolved":
      return "Ready";
    case "top_level":
      return "No manager";
    case "ambiguous":
      return "Multiple people match";
    case "no_match":
      return "Nobody found";
    case "invalid":
      return "Needs attention";
    default:
      return "Not set";
  }
}

export default function ReportingPolicyEditor({
  value,
  onChange,
  employees,
  roles,
  subjectId,
  snapshot,
  onPreview,
}: {
  value: ReportingPolicy;
  onChange: (
    value: ReportingPolicy,
  ) => void;

  employees: Employee[];
  roles: Role[];
  subjectId?: number | null;

  snapshot?: ReportingSnapshot | null;

  onPreview?: () => void;
}) {
  const mode =
    value.mode;

  const setMode = (
    next: ReportingPolicyMode,
  ) => {
    if (
      next ===
      "specific_user"
    ) {
      onChange({
        version: 1,
        mode: next,
      });

      return;
    }

    if (
      next === "role"
    ) {
      onChange({
        version: 1,
        mode: next,
        scope:
          "same_department",
      });

      return;
    }

    onChange({
      version: 1,
      mode: next,
    });
  };

  const availableEmployees =
    employees.filter(
      (employee) =>
        employee.id !==
          subjectId &&
        employee.status !==
          "inactive" &&
        employee.status !==
          "suspended",
    );

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <div className="font-medium">
          Default manager & approver
        </div>

        <div className="mt-1 text-xs text-muted-foreground">
          This is this employee's normal manager and default approver. If a Responsibility explicitly chooses someone else, that rule takes priority.
        </div>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          How should BRIXTA choose them?
        </span>

        <select
          className={inputClass}
          value={mode}
          onChange={(event) =>
            setMode(
              event.target
                .value as ReportingPolicyMode,
            )
          }
        >
          <option value="unset">
            Not set yet
          </option>

          <option value="specific_user">
            Choose one person
          </option>

          <option value="role">
            Choose automatically by role
          </option>

          <option value="top_level">
            No manager / top-level employee
          </option>
        </select>
      </label>

      {mode ===
        "specific_user" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            Manager / default approver
          </span>

          <select
            className={inputClass}
            value={
              value.userId ??
              ""
            }
            onChange={(event) =>
              onChange({
                version: 1,
                mode:
                  "specific_user",
                userId:
                  Number(
                    event.target
                      .value,
                  ) ||
                  undefined,
              })
            }
          >
            <option value="">
              Choose a person
            </option>

            {availableEmployees.map(
              (employee) => (
                <option
                  key={
                    employee.id
                  }
                  value={
                    employee.id
                  }
                >
                  {personLabel(
                    employee,
                  )}
                </option>
              ),
            )}
          </select>

          {availableEmployees.length ===
            0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              No other active employees are currently available.
            </div>
          )}
        </label>
      )}

      {mode === "role" && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Role
            </span>

            <select
              className={inputClass}
              value={
                value.roleId ??
                ""
              }
              onChange={(event) =>
                onChange({
                  ...value,
                  version: 1,
                  mode:
                    "role",
                  roleId:
                    Number(
                      event.target
                        .value,
                    ) ||
                    undefined,
                  scope:
                    value.scope ??
                    "same_department",
                })
              }
            >
              <option value="">
                Choose a role
              </option>

              {roles.map(
                (role) => (
                  <option
                    key={
                      role.id
                    }
                    value={
                      role.id
                    }
                  >
                    {roleLabel(
                      role,
                    )}
                  </option>
                ),
              )}
            </select>

            <div className="mt-1 text-[11px] text-muted-foreground">
              BRIXTA will choose an active person who has this role.
            </div>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Where should BRIXTA look?
            </span>

            <select
              className={inputClass}
              value={
                value.scope ??
                "same_department"
              }
              onChange={(event) =>
                onChange({
                  ...value,
                  version: 1,
                  mode:
                    "role",
                  scope:
                    event.target
                      .value as ReportingScope,
                })
              }
            >
              {SCOPES.map(
                (scope) => (
                  <option
                    key={
                      scope.value
                    }
                    value={
                      scope.value
                    }
                  >
                    {scope.label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
      )}

      {mode ===
        "top_level" && (
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          This employee has no default manager. Use this for owners, directors, or other top-level people who should not report to someone else.
        </div>
      )}

      {snapshot && (
        <div className="rounded-md border bg-muted/10 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              Who will be chosen?
            </span>

            <Pill
              tone={statusTone(
                snapshot
                  .resolution
                  .status,
              )}
            >
              {statusLabel(
                snapshot,
              )}
            </Pill>
          </div>

          {snapshot.manager && (
            <div className="mt-2">
              <div className="font-medium">
                {snapshot.manager.name ??
                  snapshot.manager.employeeCode}
              </div>

              <div className="text-xs text-muted-foreground">
                {[
                  snapshot.manager
                    .designation,
                  snapshot.manager
                    .department,
                  snapshot.manager
                    .area,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          )}

          {snapshot.resolution
            .reason && (
            <div className="mt-2 text-xs text-muted-foreground">
              {snapshot.resolution.reason}
            </div>
          )}

          {(snapshot.candidates
            ?.length ?? 0) >
            1 && (
            <div className="mt-3 space-y-1">
              <div className="text-xs font-medium">
                People matching this rule
              </div>

              {snapshot.candidates?.map(
                (candidate) => (
                  <div
                    key={
                      candidate.id
                    }
                    className="text-xs text-muted-foreground"
                  >
                    {candidate.name ??
                      candidate.employeeCode}
                    {" · "}
                    {candidate.designation ??
                      "No designation"}
                  </div>
                ),
              )}
            </div>
          )}

          {(snapshot.path
            ?.length ?? 0) >
            1 && (
            <div className="mt-3">
              <div className="text-xs font-medium">
                Reporting path
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                {snapshot.path
                  ?.map(
                    (person) =>
                      person.name ??
                      person.employeeCode ??
                      `Employee ${person.id}`,
                  )
                  .join(" → ")}
              </div>
            </div>
          )}
        </div>
      )}

      {onPreview &&
        mode !== "unset" && (
        <SecondaryButton
          type="button"
          onClick={
            onPreview
          }
        >
          Check who this selects
        </SecondaryButton>
      )}
    </div>
  );
}
