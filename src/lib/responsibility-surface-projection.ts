// BRIXTA_SHARED_INTERFACE_IR_V1
//
// One binding vocabulary for dashboard/table/export presentation.
//
// INPUT collection and OUTPUT presentation are deliberately separate:
// captures collect values; surface bindings present capture/computed/context/
// state/record/actor/query/literal values.

import type {
  GenericRecord,
  Responsibility,
  ResponsibilityField,
  ResponsibilitySurfaceDefinition,
} from "@/lib/appliance-types";

export type ResponsibilitySurfaceBinding = {
  scope:
    | "capture"
    | "computed"
    | "context"
    | "state"
    | "record"
    | "actor"
    | "query"
    | "literal";
  key?: string;
  path?: string;
  value?: unknown;
};

export type ResponsibilitySurfaceValueFormat = {
  kind?:
    | "text"
    | "number"
    | "currency"
    | "percent"
    | "date"
    | "datetime"
    | "boolean";
  currency?: string;
  timezone?: string;
  decimals?: number;
};

export type ResponsibilitySurfaceColumn = {
  key: string;
  label: string;
  binding: ResponsibilitySurfaceBinding;
  format?: ResponsibilitySurfaceValueFormat;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getPath(value: unknown, path?: string) {
  if (!path) return value;

  let current = value;

  for (const part of path.split(".").filter(Boolean)) {
    if (
      !current ||
      typeof current !== "object"
    ) {
      return undefined;
    }

    current =
      (current as Record<string, unknown>)[part];
  }

  return current;
}

export function humanizeSurfaceKey(value: string) {
  return value
    .replace(/^__+/, "")
    .replace(/[_-]+/g, " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function fieldMap(
  responsibility: Responsibility,
) {
  return new Map(
    (
      responsibility.definition.input.fields ??
      []
    ).map(
      (field) => [
        field.key,
        field,
      ],
    ),
  );
}

function inferredBinding(
  key: string,
  field?: ResponsibilityField,
): ResponsibilitySurfaceBinding {
  return field
    ? {
        scope: "capture",
        key,
      }
    : {
        scope: "computed",
        key,
      };
}

function parseBinding(
  raw: unknown,
  fallbackKey: string,
  field?: ResponsibilityField,
): ResponsibilitySurfaceBinding {
  const value = objectValue(raw);

  const scope =
    typeof value.scope === "string"
      ? value.scope
      : "";

  if (
    scope === "capture" ||
    scope === "computed" ||
    scope === "context" ||
    scope === "state" ||
    scope === "record" ||
    scope === "actor" ||
    scope === "query" ||
    scope === "literal"
  ) {
    return {
      scope,
      key:
        typeof value.key === "string"
          ? value.key
          : undefined,
      path:
        typeof value.path === "string"
          ? value.path
          : undefined,
      value:
        scope === "literal"
          ? value.value
          : undefined,
    };
  }

  return inferredBinding(
    fallbackKey,
    field,
  );
}

function parseFormat(
  raw: unknown,
): ResponsibilitySurfaceValueFormat | undefined {
  const value = objectValue(raw);

  if (!Object.keys(value).length) {
    return undefined;
  }

  return {
    kind:
      typeof value.kind === "string"
        ? value.kind as ResponsibilitySurfaceValueFormat["kind"]
        : undefined,
    currency:
      typeof value.currency === "string"
        ? value.currency
        : undefined,
    timezone:
      typeof value.timezone === "string"
        ? value.timezone
        : undefined,
    decimals:
      Number.isInteger(Number(value.decimals))
        ? Number(value.decimals)
        : undefined,
  };
}

function authoredColumns(
  responsibility: Responsibility,
  surface?: ResponsibilitySurfaceDefinition,
) {
  const fields =
    fieldMap(responsibility);

  const config =
    objectValue(
      surface?.config,
    );

  const raw =
    Array.isArray(config.columns)
      ? config.columns
      : [];

  return raw.flatMap(
    (item, index) => {
      const column =
        objectValue(item);

      const key =
        typeof column.key === "string" &&
        column.key.trim()
          ? column.key.trim()
          : `column_${index + 1}`;

      const field =
        fields.get(key);

      const label =
        typeof column.label === "string" &&
        column.label.trim()
          ? column.label.trim()
          : field?.label ??
            humanizeSurfaceKey(key);

      return [
        {
          key,
          label,
          binding:
            parseBinding(
              column.binding,
              key,
              field,
            ),
          format:
            parseFormat(
              column.format,
            ),
        } satisfies ResponsibilitySurfaceColumn,
      ];
    },
  );
}

export function dashboardSurfacesFor(
  responsibility: Responsibility,
) {
  return (
    responsibility.definition.surfaces
      ?.dashboard ??
    []
  );
}

export function surfaceColumnsFor(
  responsibility: Responsibility,
  surface?: ResponsibilitySurfaceDefinition,
): ResponsibilitySurfaceColumn[] {
  const explicit =
    authoredColumns(
      responsibility,
      surface,
    );

  if (explicit.length) {
    return explicit;
  }

  const fields =
    responsibility.definition.input.fields ??
    [];

  const fieldsByKey =
    fieldMap(responsibility);

  const visibleKeys =
    surface?.visibleKeys?.length
      ? surface.visibleKeys
      : (
          Array.isArray(
            objectValue(
              responsibility.definition.output.config,
            ).visibleKeys,
          )
            ? (
                objectValue(
                  responsibility.definition.output.config,
                ).visibleKeys as unknown[]
              )
                .map(String)
                .filter(Boolean)
            : []
        );

  if (visibleKeys.length) {
    return [
      ...new Set(
        visibleKeys,
      ),
    ].map(
      (key) => {
        const field =
          fieldsByKey.get(key);

        return {
          key,
          label:
            field?.label ??
            humanizeSurfaceKey(key),
          binding:
            inferredBinding(
              key,
              field,
            ),
        };
      },
    );
  }

  return fields.map(
    (field) => ({
      key: field.key,
      label: field.label,
      binding: {
        scope: "capture",
        key: field.key,
      },
    }),
  );
}

export function dashboardColumnsFor(
  responsibility: Responsibility,
): ResponsibilitySurfaceColumn[] {
  const surfaces =
    dashboardSurfacesFor(
      responsibility,
    );

  if (!surfaces.length) {
    return surfaceColumnsFor(
      responsibility,
    );
  }

  const output:
    ResponsibilitySurfaceColumn[] = [];

  const seen =
    new Set<string>();

  for (const surface of surfaces) {
    for (
      const column
      of surfaceColumnsFor(
        responsibility,
        surface,
      )
    ) {
      const identity =
        JSON.stringify({
          key: column.key,
          binding:
            column.binding,
        });

      if (seen.has(identity)) {
        continue;
      }

      seen.add(identity);
      output.push(column);
    }
  }

  return output;
}

export function resolveSurfaceBinding(
  record: GenericRecord,
  binding: ResponsibilitySurfaceBinding,
): unknown {
  if (
    binding.scope === "literal"
  ) {
    return binding.value;
  }

  const payload =
    objectValue(
      record.payload,
    );

  const computed =
    objectValue(
      payload.__computed,
    );

  const context =
    objectValue(
      payload.__context,
    );

  const state =
    objectValue(
      payload.__state,
    );

  const actor =
    objectValue(
      payload.__actor,
    );

  const query =
    objectValue(
      payload.__query,
    );

  const key =
    binding.key;

  let root: unknown;

  if (
    binding.scope === "capture"
  ) {
    root =
      key
        ? payload[key]
        : payload;
  } else if (
    binding.scope === "computed"
  ) {
    root =
      key
        ? (
            computed[key] ??
            payload[key]
          )
        : computed;
  } else if (
    binding.scope === "context"
  ) {
    root =
      key
        ? context[key]
        : context;
  } else if (
    binding.scope === "state"
  ) {
    if (
      !key ||
      key === "process"
    ) {
      root =
        state.process ??
        record.status;
    } else {
      root =
        state[key];
    }
  } else if (
    binding.scope === "actor"
  ) {
    root =
      key
        ? (
            actor[key] ??
            context[key]
          )
        : (
            Object.keys(actor).length
              ? actor
              : context
          );
  } else if (
    binding.scope === "query"
  ) {
    root =
      key
        ? query[key]
        : query;
  } else {
    const recordObject =
      record as unknown as
        Record<string, unknown>;

    root =
      key
        ? (
            recordObject[key] ??
            payload[key]
          )
        : recordObject;
  }

  return getPath(
    root,
    binding.path,
  );
}

export function formatSurfaceValue(
  value: unknown,
  format?: ResponsibilitySurfaceValueFormat,
): unknown {
  if (
    value === null ||
    value === undefined ||
    !format?.kind
  ) {
    return value;
  }

  if (
    format.kind === "boolean"
  ) {
    return Boolean(value)
      ? "Yes"
      : "No";
  }

  if (
    format.kind === "currency"
  ) {
    const number =
      Number(value);

    if (
      !Number.isFinite(number)
    ) {
      return value;
    }

    return new Intl.NumberFormat(
      undefined,
      {
        style: "currency",
        currency:
          format.currency ??
          "INR",
        maximumFractionDigits:
          format.decimals ?? 2,
      },
    ).format(number);
  }

  if (
    format.kind === "number" ||
    format.kind === "percent"
  ) {
    const number =
      Number(value);

    if (
      !Number.isFinite(number)
    ) {
      return value;
    }

    return new Intl.NumberFormat(
      undefined,
      {
        style:
          format.kind ===
            "percent"
            ? "percent"
            : "decimal",
        maximumFractionDigits:
          format.decimals ?? 2,
      },
    ).format(
      format.kind ===
        "percent"
        ? number / 100
        : number,
    );
  }

  if (
    format.kind === "date" ||
    format.kind === "datetime"
  ) {
    const date =
      new Date(
        String(value),
      );

    if (
      !Number.isFinite(
        date.getTime(),
      )
    ) {
      return value;
    }

    return new Intl.DateTimeFormat(
      undefined,
      {
        timeZone:
          format.timezone,
        year: "numeric",
        month: "short",
        day: "2-digit",
        ...(
          format.kind ===
            "datetime"
            ? {
                hour: "2-digit",
                minute: "2-digit",
              }
            : {}
        ),
      },
    ).format(date);
  }

  return String(value);
}

export function resolveSurfaceColumnValue(
  record: GenericRecord,
  column: ResponsibilitySurfaceColumn,
) {
  return formatSurfaceValue(
    resolveSurfaceBinding(
      record,
      column.binding,
    ),
    column.format,
  );
}
