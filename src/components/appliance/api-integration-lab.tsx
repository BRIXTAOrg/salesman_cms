"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Trash2,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  blankApiIntegration,
  buildApiIntegrationAIContext,
  integrationKey,
  parseApiIntegrationAIImport,
  validateApiIntegration,
  type ApiIntegrationDefinition,
  type ApiIntegrationPublic,
} from "@/lib/api-integration-contract";

import {
  apiJson,
} from "./client";

import {
  Field,
  inputClass,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
  textareaClass,
} from "./primitives";


function newId() {
  return (
    globalThis.crypto
      ?.randomUUID?.() ??
    `integration_${Date.now()}`
  );
}


function newIntegration() {
  return blankApiIntegration(
    newId(),
  );
}


export default function ApiIntegrationLab() {
  const [
    integrations,
    setIntegrations,
  ] =
    useState<
      ApiIntegrationPublic[]
    >(
      [],
    );


  const [
    draft,
    setDraft,
  ] =
    useState<
      ApiIntegrationDefinition
    >(
      () =>
        newIntegration(),
    );


  const [
    credentialStatus,
    setCredentialStatus,
  ] =
    useState<
      Record<string, boolean>
    >(
      {},
    );


  const [
    secrets,
    setSecrets,
  ] =
    useState<
      Record<string, string>
    >(
      {},
    );


  const [
    aiText,
    setAiText,
  ] =
    useState(
      "",
    );


  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      false,
    );


  const [
    saving,
    setSaving,
  ] =
    useState(
      false,
    );


  const [
    testing,
    setTesting,
  ] =
    useState(
      false,
    );


  const [
    testOperationId,
    setTestOperationId,
  ] =
    useState(
      "",
    );


  const [
    testRequest,
    setTestRequest,
  ] =
    useState(
      JSON.stringify(
        {
          pathParams:
            {},

          query:
            {},

          body:
            {},
        },
        null,
        2,
      ),
    );


  const [
    testResult,
    setTestResult,
  ] =
    useState<
      unknown
    >(
      null,
    );


  const issues =
    useMemo(
      () =>
        validateApiIntegration(
          draft,
        ),
      [
        draft,
      ],
    );


  async function load(
    preferredId?:
      string,
  ) {
    setLoading(
      true,
    );

    try {
      const body =
        await apiJson<{
          integrations:
            ApiIntegrationPublic[];
        }>(
          "/api/platform/integrations",
        );


      const rows =
        body.integrations ??
        [];

      setIntegrations(
        rows,
      );


      const selected =
        rows.find(
          (
            item,
          ) =>
            item.id ===
            preferredId,
        );


      if (
        selected
      ) {
        setDraft(
          selected,
        );

        setCredentialStatus(
          selected
            .credentialStatus ??
          {},
        );

        setTestOperationId(
          selected
            .operations[
            0
          ]?.id ??
          "",
        );
      }
    } catch (
      error
    ) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load API integrations.",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }


  useEffect(
    () => {
      void load();
    },
    [],
  );


  function startNew() {
    const next =
      newIntegration();

    setDraft(
      next,
    );

    setCredentialStatus(
      {},
    );

    setSecrets(
      {},
    );

    setAiText(
      "",
    );

    setTestResult(
      null,
    );

    setTestOperationId(
      "",
    );

    setMessage(
      "New integration draft.",
    );
  }


  function selectIntegration(
    integration:
      ApiIntegrationPublic,
  ) {
    setDraft(
      integration,
    );

    setCredentialStatus(
      integration
        .credentialStatus ??
      {},
    );

    setSecrets(
      {},
    );

    setAiText(
      "",
    );

    setTestResult(
      null,
    );

    setTestOperationId(
      integration
        .operations[
        0
      ]?.id ??
      "",
    );
  }


  function patch(
    values:
      Partial<
        ApiIntegrationDefinition
      >,
  ) {
    setDraft(
      (
        current,
      ) => ({
        ...current,
        ...values,
      }),
    );
  }


  async function copyAiContext() {
    const context =
      buildApiIntegrationAIContext(
        draft,
      );

    await navigator
      .clipboard
      .writeText(
        JSON.stringify(
          context,
          null,
          2,
        ),
      );

    setMessage(
      "API Integration AI context copied. Paste it into ChatGPT, then paste the returned BRIXTA Integration JSON below.",
    );
  }


  function applyAiJson() {
    try {
      const parsed =
        parseApiIntegrationAIImport(
          aiText,
        );


      setDraft(
        (
          current,
        ) => ({
          ...parsed,

          /*
           * AI describes the integration.
           * BRIXTA owns object identity/lifecycle.
           */
          id:
            current.id,

          status:
            current.status,

          createdAt:
            current
              .createdAt,

          publishedAt:
            current
              .publishedAt,

          documentation:
            current
              .documentation ||
            parsed
              .documentation,
        }),
      );


      setTestOperationId(
        parsed.operations[
          0
        ]?.id ??
        "",
      );


      setMessage(
        "Integration JSON validated and applied. Configure credentials, save, test, then publish.",
      );
    } catch (
      error
    ) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Integration JSON is invalid.",
      );
    }
  }


  async function save(
    publish:
      boolean,
  ) {
    const validation =
      validateApiIntegration(
        draft,
      );


    if (
      validation.length
    ) {
      setMessage(
        validation.join(
          "\n",
        ),
      );

      return;
    }


    setSaving(
      true,
    );


    try {
      const body =
        await apiJson<{
          integration:
            ApiIntegrationPublic;
        }>(
          "/api/platform/integrations",
          {
            method:
              "POST",

            body:
              JSON.stringify({
                integration:
                  draft,

                secrets,

                publish,
              }),
          },
        );


      setDraft(
        body.integration,
      );

      setCredentialStatus(
        body.integration
          .credentialStatus ??
        {},
      );

      setSecrets(
        {},
      );


      await load(
        body.integration
          .id,
      );


      setMessage(
        publish
          ? "Integration published. Its BRIXTA capabilities are now available to Logic AI."
          : "Integration draft saved.",
      );
    } catch (
      error
    ) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save integration.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }


  async function remove() {
    const existing =
      integrations.some(
        (
          item,
        ) =>
          item.id ===
          draft.id,
      );


    if (
      !existing
    ) {
      startNew();
      return;
    }


    if (
      !window.confirm(
        `Delete "${draft.name || draft.key}"?`,
      )
    ) {
      return;
    }


    try {
      await apiJson(
        `/api/platform/integrations?id=${encodeURIComponent(draft.id)}`,
        {
          method:
            "DELETE",
        },
      );

      startNew();

      await load();

      setMessage(
        "Integration deleted.",
      );
    } catch (
      error
    ) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete integration.",
      );
    }
  }


  async function runTest() {
    if (
      !testOperationId
    ) {
      setMessage(
        "Choose an operation to test.",
      );

      return;
    }


    let request:
      unknown;


    try {
      request =
        JSON.parse(
          testRequest,
        );
    } catch (
      error
    ) {
      setMessage(
        error instanceof Error
          ? `Test request JSON is invalid: ${error.message}`
          : "Test request JSON is invalid.",
      );

      return;
    }


    /*
     * Ensure the latest draft + any newly entered credentials
     * are persisted before executing it.
     */
    try {
      setTesting(
        true,
      );


      await apiJson(
        "/api/platform/integrations",
        {
          method:
            "POST",

          body:
            JSON.stringify({
              integration:
                draft,

              secrets,

              publish:
                false,
            }),
        },
      );


      const body =
        await apiJson<{
          result:
            unknown;
        }>(
          "/api/platform/integrations/test",
          {
            method:
              "POST",

            body:
              JSON.stringify({
                integrationId:
                  draft.id,

                operationId:
                  testOperationId,

                request,
              }),
          },
        );


      setTestResult(
        body.result,
      );

      await load(
        draft.id,
      );

      setSecrets(
        {},
      );

      setMessage(
        "Real server-side API test completed.",
      );
    } catch (
      error
    ) {
      setTestResult(
        null,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "API test failed.",
      );
    } finally {
      setTesting(
        false,
      );
    }
  }


  return (
    <div className="w-full min-w-0 space-y-5">
      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xl font-semibold">
              API Integrations
            </div>

            <div className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
              Define, authenticate, test and publish real external REST APIs.
              Provider plumbing stays here; Pixel Logic consumes stable BRIXTA capabilities.
            </div>
          </div>


          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              type="button"
              onClick={
                startNew
              }
            >
              <Plus className="h-4 w-4" />
              New Integration
            </SecondaryButton>

            <SecondaryButton
              type="button"
              onClick={
                () =>
                  void load(
                    draft.id,
                  )
              }
              disabled={
                loading
              }
            >
              {
                loading
                  ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )
                  : (
                      <RefreshCw className="h-4 w-4" />
                    )
              }
              Reload
            </SecondaryButton>
          </div>
        </div>
      </Panel>


      {message && (
        <Panel className="py-3">
          <div className="whitespace-pre-wrap text-sm">
            {message}
          </div>
        </Panel>
      )}


      <div className="grid min-w-0 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Panel className="min-w-0">
          <div className="text-sm font-semibold">
            Integrations
          </div>

          <div className="mt-3 space-y-2">
            {
              integrations.length ===
              0
                ? (
                    <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                      No integrations yet.
                    </div>
                  )
                : integrations.map(
                    (
                      item,
                    ) => (
                      <button
                        key={
                          item.id
                        }
                        type="button"
                        onClick={
                          () =>
                            selectIntegration(
                              item,
                            )
                        }
                        className={[
                          "w-full min-w-0 rounded-lg border p-3 text-left transition",
                          item.id ===
                          draft.id
                            ? "border-primary bg-primary/[0.05]"
                            : "hover:bg-muted/30",
                        ].join(
                          " ",
                        )}
                      >
                        <div className="truncate text-sm font-medium">
                          {
                            item.name
                          }
                        </div>

                        <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                          {
                            item.key
                          }
                        </div>

                        <div className="mt-2">
                          <Pill
                            tone={
                              item.status ===
                              "published"
                                ? "info"
                                : undefined
                            }
                          >
                            {
                              item.status
                            }
                          </Pill>
                        </div>
                      </button>
                    ),
                  )
            }
          </div>
        </Panel>


        <div className="min-w-0 space-y-5">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">
                  Integration Definition
                </div>

                <div className="mt-1 text-xs text-muted-foreground">
                  First give BRIXTA the provider documentation. AI converts it into the strict Integration contract.
                </div>
              </div>

              <Pill
                tone={
                  draft.status ===
                  "published"
                    ? "info"
                    : undefined
                }
              >
                {
                  draft.status
                }
              </Pill>
            </div>


            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Integration name">
                <input
                  className={
                    inputClass
                  }
                  value={
                    draft.name
                  }
                  onChange={
                    (
                      event,
                    ) => {
                      const name =
                        event.target.value;

                      patch({
                        name,

                        key:
                          draft.key ||
                          integrationKey(
                            name,
                          ),
                      });
                    }
                  }
                  placeholder="Cashfree Payouts"
                />
              </Field>


              <Field label="Integration key">
                <input
                  className={
                    inputClass
                  }
                  value={
                    draft.key
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      patch({
                        key:
                          integrationKey(
                            event.target.value,
                          ),
                      })
                  }
                  placeholder="cashfree_payouts"
                />
              </Field>


              <div className="md:col-span-2">
                <Field label="Base URL">
                  <input
                    className={
                      inputClass
                    }
                    value={
                      draft.baseUrl
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        patch({
                          baseUrl:
                            event.target.value,
                        })
                    }
                    placeholder="https://sandbox.provider.com/api"
                  />
                </Field>
              </div>


              <div className="md:col-span-2">
                <Field label="Description">
                  <input
                    className={
                      inputClass
                    }
                    value={
                      draft.description ??
                      ""
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        patch({
                          description:
                            event.target.value,
                        })
                    }
                    placeholder="What does this provider do?"
                  />
                </Field>
              </div>
            </div>


            <div className="mt-5">
              <Field label="API documentation / cURL / OpenAPI / sample JSON">
                <textarea
                  className={
                    textareaClass
                  }
                  rows={
                    14
                  }
                  value={
                    draft.documentation
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      patch({
                        documentation:
                          event.target.value,
                      })
                  }
                  placeholder={`Paste whatever the provider gives you here.

Example:

POST /transfers
Headers:
x-client-id
x-client-secret
x-api-version

Request:
{ ... }

Response:
{ ... }

GET /transfers/{id}
...`}
                />
              </Field>
            </div>


            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton
                type="button"
                onClick={
                  () =>
                    void copyAiContext()
                }
              >
                <Copy className="h-4 w-4" />
                Copy AI Integration Context
              </PrimaryButton>
            </div>
          </Panel>


          <Panel>
            <div className="text-lg font-semibold">
              AI Integration JSON
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              Paste the JSON returned by ChatGPT. BRIXTA validates the provider operations and service bindings before applying it.
            </div>

            <textarea
              className="mt-4 min-h-72 w-full rounded-lg border bg-background p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
              value={
                aiText
              }
              onChange={
                (
                  event,
                ) =>
                  setAiText(
                    event.target.value,
                  )
              }
              placeholder='{"format":"brixta.api-integration","formatVersion":1,"integration":{...}}'
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton
                type="button"
                onClick={
                  applyAiJson
                }
                disabled={
                  !aiText.trim()
                }
              >
                <CheckCircle2 className="h-4 w-4" />
                Validate & Apply
              </PrimaryButton>
            </div>


            {
              issues.length >
              0 && (
                <div className="mt-4 space-y-2">
                  {
                    issues.map(
                      (
                        issue,
                      ) => (
                        <div
                          key={
                            issue
                          }
                          className="flex items-start gap-2 rounded-lg border p-3 text-xs"
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />

                          <span>
                            {
                              issue
                            }
                          </span>
                        </div>
                      ),
                    )
                  }
                </div>
              )
            }
          </Panel>


          <Panel>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />

              <div className="text-lg font-semibold">
                Server Credentials
              </div>
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              Credentials are entered here only. They are encrypted server-side and never copied into AI or Pixel Logic JSON.
            </div>


            {
              draft.auth
                .credentialFields
                .length ===
              0
                ? (
                    <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      This integration currently declares no credentials.
                    </div>
                  )
                : (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {
                        draft.auth
                          .credentialFields
                          .map(
                            (
                              field,
                            ) => (
                              <Field
                                key={
                                  field.key
                                }
                                label={
                                  `${field.label}${
                                    credentialStatus[
                                      field.key
                                    ]
                                      ? " · configured"
                                      : ""
                                  }`
                                }
                              >
                                <input
                                  type="password"
                                  autoComplete="new-password"
                                  className={
                                    inputClass
                                  }
                                  value={
                                    secrets[
                                      field.key
                                    ] ??
                                    ""
                                  }
                                  onChange={
                                    (
                                      event,
                                    ) =>
                                      setSecrets(
                                        (
                                          current,
                                        ) => ({
                                          ...current,

                                          [
                                            field.key
                                          ]:
                                            event.target.value,
                                        }),
                                      )
                                  }
                                  placeholder={
                                    credentialStatus[
                                      field.key
                                    ]
                                      ? "•••••••• · leave blank to keep existing"
                                      : "Enter credential"
                                  }
                                />
                              </Field>
                            ),
                          )
                      }
                    </div>
                  )
            }
          </Panel>


          <Panel>
            <div className="text-lg font-semibold">
              Operations / BRIXTA Services
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border">
              {
                draft.operations.length ===
                0
                  ? (
                      <div className="p-5 text-sm text-muted-foreground">
                        No operations yet. Import the provider contract with AI.
                      </div>
                    )
                  : (
                      <div className="divide-y">
                        {
                          draft.operations.map(
                            (
                              operation,
                            ) => (
                              <div
                                key={
                                  operation.id
                                }
                                className="grid min-w-0 gap-2 p-4 md:grid-cols-[90px_minmax(0,1fr)_minmax(180px,0.8fr)]"
                              >
                                <div className="font-mono text-xs font-semibold">
                                  {
                                    operation.method
                                  }
                                </div>

                                <div className="min-w-0">
                                  <div className="break-all font-mono text-xs">
                                    {
                                      operation.path
                                    }
                                  </div>

                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {
                                      operation.label
                                    }
                                  </div>
                                </div>

                                <div className="min-w-0">
                                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    BRIXTA capability
                                  </div>

                                  <div className="mt-1 break-all font-mono text-xs">
                                    {
                                      operation.capability
                                    }
                                  </div>
                                </div>
                              </div>
                            ),
                          )
                        }
                      </div>
                    )
              }
            </div>
          </Panel>


          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">
                  Test Real API
                </div>

                <div className="mt-1 text-xs text-muted-foreground">
                  Runs server-side with the saved credentials. Secrets never enter the browser request.
                </div>
              </div>

              <SecondaryButton
                type="button"
                onClick={
                  () =>
                    void runTest()
                }
                disabled={
                  testing ||
                  !testOperationId
                }
              >
                {
                  testing
                    ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )
                    : (
                        <Play className="h-4 w-4" />
                      )
                }

                Run Test
              </SecondaryButton>
            </div>


            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <Field label="Operation">
                  <select
                    className={
                      inputClass
                    }
                    value={
                      testOperationId
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setTestOperationId(
                          event.target.value,
                        )
                    }
                  >
                    <option value="">
                      Choose operation...
                    </option>

                    {
                      draft.operations.map(
                        (
                          operation,
                        ) => (
                          <option
                            key={
                              operation.id
                            }
                            value={
                              operation.id
                            }
                          >
                            {
                              operation.method
                            }{" "}
                            {
                              operation.label
                            }
                          </option>
                        ),
                      )
                    }
                  </select>
                </Field>


                <div className="mt-4">
                  <Field label="Test request JSON">
                    <textarea
                      className="min-h-64 w-full rounded-lg border bg-background p-3 font-mono text-xs"
                      value={
                        testRequest
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          setTestRequest(
                            event.target.value,
                          )
                      }
                    />
                  </Field>
                </div>
              </div>


              <div>
                <div className="text-xs font-medium">
                  Result
                </div>

                <pre className="mt-2 min-h-72 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/10 p-3 text-xs">
                  {
                    testResult ===
                    null
                      ? "Run an operation to see the provider response."
                      : JSON.stringify(
                          testResult,
                          null,
                          2,
                        )
                  }
                </pre>
              </div>
            </div>
          </Panel>


          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">
                  Integration lifecycle
                </div>

                <div className="mt-1 text-xs text-muted-foreground">
                  Save while configuring. Publish only when the provider contract and credentials are ready.
                </div>
              </div>


              <div className="flex flex-wrap gap-2">
                <SecondaryButton
                  type="button"
                  onClick={
                    () =>
                      void remove()
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </SecondaryButton>


                <SecondaryButton
                  type="button"
                  onClick={
                    () =>
                      void save(
                        false,
                      )
                  }
                  disabled={
                    saving
                  }
                >
                  <Save className="h-4 w-4" />
                  Save Draft
                </SecondaryButton>


                <PrimaryButton
                  type="button"
                  onClick={
                    () =>
                      void save(
                        true,
                      )
                  }
                  disabled={
                    saving
                  }
                >
                  {
                    saving
                      ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )
                      : (
                          <Rocket className="h-4 w-4" />
                        )
                  }
                  Publish Integration
                </PrimaryButton>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
