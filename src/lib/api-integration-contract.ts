export const API_INTEGRATION_AI_FORMAT =
  "brixta.api-integration" as const;

export const API_INTEGRATION_AI_FORMAT_VERSION =
  1 as const;


export type ApiIntegrationStatus =
  | "draft"
  | "published";


export type ApiIntegrationMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE";


export type ApiCredentialField = {
  key: string;
  label: string;

  /*
   * header:
   *   x-client-id: <secret>
   *
   * bearer:
   *   Authorization: Bearer <secret>
   */
  kind:
    | "header"
    | "bearer";

  headerName?: string;
  required?: boolean;
};


export type ApiIntegrationAuth = {
  type:
    | "none"
    | "headers"
    | "bearer";

  credentialFields:
    ApiCredentialField[];
};


export type ApiIntegrationOperation = {
  id: string;
  label: string;

  /*
   * Stable BRIXTA capability exposed to Pixel Logic.
   *
   * Example:
   * payout.request
   */
  capability: string;

  description?: string;

  method:
    ApiIntegrationMethod;

  /*
   * Relative to baseUrl.
   *
   * Examples:
   * /transfers
   * /transfers/{transferId}
   */
  path: string;

  staticHeaders?:
    Record<string, string>;

  requestExample?: unknown;
  responseExample?: unknown;
};


export type ApiIntegrationDefinition = {
  id: string;
  key: string;

  name: string;
  description?: string;

  baseUrl: string;

  /*
   * Human/API documentation supplied to AI.
   * Never place credentials in here.
   */
  documentation: string;

  auth:
    ApiIntegrationAuth;

  operations:
    ApiIntegrationOperation[];

  status:
    ApiIntegrationStatus;

  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
};


export type ApiIntegrationPublic =
  ApiIntegrationDefinition & {
    credentialStatus:
      Record<string, boolean>;
  };


export type ApiIntegrationTestRequest = {
  pathParams?:
    Record<string, string | number>;

  query?:
    Record<
      string,
      string | number | boolean
    >;

  body?: unknown;

  /*
   * Optional non-auth test headers.
   * Server-managed authentication is applied afterward
   * and cannot be overridden from the browser.
   */
  headers?:
    Record<string, string>;
};


function objectValue(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${path} must be a JSON object.`,
    );
  }

  return value as
    Record<string, unknown>;
}


function stringValue(
  value: unknown,
  path: string,
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `${path} must be a non-empty string.`,
    );
  }

  return value.trim();
}


function optionalString(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}


function parseMethod(
  value: unknown,
  path: string,
): ApiIntegrationMethod {
  const method =
    stringValue(
      value,
      path,
    ).toUpperCase();

  if (
    ![
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
    ].includes(
      method,
    )
  ) {
    throw new Error(
      `${path} must be GET, POST, PUT, PATCH or DELETE.`,
    );
  }

  return method as
    ApiIntegrationMethod;
}


export function integrationKey(
  value: string,
) {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "_",
    )
    .replace(
      /^_+|_+$/g,
      "",
    );
}


export function blankApiIntegration(
  id: string,
): ApiIntegrationDefinition {
  return {
    id,

    key:
      "",

    name:
      "",

    description:
      "",

    baseUrl:
      "",

    documentation:
      "",

    auth: {
      type:
        "none",

      credentialFields:
        [],
    },

    operations:
      [],

    status:
      "draft",
  };
}


export function validateApiIntegration(
  integration:
    ApiIntegrationDefinition,
) {
  const issues:
    string[] = [];


  if (
    !integration.id.trim()
  ) {
    issues.push(
      "Integration ID is required.",
    );
  }


  if (
    !integration.name.trim()
  ) {
    issues.push(
      "Integration name is required.",
    );
  }


  if (
    !integration.key.trim()
  ) {
    issues.push(
      "Integration key is required.",
    );
  }


  if (
    !/^[a-z][a-z0-9_]*$/.test(
      integration.key,
    )
  ) {
    issues.push(
      "Integration key must begin with a letter and contain only lowercase letters, numbers and underscores.",
    );
  }


  try {
    const url =
      new URL(
        integration.baseUrl,
      );

    if (
      ![
        "https:",
        "http:",
      ].includes(
        url.protocol,
      )
    ) {
      issues.push(
        "Base URL must use HTTP or HTTPS.",
      );
    }
  } catch {
    issues.push(
      "Base URL must be a valid absolute URL.",
    );
  }


  if (
    integration.operations.length ===
    0
  ) {
    issues.push(
      "At least one API operation is required.",
    );
  }


  const operationIds =
    new Set<string>();

  const capabilities =
    new Set<string>();


  for (
    const operation of
    integration.operations
  ) {
    if (
      operationIds.has(
        operation.id,
      )
    ) {
      issues.push(
        `Duplicate operation ID: ${operation.id}`,
      );
    }

    operationIds.add(
      operation.id,
    );


    if (
      capabilities.has(
        operation.capability,
      )
    ) {
      issues.push(
        `Duplicate capability binding: ${operation.capability}`,
      );
    }

    capabilities.add(
      operation.capability,
    );


    if (
      !operation.path.startsWith(
        "/",
      )
    ) {
      issues.push(
        `Operation ${operation.id} path must begin with '/'.`,
      );
    }


    if (
      !/^[a-z][a-zA-Z0-9_.-]*$/.test(
        operation.capability,
      )
    ) {
      issues.push(
        `Invalid BRIXTA capability: ${operation.capability}`,
      );
    }
  }


  const credentialKeys =
    new Set<string>();

  for (
    const field of
    integration.auth
      .credentialFields
  ) {
    if (
      credentialKeys.has(
        field.key,
      )
    ) {
      issues.push(
        `Duplicate credential key: ${field.key}`,
      );
    }

    credentialKeys.add(
      field.key,
    );


    if (
      field.kind ===
        "header" &&
      !field.headerName
        ?.trim()
    ) {
      issues.push(
        `Credential ${field.key} requires headerName.`,
      );
    }
  }


  return issues;
}


export function parseApiIntegrationAIImport(
  text: string,
): ApiIntegrationDefinition {
  let source =
    text.trim();

  const fenced =
    source.match(
      /^```(?:json)?\s*([\s\S]*?)\s*```$/i,
    );

  if (fenced) {
    source =
      fenced[1].trim();
  }


  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        source,
      );
  } catch (
    error
  ) {
    throw new Error(
      error instanceof Error
        ? `Invalid JSON: ${error.message}`
        : "Invalid JSON.",
    );
  }


  const root =
    objectValue(
      parsed,
      "root",
    );


  if (
    root.format !==
    API_INTEGRATION_AI_FORMAT
  ) {
    throw new Error(
      `format must be "${API_INTEGRATION_AI_FORMAT}".`,
    );
  }


  if (
    Number(
      root.formatVersion,
    ) !==
    API_INTEGRATION_AI_FORMAT_VERSION
  ) {
    throw new Error(
      `formatVersion must be ${API_INTEGRATION_AI_FORMAT_VERSION}.`,
    );
  }


  const raw =
    objectValue(
      root.integration,
      "integration",
    );


  const authRaw =
    objectValue(
      raw.auth ?? {
        type:
          "none",

        credentialFields:
          [],
      },
      "integration.auth",
    );


  const authType =
    optionalString(
      authRaw.type,
    ) ||
    "none";


  if (
    ![
      "none",
      "headers",
      "bearer",
    ].includes(
      authType,
    )
  ) {
    throw new Error(
      "integration.auth.type must be none, headers or bearer.",
    );
  }


  const credentialFieldsRaw =
    Array.isArray(
      authRaw
        .credentialFields,
    )
      ? authRaw
          .credentialFields
      : [];


  const credentialFields:
    ApiCredentialField[] =
    credentialFieldsRaw.map(
      (
        item,
        index,
      ) => {
        const field =
          objectValue(
            item,
            `integration.auth.credentialFields[${index}]`,
          );

        /*
         * AI must describe secret SLOTS,
         * not secret VALUES.
         */
        if (
          "value" in
          field
        ) {
          throw new Error(
            `integration.auth.credentialFields[${index}] must not contain a credential value.`,
          );
        }

        const kind =
          optionalString(
            field.kind,
          ) ||
          "header";

        if (
          kind !==
            "header" &&
          kind !==
            "bearer"
        ) {
          throw new Error(
            `Invalid credential kind at index ${index}.`,
          );
        }

        return {
          key:
            stringValue(
              field.key,
              `integration.auth.credentialFields[${index}].key`,
            ),

          label:
            stringValue(
              field.label,
              `integration.auth.credentialFields[${index}].label`,
            ),

          kind,

          headerName:
            optionalString(
              field.headerName,
            ) ||
            undefined,

          required:
            field.required !==
            false,
        };
      },
    );


  const operationsRaw =
    Array.isArray(
      raw.operations,
    )
      ? raw.operations
      : [];


  const operations:
    ApiIntegrationOperation[] =
    operationsRaw.map(
      (
        item,
        index,
      ) => {
        const operation =
          objectValue(
            item,
            `integration.operations[${index}]`,
          );

        const staticHeaders =
          operation
            .staticHeaders &&
          typeof operation
            .staticHeaders ===
            "object" &&
          !Array.isArray(
            operation
              .staticHeaders,
          )
            ? Object.fromEntries(
                Object.entries(
                  operation
                    .staticHeaders as
                    Record<
                      string,
                      unknown
                    >,
                ).map(
                  (
                    [
                      key,
                      value,
                    ],
                  ) => [
                    key,
                    String(
                      value,
                    ),
                  ],
                ),
              )
            : undefined;

        return {
          id:
            stringValue(
              operation.id,
              `integration.operations[${index}].id`,
            ),

          label:
            stringValue(
              operation.label,
              `integration.operations[${index}].label`,
            ),

          capability:
            stringValue(
              operation.capability,
              `integration.operations[${index}].capability`,
            ),

          description:
            optionalString(
              operation.description,
            ) ||
            undefined,

          method:
            parseMethod(
              operation.method,
              `integration.operations[${index}].method`,
            ),

          path:
            stringValue(
              operation.path,
              `integration.operations[${index}].path`,
            ),

          staticHeaders,

          requestExample:
            operation
              .requestExample,

          responseExample:
            operation
              .responseExample,
        };
      },
    );


  const result:
    ApiIntegrationDefinition = {
    id:
      optionalString(
        raw.id,
      ) ||
      "ai-draft",

    key:
      integrationKey(
        stringValue(
          raw.key,
          "integration.key",
        ),
      ),

    name:
      stringValue(
        raw.name,
        "integration.name",
      ),

    description:
      optionalString(
        raw.description,
      ),

    baseUrl:
      stringValue(
        raw.baseUrl,
        "integration.baseUrl",
      ),

    documentation:
      optionalString(
        raw.documentation,
      ),

    auth: {
      type:
        authType as
        ApiIntegrationAuth[
          "type"
        ],

      credentialFields,
    },

    operations,

    status:
      "draft",
  };


  const issues =
    validateApiIntegration(
      result,
    );

  if (
    issues.length
  ) {
    throw new Error(
      issues.join(
        "\n",
      ),
    );
  }


  return result;
}


export function buildApiIntegrationAIContext(
  integration:
    ApiIntegrationDefinition,
) {
  return {
    contract:
      "BRIXTA API INTEGRATION AI CONTRACT V1",

    output: {
      format:
        API_INTEGRATION_AI_FORMAT,

      formatVersion:
        API_INTEGRATION_AI_FORMAT_VERSION,

      rule:
        "Return exactly one JSON object and no prose.",
    },

    currentIntegration:
      integration,

    objective:
      [
        "Read the supplied API documentation/cURL/OpenAPI/sample request and response material.",
        "Produce a reusable server-side REST integration definition.",
        "Map provider-specific operations onto stable BRIXTA capability names.",
        "Describe credential SLOTS only. Never include actual credential values.",
      ],

    capabilityExamples: [
      "payout.request",
      "payout.getStatus",
      "upi.validate",
      "messaging.send",
      "crm.createLead",
      "maps.distance",
    ],

    securityRules: [
      "NEVER return API keys, client secrets, passwords, bearer tokens or signing secrets.",
      "Credentials are entered separately into BRIXTA after AI import.",
      "Do not put secrets in staticHeaders.",
      "Do not make the client/browser authoritative for financial amounts.",
      "For payout APIs, prefer stable capability names such as payout.request and payout.getStatus.",
      "Keep provider-specific URLs and headers inside the Integration definition, not Pixel Logic.",
    ],

    expectedShape: {
      format:
        API_INTEGRATION_AI_FORMAT,

      formatVersion:
        API_INTEGRATION_AI_FORMAT_VERSION,

      integration: {
        key:
          "cashfree_payouts",

        name:
          "Cashfree Payouts",

        description:
          "Cashfree payout provider.",

        baseUrl:
          "https://sandbox.example.com",

        documentation:
          "Optional concise notes.",

        auth: {
          type:
            "headers",

          credentialFields: [
            {
              key:
                "client_id",

              label:
                "Client ID",

              kind:
                "header",

              headerName:
                "x-client-id",

              required:
                true,
            },

            {
              key:
                "client_secret",

              label:
                "Client Secret",

              kind:
                "header",

              headerName:
                "x-client-secret",

              required:
                true,
            },
          ],
        },

        operations: [
          {
            id:
              "create_transfer",

            label:
              "Create transfer",

            capability:
              "payout.request",

            method:
              "POST",

            path:
              "/transfers",

            staticHeaders: {
              "content-type":
                "application/json",
            },

            requestExample: {},

            responseExample: {},
          },
        ],
      },
    },
  };
}
