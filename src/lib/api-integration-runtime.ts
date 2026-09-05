import "server-only";

import {
  randomUUID,
} from "node:crypto";

import {
  lookup,
} from "node:dns/promises";

import {
  isIP,
} from "node:net";

import type {
  AppDatabase,
} from "@/lib/drizzle";

import type {
  ApiIntegrationOperation,
  ApiIntegrationTestRequest,
} from "@/lib/api-integration-contract";

import {
  getStoredApiIntegration,
  integrationCredentials,
} from "@/lib/api-integration-store";


function objectValue(
  value: unknown,
): Record<string, unknown> {
  return (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
  )
    ? value as
        Record<string, unknown>
    : {};
}


function readPath(
  value: unknown,
  path: string,
) {
  let current =
    value;

  for (
    const part of
    path
      .split(".")
      .filter(Boolean)
  ) {
    if (
      !current ||
      typeof current !==
        "object"
    ) {
      return undefined;
    }

    current =
      (
        current as
          Record<string, unknown>
      )[part];
  }

  return current;
}


function templateExpression(
  expression: string,
  input: unknown,
  idempotencyKey: string,
) {
  const clean =
    expression.trim();

  if (
    clean ===
    "idempotencyKey"
  ) {
    return idempotencyKey;
  }

  if (
    clean ===
    "input"
  ) {
    return input;
  }

  if (
    clean.startsWith(
      "input.",
    )
  ) {
    return readPath(
      input,
      clean.slice(
        "input.".length,
      ),
    );
  }

  return (
    readPath(
      input,
      clean,
    ) ??
    readPath(
      input,
      `pathParams.${clean}`,
    )
  );
}


function renderTemplate(
  value: unknown,
  input: unknown,
  idempotencyKey: string,
): unknown {
  if (
    typeof value ===
    "string"
  ) {
    const exact =
      value.match(
        /^\{\{\s*([^}]+)\s*\}\}$/,
      );

    if (
      exact
    ) {
      return templateExpression(
        exact[1],
        input,
        idempotencyKey,
      );
    }

    return value.replace(
      /\{\{\s*([^}]+)\s*\}\}/g,
      (
        _match,
        expression,
      ) => {
        const result =
          templateExpression(
            String(
              expression,
            ),
            input,
            idempotencyKey,
          );

        return result ===
          undefined ||
          result ===
          null
          ? ""
          : String(
              result,
            );
      },
    );
  }

  if (
    Array.isArray(value)
  ) {
    return value.map(
      (item) =>
        renderTemplate(
          item,
          input,
          idempotencyKey,
        ),
    );
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    return Object.fromEntries(
      Object.entries(
        value as
          Record<string, unknown>,
      ).map(
        (
          [
            key,
            child,
          ],
        ) => [
          key,
          renderTemplate(
            child,
            input,
            idempotencyKey,
          ),
        ],
      ),
    );
  }

  return value;
}


function isPrivateIp(
  address: string,
) {
  const version =
    isIP(
      address,
    );

  if (
    version ===
    4
  ) {
    const [
      a,
      b,
    ] =
      address
        .split(".")
        .map(Number);

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (
        a === 100 &&
        b >= 64 &&
        b <= 127
      ) ||
      (
        a === 169 &&
        b === 254
      ) ||
      (
        a === 172 &&
        b >= 16 &&
        b <= 31
      ) ||
      (
        a === 192 &&
        b === 168
      ) ||
      a >= 224
    );
  }

  if (
    version ===
    6
  ) {
    const lower =
      address.toLowerCase();

    return (
      lower ===
        "::1" ||
      lower.startsWith(
        "fc",
      ) ||
      lower.startsWith(
        "fd",
      ) ||
      lower.startsWith(
        "fe80:",
      )
    );
  }

  return false;
}


async function safeBaseUrl(
  value: string,
) {
  const url =
    new URL(
      value,
    );

  if (
    ![
      "https:",
      "http:",
    ].includes(
      url.protocol,
    )
  ) {
    throw new Error(
      "Integration URL must use HTTP or HTTPS.",
    );
  }

  if (
    process.env.NODE_ENV ===
      "production" &&
    url.protocol !==
      "https:"
  ) {
    throw new Error(
      "Production integrations must use HTTPS.",
    );
  }

  if (
    url.username ||
    url.password
  ) {
    throw new Error(
      "Embedded URL credentials are forbidden.",
    );
  }

  const hostname =
    url.hostname
      .replace(
        /^\[|\]$/g,
        "",
      )
      .toLowerCase();

  if (
    hostname ===
      "localhost" ||
    hostname.endsWith(
      ".local",
    )
  ) {
    if (
      process.env.NODE_ENV ===
      "production"
    ) {
      throw new Error(
        "Private/internal integration target blocked.",
      );
    }

    return url;
  }

  const addresses =
    isIP(
      hostname,
    )
      ? [
          {
            address:
              hostname,
          },
        ]
      : await lookup(
          hostname,
          {
            all:
              true,
          },
        );

  if (
    process.env.NODE_ENV ===
      "production" &&
    addresses.some(
      (item) =>
        isPrivateIp(
          item.address,
        ),
    )
  ) {
    throw new Error(
      "Integration host resolves to a private/internal address.",
    );
  }

  return url;
}


function operationPath(
  operation:
    ApiIntegrationOperation,
  input: unknown,
  idempotencyKey: string,
) {
  if (
    !operation.path.startsWith(
      "/",
    ) ||
    operation.path.startsWith(
      "//",
    ) ||
    operation.path.includes(
      "://",
    )
  ) {
    throw new Error(
      "Integration operation path must be relative.",
    );
  }

  return operation.path
    .replace(
      /\{\{\s*([^}]+)\s*\}\}/g,
      (
        _match,
        expression,
      ) => {
        const value =
          templateExpression(
            String(
              expression,
            ),
            input,
            idempotencyKey,
          );

        if (
          value ===
          undefined ||
          value ===
          null
        ) {
          throw new Error(
            `Missing path value: ${String(expression)}`,
          );
        }

        return encodeURIComponent(
          String(
            value,
          ),
        );
      },
    )
    .replace(
      /\{([a-zA-Z0-9_.-]+)\}/g,
      (
        _match,
        expression,
      ) => {
        const value =
          templateExpression(
            String(
              expression,
            ),
            input,
            idempotencyKey,
          );

        if (
          value ===
          undefined ||
          value ===
          null
        ) {
          throw new Error(
            `Missing path parameter: ${String(expression)}`,
          );
        }

        return encodeURIComponent(
          String(
            value,
          ),
        );
      },
    );
}


export async function executeApiIntegrationOperation(
  db: AppDatabase,
  integrationId: string,
  operationId: string,
  request:
    ApiIntegrationTestRequest,
) {
  const integration =
    await getStoredApiIntegration(
      db,
      integrationId,
    );

  if (
    !integration
  ) {
    throw new Error(
      "Integration not found.",
    );
  }

  const operation =
    integration.operations
      .find(
        (item) =>
          item.id ===
          operationId,
      );

  if (
    !operation
  ) {
    throw new Error(
      "Integration operation not found.",
    );
  }

  const credentials =
    integrationCredentials(
      integration,
    );

  for (
    const field of
    integration.auth
      .credentialFields
  ) {
    if (
      field.required !==
        false &&
      !credentials[
        field.key
      ]
    ) {
      throw new Error(
        `Credential "${field.label}" is not configured.`,
      );
    }
  }

  const bodyRecord =
    objectValue(
      request.body,
    );

  const providerInput = {
    ...bodyRecord,

    body:
      request.body,

    pathParams:
      request.pathParams ??
      {},

    query:
      request.query ??
      {},
  };

  const idempotencyKey =
    request.idempotencyKey
      ?.trim() ||
    `integration-test-${randomUUID()}`;

  const base =
    await safeBaseUrl(
      integration.baseUrl,
    );

  const path =
    operationPath(
      operation,
      providerInput,
      idempotencyKey,
    );

  const url =
    new URL(
      path.replace(
        /^\/+/,
        "",
      ),
      `${base
        .toString()
        .replace(
          /\/+$/,
          "",
        )}/`,
    );

  const renderedQuery =
    operation.queryTemplate
      ? objectValue(
          renderTemplate(
            operation.queryTemplate,
            providerInput,
            idempotencyKey,
          ),
        )
      : {};

  for (
    const [
      key,
      value,
    ] of Object.entries({
      ...renderedQuery,
      ...(
        request.query ??
        {}
      ),
    })
  ) {
    if (
      value !==
        undefined &&
      value !==
        null
    ) {
      url.searchParams.set(
        key,
        String(
          value,
        ),
      );
    }
  }

  const headers =
    new Headers();

  for (
    const [
      key,
      value,
    ] of Object.entries(
      operation.staticHeaders ??
      {},
    )
  ) {
    headers.set(
      key,
      value,
    );
  }

  for (
    const [
      key,
      value,
    ] of Object.entries(
      request.headers ??
      {},
    )
  ) {
    headers.set(
      key,
      value,
    );
  }

  if (
    operation.idempotencyHeader
  ) {
    headers.set(
      operation.idempotencyHeader,
      idempotencyKey,
    );
  }

  /*
   * Authentication always wins over test/browser headers.
   */
  for (
    const field of
    integration.auth
      .credentialFields
  ) {
    const value =
      credentials[
        field.key
      ];

    if (
      !value
    ) {
      continue;
    }

    if (
      field.kind ===
      "bearer"
    ) {
      headers.set(
        "authorization",
        `Bearer ${value}`,
      );
    } else if (
      field.headerName
    ) {
      headers.set(
        field.headerName,
        value,
      );
    }
  }

  const providerBody =
    operation.requestTemplate !==
      undefined
      ? renderTemplate(
          operation.requestTemplate,
          providerInput,
          idempotencyKey,
        )
      : request.body;

  let body:
    string | undefined;

  if (
    ![
      "GET",
      "DELETE",
    ].includes(
      operation.method,
    ) &&
    providerBody !==
      undefined
  ) {
    body =
      typeof providerBody ===
        "string"
        ? providerBody
        : JSON.stringify(
            providerBody,
          );

    if (
      !headers.has(
        "content-type",
      )
    ) {
      headers.set(
        "content-type",
        "application/json",
      );
    }
  }

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      20_000,
    );

  try {
    const response =
      await fetch(
        url,
        {
          method:
            operation.method,

          headers,

          body,

          signal:
            controller.signal,

          redirect:
            "manual",
        },
      );

    const raw =
      (
        await response.text()
      ).slice(
        0,
        100_000,
      );

    let data:
      unknown =
      raw;

    try {
      data =
        raw
          ? JSON.parse(
              raw,
            )
          : null;
    } catch {
      // Keep provider text.
    }

    const mapped =
      Object.fromEntries(
        Object.entries(
          operation.responseMapping ??
          {},
        ).map(
          (
            [
              key,
              path,
            ],
          ) => [
            key,
            readPath(
              data,
              path,
            ),
          ],
        ),
      );

    return {
      integrationId:
        integration.id,

      integrationName:
        integration.name,

      operationId:
        operation.id,

      capability:
        operation.capability,

      method:
        operation.method,

      url:
        url.toString(),

      status:
        response.status,

      ok:
        response.ok,

      data,

      mapped,
    };
  } finally {
    clearTimeout(
      timer,
    );
  }
}
