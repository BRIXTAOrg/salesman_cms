import "server-only";

import {
  isIP,
} from "node:net";

import type {
  AppDatabase,
} from "@/lib/drizzle";

import type {
  ApiIntegrationTestRequest,
} from "@/lib/api-integration-contract";

import {
  getStoredApiIntegration,
  integrationCredentials,
} from "@/lib/api-integration-store";


function isPrivateIp(
  host: string,
) {
  const version =
    isIP(
      host,
    );

  if (
    version === 4
  ) {
    const parts =
      host.split(
        ".",
      )
        .map(
          Number,
        );

    const [
      a,
      b,
    ] =
      parts;

    return (
      a === 10 ||
      a === 127 ||
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
      )
    );
  }


  if (
    version === 6
  ) {
    const lower =
      host.toLowerCase();

    return (
      lower === "::1" ||
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


function safeBaseUrl(
  value: string,
) {
  const url =
    new URL(
      value,
    );


  const production =
    process.env
      .NODE_ENV ===
    "production";


  if (
    production &&
    url.protocol !==
      "https:"
  ) {
    throw new Error(
      "Production integrations must use HTTPS.",
    );
  }


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


  const host =
    url.hostname
      .toLowerCase();


  if (
    production &&
    (
      host ===
        "localhost" ||
      host.endsWith(
        ".local",
      ) ||
      isPrivateIp(
        host,
      )
    )
  ) {
    throw new Error(
      "Private/internal network integration targets are blocked in production.",
    );
  }


  return url;
}


function operationUrl(
  baseUrl: string,
  path: string,
  request:
    ApiIntegrationTestRequest,
) {
  let resolvedPath =
    path;


  for (
    const [
      key,
      value,
    ] of Object.entries(
      request.pathParams ??
      {},
    )
  ) {
    resolvedPath =
      resolvedPath.replaceAll(
        `{${key}}`,
        encodeURIComponent(
          String(
            value,
          ),
        ),
      );
  }


  if (
    /\{[^}]+\}/.test(
      resolvedPath,
    )
  ) {
    throw new Error(
      `Missing path parameter for ${resolvedPath}.`,
    );
  }


  const base =
    safeBaseUrl(
      baseUrl,
    );


  const url =
    new URL(
      resolvedPath.replace(
        /^\/+/,
        "",
      ),
      `${
        base
          .toString()
          .replace(
            /\/+$/,
            "",
          )
      }/`,
    );


  for (
    const [
      key,
      value,
    ] of Object.entries(
      request.query ??
      {},
    )
  ) {
    url.searchParams.set(
      key,
      String(
        value,
      ),
    );
  }


  return url;
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
        (
          item,
        ) =>
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


  const headers =
    new Headers();


  for (
    const [
      key,
      value,
    ] of Object.entries(
      operation
        .staticHeaders ??
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


  /*
   * Authentication is intentionally applied LAST.
   * Browser/test input cannot override server-owned credentials.
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
    } else {
      headers.set(
        field.headerName!,
        value,
      );
    }
  }


  const method =
    operation.method;


  const canHaveBody =
    ![
      "GET",
      "DELETE",
    ].includes(
      method,
    );


  let body:
    string | undefined;


  if (
    canHaveBody &&
    request.body !==
      undefined
  ) {
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

    body =
      typeof request.body ===
        "string"
        ? request.body
        : JSON.stringify(
            request.body,
          );
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
        operationUrl(
          integration.baseUrl,
          operation.path,
          request,
        ),
        {
          method,
          headers,
          body,
          signal:
            controller.signal,

          /*
           * Prevent a configured public URL from redirecting
           * the server into an unintended network target.
           */
          redirect:
            "manual",
        },
      );


    const text =
      (
        await response.text()
      ).slice(
        0,
        100_000,
      );


    let data:
      unknown =
      text;

    try {
      data =
        text
          ? JSON.parse(
              text,
            )
          : null;
    } catch {
      // Keep text response.
    }


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

      status:
        response.status,

      ok:
        response.ok,

      data,
    };
  } finally {
    clearTimeout(
      timer,
    );
  }
}
