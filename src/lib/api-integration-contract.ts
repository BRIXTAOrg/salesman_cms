export const API_INTEGRATION_AI_FORMAT =
  "brixta.api-integration" as const;

export const API_INTEGRATION_AI_FORMAT_VERSION =
  2 as const;


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
   * Stable BRIXTA capability.
   *
   * Provider URLs/auth must never leak into Pixel.
   */
  capability: string;

  description?: string;

  method:
    ApiIntegrationMethod;

  path: string;

  staticHeaders?:
    Record<string, string>;

  /*
   * PROVIDER TRANSLATION CONTRACT V2
   *
   * Template expressions:
   *
   * {{input.foo}}
   * {{input.nested.foo}}
   * {{idempotencyKey}}
   */
  requestTemplate?: unknown;

  queryTemplate?:
    Record<string, unknown>;

  responseMapping?:
    Record<string, string>;

  idempotencyHeader?: string;

  requestExample?: unknown;
  responseExample?: unknown;
};


export type ApiWebhookSignature = {
  kind:
    | "hmac_sha256_base64"
    | "hmac_sha256_hex";

  credentialKey: string;

  signatureHeader: string;

  timestampHeader?: string;

  signedPayload:
    | "body"
    | "timestamp_body"
    | "timestamp_dot_body";

  toleranceSeconds?: number;
};


export type ApiWebhookEvent = {
  eventIdPath?: string;

  /*
   * Provider transfer/reference path.
   */
  referencePath: string;

  referenceTarget?:
    | "provider_transfer_ref"
    | "request_id";

  /*
   * Primary status path.
   */
  statusPath: string;

  /*
   * Some providers split terminal state between a detailed
   * status code and an event type.
   */
  fallbackStatusPath?: string;

  statusMap:
    Record<
      string,
      | "processing"
      | "paid"
      | "failed"
      | "reversed"
    >;
};


export type ApiIntegrationWebhook = {
  enabled: boolean;

  signature:
    ApiWebhookSignature;

  event:
    ApiWebhookEvent;
};


export type ApiIntegrationDefinition = {
  id: string;
  key: string;

  name: string;
  description?: string;

  baseUrl: string;

  documentation: string;

  auth:
    ApiIntegrationAuth;

  operations:
    ApiIntegrationOperation[];

  webhook?:
    ApiIntegrationWebhook;

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

  headers?:
    Record<string, string>;

  idempotencyKey?: string;
};


function objectValue(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${path} must be a JSON object.`,
    );
  }

  return value as
    Record<string, unknown>;
}


function optionalObject(
  value: unknown,
) {
  return (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
  )
    ? value as
        Record<string, unknown>
    : undefined;
}


function stringValue(
  value: unknown,
  path: string,
) {
  if (
    typeof value !==
      "string" ||
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
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}


function stringRecord(
  value: unknown,
) {
  const record =
    optionalObject(
      value,
    );

  if (
    !record
  ) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(
      record,
    ).map(
      (
        [
          key,
          child,
        ],
      ) => [
        key,
        String(
          child,
        ),
      ],
    ),
  );
}


function unknownRecord(
  value: unknown,
) {
  const record =
    optionalObject(
      value,
    );

  return record
    ? {
        ...record,
      }
    : undefined;
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


function parseOperation(
  item: unknown,
  index: number,
): ApiIntegrationOperation {
  const operation =
    objectValue(
      item,
      `integration.operations[${index}]`,
    );

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

    staticHeaders:
      stringRecord(
        operation.staticHeaders,
      ),

    requestTemplate:
      operation.requestTemplate,

    queryTemplate:
      unknownRecord(
        operation.queryTemplate,
      ),

    responseMapping:
      stringRecord(
        operation.responseMapping,
      ),

    idempotencyHeader:
      optionalString(
        operation.idempotencyHeader,
      ) ||
      undefined,

    requestExample:
      operation.requestExample,

    responseExample:
      operation.responseExample,
  };
}


function parseWebhook(
  raw: unknown,
): ApiIntegrationWebhook | undefined {
  if (
    raw ===
    undefined ||
    raw ===
    null
  ) {
    return undefined;
  }

  const webhook =
    objectValue(
      raw,
      "integration.webhook",
    );

  const signature =
    objectValue(
      webhook.signature,
      "integration.webhook.signature",
    );

  const event =
    objectValue(
      webhook.event,
      "integration.webhook.event",
    );

  const kind =
    stringValue(
      signature.kind,
      "integration.webhook.signature.kind",
    ) as
      ApiWebhookSignature[
        "kind"
      ];

  const signedPayload =
    stringValue(
      signature.signedPayload,
      "integration.webhook.signature.signedPayload",
    ) as
      ApiWebhookSignature[
        "signedPayload"
      ];

  return {
    enabled:
      webhook.enabled ===
      true,

    signature: {
      kind,

      credentialKey:
        stringValue(
          signature.credentialKey,
          "integration.webhook.signature.credentialKey",
        ),

      signatureHeader:
        stringValue(
          signature.signatureHeader,
          "integration.webhook.signature.signatureHeader",
        ),

      timestampHeader:
        optionalString(
          signature.timestampHeader,
        ) ||
        undefined,

      signedPayload,

      toleranceSeconds:
        Number.isFinite(
          Number(
            signature.toleranceSeconds,
          ),
        )
          ? Number(
              signature.toleranceSeconds,
            )
          : undefined,
    },

    event: {
      eventIdPath:
        optionalString(
          event.eventIdPath,
        ) ||
        undefined,

      referencePath:
        stringValue(
          event.referencePath,
          "integration.webhook.event.referencePath",
        ),

      referenceTarget:
        (
          optionalString(
            event.referenceTarget,
          ) ||
          "provider_transfer_ref"
        ) as
          ApiWebhookEvent[
            "referenceTarget"
          ],

      statusPath:
        stringValue(
          event.statusPath,
          "integration.webhook.event.statusPath",
        ),

      fallbackStatusPath:
        optionalString(
          event.fallbackStatusPath,
        ) ||
        undefined,

      statusMap:
        (
          stringRecord(
            event.statusMap,
          ) ??
          {}
        ) as
          ApiWebhookEvent[
            "statusMap"
          ],
    },
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
      ) ||
      operation.path.startsWith(
        "//",
      ) ||
      operation.path.includes(
        "://",
      )
    ) {
      issues.push(
        `Operation ${operation.id} must use a relative path beginning with '/'.`,
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

  const webhook =
    integration.webhook;

  if (
    webhook?.enabled
  ) {
    if (
      ![
        "hmac_sha256_base64",
        "hmac_sha256_hex",
      ].includes(
        webhook.signature.kind,
      )
    ) {
      issues.push(
        "Webhook signature kind is unsupported.",
      );
    }

    if (
      !credentialKeys.has(
        webhook.signature
          .credentialKey,
      )
    ) {
      issues.push(
        `Webhook credential "${webhook.signature.credentialKey}" is not declared in auth.credentialFields.`,
      );
    }

    if (
      !webhook.signature
        .signatureHeader
        .trim()
    ) {
      issues.push(
        "Webhook signature header is required.",
      );
    }

    if (
      !webhook.event
        .referencePath
        .trim()
    ) {
      issues.push(
        "Webhook referencePath is required.",
      );
    }

    if (
      !webhook.event
        .statusPath
        .trim()
    ) {
      issues.push(
        "Webhook statusPath is required.",
      );
    }

    const allowedStates =
      new Set([
        "processing",
        "paid",
        "failed",
        "reversed",
      ]);

    for (
      const [
        providerState,
        brixtaState,
      ] of Object.entries(
        webhook.event
          .statusMap,
      )
    ) {
      if (
        !providerState ||
        !allowedStates.has(
          brixtaState,
        )
      ) {
        issues.push(
          `Invalid webhook status mapping: ${providerState} -> ${brixtaState}`,
        );
      }
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

  if (
    fenced
  ) {
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

  /*
   * V1 remains import-compatible.
   */
  const version =
    Number(
      root.formatVersion,
    );

  if (
    ![
      1,
      2,
    ].includes(
      version,
    )
  ) {
    throw new Error(
      "formatVersion must be 1 or 2.",
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
         * AI describes slots, never secret values.
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
          (
            optionalString(
              field.kind,
            ) ||
            "header"
          ) as
            ApiCredentialField[
              "kind"
            ];

        if (
          ![
            "header",
            "bearer",
          ].includes(
            kind,
          )
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
      ) ||
      undefined,

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

    operations:
      operationsRaw.map(
        parseOperation,
      ),

    webhook:
      parseWebhook(
        raw.webhook,
      ),

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
      "BRIXTA API INTEGRATION AI CONTRACT V2",

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

    objective: [
      "Read supplied API documentation, OpenAPI, Postman, cURL and sample requests/responses.",
      "Create stable BRIXTA capabilities instead of provider-specific business logic.",
      "Translate BRIXTA service input into provider HTTP using requestTemplate/queryTemplate.",
      "Translate provider response fields back using responseMapping.",
      "Describe webhook signature verification and lifecycle mapping when the provider supports webhooks.",
    ],

    rules: [
      "Never include credential VALUES.",
      "Credential fields describe secret slots only.",
      "Every provider operation must map to a stable BRIXTA capability.",
      "Provider authentication remains server-side.",
      "Financial amounts and beneficiaries are server-authoritative.",
      "requestTemplate may use {{input.foo}} expressions.",
      "queryTemplate may use {{input.foo}} expressions.",
      "responseMapping values are dot-paths into provider JSON.",
      "Use webhook status mapping to processing, paid, failed or reversed.",
      "Use payout.request, payout.getStatus and upi.validate where those semantics match.",
    ],

    expectedShape: {
      format:
        API_INTEGRATION_AI_FORMAT,

      formatVersion:
        API_INTEGRATION_AI_FORMAT_VERSION,

      integration: {
        id:
          "provider-id",

        key:
          "provider_key",

        name:
          "Provider",

        description:
          "Provider integration",

        baseUrl:
          "https://sandbox.provider.example",

        documentation:
          "Optional normalized provider notes.",

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
          ],
        },

        operations: [
          {
            id:
              "request_payout",

            label:
              "Request payout",

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

            requestTemplate: {
              amount:
                "{{input.amountText}}",
            },

            queryTemplate:
              {},

            responseMapping: {
              status:
                "status",

              providerTransferRef:
                "transfer_id",
            },
          },
        ],

        webhook: {
          enabled:
            true,

          signature: {
            kind:
              "hmac_sha256_base64",

            credentialKey:
              "client_secret",

            signatureHeader:
              "x-webhook-signature",

            timestampHeader:
              "x-webhook-timestamp",

            signedPayload:
              "timestamp_body",

            toleranceSeconds:
              300,
          },

          event: {
            referencePath:
              "data.transfer_id",

            referenceTarget:
              "provider_transfer_ref",

            statusPath:
              "data.status_code",

            fallbackStatusPath:
              "type",

            statusMap: {
              COMPLETED:
                "paid",
            },
          },
        },
      },
    },
  };
}


/*
 * CASHFREE PAYOUTS V2 CERTIFICATION PRESET
 *
 * Provider-specific data is confined to the Integration definition.
 * Pixel/Responsibility code still sees only:
 *
 *   upi.validate
 *   payout.request
 *   payout.getStatus
 */
export function cashfreePayoutsV2Template(
  id: string,
): ApiIntegrationDefinition {
  return {
    id,

    key:
      "cashfree_payouts_v2",

    name:
      "Cashfree Payouts V2",

    description:
      "Cashfree Verify-and-Pay UPI payout integration for BRIXTA QR Rewards.",

    baseUrl:
      "https://sandbox.cashfree.com/payout",

    documentation:
      "Cashfree Payouts V2. Validate VPA first, then process the validated payout using the returned single-use transfer token. Use transfer status and V2 webhooks for reconciliation.",

    auth: {
      type:
        "headers",

      credentialFields: [
        {
          key:
            "client_id",

          label:
            "Cashfree Client ID",

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
            "Cashfree Client Secret",

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
          "validate_upi",

        label:
          "Validate UPI / VPA",

        capability:
          "upi.validate",

        description:
          "Validate the VPA and receive the single-use transfer token.",

        method:
          "POST",

        path:
          "/validatePayout",

        staticHeaders: {
          "content-type":
            "application/json",

          "x-api-version":
            "2024-01-01",
        },

        requestTemplate: {
          transfer_id:
            "{{input.providerTransferId}}",

          vpa:
            "{{input.vpa}}",
        },

        responseMapping: {
          transferToken:
            "transfer_token",

          accountStatus:
            "account_status",

          beneficiaryName:
            "name_at_bank",
        },

        requestExample: {
          providerTransferId:
            "brxtest123",

          vpa:
            "success@upi",
        },
      },

      {
        id:
          "process_validated_payout",

        label:
          "Process validated UPI payout",

        capability:
          "payout.request",

        description:
          "Use the token returned by upi.validate to initiate the UPI payout.",

        method:
          "POST",

        path:
          "/transfers",

        staticHeaders: {
          "content-type":
            "application/json",

          "x-api-version":
            "2024-01-01",
        },

        requestTemplate: {
          transfer_amount:
            "{{input.amountText}}",

          transfer_id:
            "{{input.providerTransferId}}",

          transfer_token:
            "{{input.transferToken}}",

          transfer_mode:
            "upi",

          transfer_remarks:
            "BRIXTA QR reward",
        },

        responseMapping: {
          status:
            "status",

          statusCode:
            "status_code",

          providerTransferRef:
            "transfer_id",

          cfTransferId:
            "cf_transfer_id",

          utr:
            "transfer_utr",
        },
      },

      {
        id:
          "get_payout_status",

        label:
          "Get payout status",

        capability:
          "payout.getStatus",

        description:
          "Reconcile a transfer using BRIXTA's deterministic provider transfer ID.",

        method:
          "GET",

        path:
          "/transfers",

        staticHeaders: {
          "x-api-version":
            "2024-01-01",
        },

        queryTemplate: {
          transfer_id:
            "{{input.providerTransferId}}",
        },

        responseMapping: {
          status:
            "status",

          statusCode:
            "status_code",

          providerTransferRef:
            "transfer_id",

          cfTransferId:
            "cf_transfer_id",

          utr:
            "transfer_utr",
        },
      },
    ],

    webhook: {
      enabled:
        true,

      signature: {
        kind:
          "hmac_sha256_base64",

        credentialKey:
          "client_secret",

        signatureHeader:
          "x-webhook-signature",

        timestampHeader:
          "x-webhook-timestamp",

        signedPayload:
          "timestamp_body",

        toleranceSeconds:
          300,
      },

      event: {
        referencePath:
          "data.transfer_id",

        referenceTarget:
          "provider_transfer_ref",

        statusPath:
          "data.status_code",

        fallbackStatusPath:
          "type",

        statusMap: {
          COMPLETED:
            "paid",

          SENT_TO_BENEFICIARY:
            "processing",

          RECEIVED:
            "processing",

          TRANSFER_ACKNOWLEDGED:
            "paid",

          TRANSFER_SUCCESS:
            "processing",

          TRANSFER_FAILED:
            "failed",

          TRANSFER_REVERSED:
            "reversed",

          TRANSFER_REJECTED:
            "failed",
        },
      },
    },

    status:
      "draft",
  };
}
