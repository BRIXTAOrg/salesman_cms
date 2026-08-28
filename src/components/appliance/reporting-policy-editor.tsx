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
      "Same department",
  },
  {
    value:
      "same_area",
    label:
      "Same area",
  },
  {
    value:
      "same_zone",
    label:
      "Same zone",
  },
  {
    value:
      "same_department_area",
    label:
      "Same department + area",
  },
  {
    value:
      "same_department_zone",
    label:
      "Same department + zone",
  },
  {
    value:
      "organization",
    label:
      "Entire organization",
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
      return "Resolved";
    case "top_level":
      return "Top level";
    case "ambiguous":
      return "Ambiguous";
    case "no_match":
      return "No match";
    case "invalid":
      return "Invalid";
    default:
      return "Unconfigured";
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
          Direct manager resolution
        </div>

        <div className="mt-1 text-xs text-muted-foreground">
          BRIXTA uses this relationship for manager_of(...) inside Responsibilities such as Leave approvals.
        </div>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Resolution method
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
            Not configured
          </option>

          <option value="specific_user">
            Specific employee
          </option>

          <option value="role">
            By Role + scope
          </option>

          <option value="top_level">
            Top level / no manager
          </option>
        </select>
      </label>

      {mode ===
        "specific_user" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            Direct manager
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
              Choose employee
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
              Manager Role
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
                Choose Role
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
              This uses the stable Authority Role assignment, not a free-text designation.
            </div>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Resolve within
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
          This employee is intentionally at the top of this reporting branch. A missing manager will not be treated as incomplete configuration.
        </div>
      )}

      {snapshot && (
        <div className="rounded-md border bg-muted/10 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              Current resolution
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
                Matching employees
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
                Organization path
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
          Preview resolution
        </SecondaryButton>
      )}
    </div>
  );
}
