"use client";

import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Smartphone,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FIELD_INPUT_CATALOG,
  checkFieldApp,
  normalizeFieldApp,
  type ConfigProblem,
  type FieldAppConfig,
  type FieldInput,
  type FieldInputType,
  type FieldSection,
} from "@/lib/field-app-contract";

import {
  FIELD_APP_TEMPLATES,
} from "@/lib/field-app-templates";

import AppExperienceControls from "./app-experience-controls";

import type {
  PlatformEntityField,
  PlatformEntityType,
} from "@/lib/platform-vnext-types";

import {
  Field,
  PageIntro,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
  inputClass,
  textareaClass,
} from "./primitives";


/*
 * BRIXTA_APP_EXPERIENCE_V1
 * BRIXTA_APP_EXPERIENCE_V2 — list/card/detail/management authoring
 *
 * This is deliberately an authoring layer OVER the existing Field App
 * contract. No second record engine and no separate Flutter app.
 *
 * Existing runtime:
 *
 *   Entity / CRM list
 *      -> published fieldApp config
 *      -> Flutter Field list
 *      -> record detail
 *      -> operational steps
 *      -> entity_records.data + audit history
 *
 * The builder changes the experience, not the storage model.
 */


type Draft = {
  config: FieldAppConfig;
  revision: number;
  updatedAt: string;
  updatedBy: string | null;
  basedOnVersion: number;
};

type StoreView = {
  published: FieldAppConfig | null;
  publishedSummary: {
    steps: number;
    questions: number;
    conditional: number;
  } | null;
  draft: Draft | null;
  problems: ConfigProblem[];
};

type Device = "android" | "ios";
type PreviewScreen = "list" | "detail";


function clone<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value),
  ) as T;
}


function keyOf(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
}


function asObject(
  value: unknown,
): Record<string, unknown> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}


async function call<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(
    url,
    {
      cache: "no-store",
      ...init,
      headers: init?.body
        ? {
            "content-type":
              "application/json",
          }
        : undefined,
    },
  );

  const body =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    const error =
      new Error(
        body?.error ??
          `Request failed (${response.status}).`,
      ) as Error & {
        problems?: ConfigProblem[];
      };

    error.problems =
      Array.isArray(
        body?.problems,
      )
        ? body.problems
        : undefined;

    throw error;
  }

  return body as T;
}


function fieldMatching(
  fields: PlatformEntityField[],
  pattern: RegExp,
  allowedTypes?: string[],
) {
  return (
    fields.find(
      (field) =>
        (
          !allowedTypes ||
          allowedTypes.includes(
            field.dataType,
          )
        ) &&
        pattern.test(
          `${field.key} ${field.label}`,
        ),
    )?.key ??
    null
  );
}


function templateConfig(
  entity: PlatformEntityType,
  templateKey: string,
) {
  const template =
    FIELD_APP_TEMPLATES.find(
      (item) =>
        item.key === templateKey,
    ) ??
    FIELD_APP_TEMPLATES[1] ??
    FIELD_APP_TEMPLATES[0];

  const fields =
    entity.fieldDefinitions ?? [];

  const textFields =
    fields.filter(
      (field) =>
        ![
          "location_point",
          "media",
        ].includes(
          field.dataType,
        ),
    );

  const configuredDisplay =
    typeof entity.config?.[
      "displayField"
    ] === "string"
      ? String(
          entity.config[
            "displayField"
          ],
        )
      : null;

  const titleField =
    configuredDisplay ??
    fieldMatching(
      textFields,
      /name|title|site|dealer|customer|company/i,
    ) ??
    textFields[0]?.key ??
    null;

  const locationField =
    fieldMatching(
      fields,
      /location|gps|coordinate|lat|pin/i,
      ["location_point"],
    ) ??
    fields.find(
      (field) =>
        field.dataType ===
        "location_point",
    )?.key ??
    null;

  const priorityField =
    fieldMatching(
      fields,
      /priority|score|rank/i,
      ["number"],
    );

  const subtitles =
    textFields
      .map((field) => field.key)
      .filter(
        (key) =>
          key !== titleField,
      )
      .slice(0, 2);

  return normalizeFieldApp(
    {
      enabled: true,
      template:
        template.key,
      title:
        entity.title,
      titleField,
      subtitleFields:
        subtitles,
      priorityField,
      locationField,
      followUpField:
        template.followUpField,
      stages:
        template.stages,
      sections:
        template.sections,
    },
    entity.title,
  );
}


function makeQuestion(
  key: string,
): FieldInput {
  return {
    key,
    label:
      "New question",
    type: "text",
    required: false,
    options: [],
    placeholder: null,
    unit: null,
    help: null,
    min: null,
    max: null,
    maxPhotos: 10,
    formula: null,
    decimals: 2,
    showWhen: null,
  };
}


function collectingCount(
  section: FieldSection,
) {
  return section.fields.filter(
    (field) =>
      field.type !== "note",
  ).length;
}


function extractJson(
  source: string,
) {
  const text =
    source.trim();

  const start =
    text.indexOf("{");

  const end =
    text.lastIndexOf("}");

  if (
    start < 0 ||
    end <= start
  ) {
    throw new Error(
      "The AI reply does not contain a JSON object.",
    );
  }

  return JSON.parse(
    text.slice(
      start,
      end + 1,
    ),
  ) as unknown;
}


function stageToneClass(
  tone: string,
) {
  if (tone === "good")
    return "bg-emerald-100 text-emerald-800";

  if (tone === "warning")
    return "bg-amber-100 text-amber-800";

  if (tone === "danger")
    return "bg-red-100 text-red-800";

  if (tone === "info")
    return "bg-blue-100 text-blue-800";

  return "bg-zinc-100 text-zinc-700";
}


export default function AppExperienceBuilder() {
  const [
    entities,
    setEntities,
  ] =
    useState<
      PlatformEntityType[]
    >([]);

  const [
    entityId,
    setEntityId,
  ] =
    useState<number | null>(
      null,
    );

  const [
    store,
    setStore,
  ] =
    useState<StoreView | null>(
      null,
    );

  const [
    config,
    setConfig,
  ] =
    useState<
      FieldAppConfig | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState<
      null |
      "save" |
      "publish"
    >(null);

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    brief,
    setBrief,
  ] =
    useState(
      "Build a field sales experience for this CRM list. "
      + "Show assigned records, map/navigation, record details and an operational journey. "
      + "The employee should complete the right steps and management should see progress in Data input.",
    );

  const [
    aiReply,
    setAiReply,
  ] =
    useState("");

  const [
    device,
    setDevice,
  ] =
    useState<Device>(
      "android",
    );

  const [
    previewScreen,
    setPreviewScreen,
  ] =
    useState<PreviewScreen>(
      "detail",
    );


  const entity =
    useMemo(
      () =>
        entities.find(
          (item) =>
            item.id ===
            entityId,
        ) ??
        null,
      [
        entities,
        entityId,
      ],
    );


  const loadEntities =
    useCallback(
      async () => {
        setLoading(true);
        setError(null);

        try {
          const body =
            await call<{
              entityTypes:
                PlatformEntityType[];
            }>(
              "/api/platform/entities",
            );

          const items =
            body.entityTypes ??
            [];

          setEntities(
            items,
          );

          setEntityId(
            (current) => {
              if (
                current &&
                items.some(
                  (item) =>
                    item.id ===
                    current,
                )
              ) {
                return current;
              }

              const published =
                items.find(
                  (item) => {
                    const raw =
                      item.config?.[
                        "fieldApp"
                      ];

                    return Boolean(
                      raw &&
                      typeof raw ===
                        "object",
                    );
                  },
                );

              return (
                published?.id ??
                items[0]?.id ??
                null
              );
            },
          );
        } catch (
          failure
        ) {
          setError(
            failure instanceof
              Error
              ? failure.message
              : "Could not load CRM lists.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );


  useEffect(
    () => {
      void loadEntities();
    },
    [
      loadEntities,
    ],
  );


  const adoptStore =
    useCallback(
      (
        next:
          StoreView,
        currentEntity:
          PlatformEntityType,
      ) => {
        setStore(
          next,
        );

        const working =
          next.draft
            ?.config ??
          next.published;

        setConfig(
          working
            ? clone(
                working,
              )
            : templateConfig(
                currentEntity,
                "simple_visit",
              ),
        );
      },
      [],
    );


  useEffect(
    () => {
      if (!entity)
        return;

      let cancelled =
        false;

      setLoading(true);
      setError(null);

      call<StoreView>(
        `/api/platform/field-apps/${entity.id}`,
      )
        .then(
          (next) => {
            if (
              !cancelled
            ) {
              adoptStore(
                next,
                entity,
              );
            }
          },
        )
        .catch(
          (failure) => {
            if (
              !cancelled
            ) {
              setError(
                failure instanceof
                  Error
                  ? failure.message
                  : "Could not load the app experience.",
              );
            }
          },
        )
        .finally(
          () => {
            if (
              !cancelled
            ) {
              setLoading(
                false,
              );
            }
          },
        );

      return () => {
        cancelled =
          true;
      };
    },
    [
      entity,
      adoptStore,
    ],
  );


  const problems =
    useMemo(
      () =>
        config &&
        config.enabled
          ? checkFieldApp(
              config,
            )
          : [],
      [
        config,
      ],
    );


  function replaceSection(
    index: number,
    patch:
      Partial<FieldSection>,
  ) {
    if (!config)
      return;

    const sections =
      config.sections.map(
        (
          section,
          position,
        ) =>
          position ===
          index
            ? {
                ...section,
                ...patch,
              }
            : section,
      );

    setConfig({
      ...config,
      sections,
    });
  }


  function moveSection(
    index: number,
    direction: -1 | 1,
  ) {
    if (!config)
      return;

    const target =
      index +
      direction;

    if (
      target < 0 ||
      target >=
        config.sections
          .length
    ) {
      return;
    }

    const sections =
      [
        ...config.sections,
      ];

    const [
      moved,
    ] =
      sections.splice(
        index,
        1,
      );

    sections.splice(
      target,
      0,
      moved,
    );

    setConfig({
      ...config,
      sections,
    });
  }


  function removeSection(
    index: number,
  ) {
    if (!config)
      return;

    const key =
      config.sections[
        index
      ]?.key;

    if (!key)
      return;

    const sections =
      config.sections
        .filter(
          (
            _,
            position,
          ) =>
            position !==
            index,
        )
        .map(
          (section) => ({
            ...section,
            requires:
              section.requires
                .filter(
                  (required) =>
                    required !==
                    key,
                ),
          }),
        );

    setConfig({
      ...config,
      sections,
    });
  }


  function addSection() {
    if (!config)
      return;

    const known =
      new Set(
        config.sections.map(
          (section) =>
            section.key,
        ),
      );

    let number = 1;
    let key =
      `step_${number}`;

    while (
      known.has(key)
    ) {
      number += 1;
      key =
        `step_${number}`;
    }

    const previous =
      config.sections.at(
        -1,
      );

    const section:
      FieldSection = {
        key,
        title:
          "New step",
        hint: null,
        requires:
          previous
            ? [
                previous.key,
              ]
            : [],
        setsStage: null,
        stageWhen: [],
        fields: [
          makeQuestion(
            `${key}_question_1`,
          ),
        ],
      };

    setConfig({
      ...config,
      sections: [
        ...config.sections,
        section,
      ],
    });
  }


  function patchQuestion(
    sectionIndex:
      number,
    fieldIndex:
      number,
    patch:
      Partial<FieldInput>,
  ) {
    if (!config)
      return;

    const section =
      config.sections[
        sectionIndex
      ];

    if (!section)
      return;

    const fields =
      section.fields.map(
        (
          field,
          position,
        ) =>
          position ===
          fieldIndex
            ? {
                ...field,
                ...patch,
              }
            : field,
      );

    replaceSection(
      sectionIndex,
      {
        fields,
      },
    );
  }


  function changeQuestionType(
    sectionIndex:
      number,
    fieldIndex:
      number,
    type:
      FieldInputType,
  ) {
    if (!config)
      return;

    const field =
      config.sections[
        sectionIndex
      ]?.fields[
        fieldIndex
      ];

    if (!field)
      return;

    patchQuestion(
      sectionIndex,
      fieldIndex,
      {
        type,
        required:
          type ===
            "note" ||
          type ===
            "calculated"
            ? false
            : field.required,
        options:
          type ===
            "choice" ||
          type ===
            "multi_choice"
            ? field.options
                .length >= 2
              ? field.options
              : [
                  "Option 1",
                  "Option 2",
                ]
            : [],
        maxPhotos:
          type ===
            "photos"
            ? 10
            : field.maxPhotos,
      },
    );
  }


  function removeQuestion(
    sectionIndex:
      number,
    fieldIndex:
      number,
  ) {
    if (!config)
      return;

    const section =
      config.sections[
        sectionIndex
      ];

    if (!section)
      return;

    replaceSection(
      sectionIndex,
      {
        fields:
          section.fields
            .filter(
              (
                _,
                position,
              ) =>
                position !==
                fieldIndex,
            ),
      },
    );
  }


  function addQuestion(
    sectionIndex:
      number,
  ) {
    if (!config)
      return;

    const section =
      config.sections[
        sectionIndex
      ];

    if (!section)
      return;

    const used =
      new Set(
        config.sections
          .flatMap(
            (item) =>
              item.fields,
          )
          .map(
            (field) =>
              field.key,
          ),
      );

    let number = 1;
    let key =
      `${section.key}_question_${number}`;

    while (
      used.has(key)
    ) {
      number += 1;
      key =
        `${section.key}_question_${number}`;
    }

    replaceSection(
      sectionIndex,
      {
        fields: [
          ...section.fields,
          makeQuestion(
            key,
          ),
        ],
      },
    );
  }


  function quickDraft() {
    if (
      !entity ||
      !config
    ) {
      return;
    }

    const lower =
      brief.toLowerCase();

    const templateKey =
      /dealer|retailer|shop|store|counter/.test(
        lower,
      )
        ? "dealer_visit"
        : /construction|site|building|contractor|architect|cement/.test(
              lower,
            )
          ? "construction_site_visit"
          : "simple_visit";

    const generated =
      templateConfig(
        entity,
        templateKey,
      );

    const experience =
      clone(
        generated.experience,
      );

    const allInputs =
      generated.sections.flatMap(
        (section) =>
          section.fields,
      );

    const interestField =
      allInputs.find(
        (field) =>
          /interest|temperature|lead_status|lead_stage/i.test(
            `${field.key} ${field.label}`,
          ) ||
          (
            field.options.includes(
              "Hot",
            ) &&
            field.options.includes(
              "Warm",
            ) &&
            field.options.includes(
              "Cold",
            )
          ),
      );

    if (
      /assigned|only my|my sites|my leads|salesman.*own/i.test(
        lower,
      )
    ) {
      experience.list.recordScope =
        "assigned_to_me";
    }

    if (
      /hot|warm|cold|lead temperature|lead classification/i.test(
        lower,
      ) &&
      interestField
    ) {
      const keep =
        experience.list.lenses.filter(
          (lens) =>
            ![
              "hot",
              "warm",
              "cold",
            ].includes(
              lens.key,
            ),
        );

      experience.list.lenses = [
        {
          key: "hot",
          label: "Hot",
          kind: "field",
          field:
            interestField.key,
          values: ["Hot"],
          stageKeys: [],
        },
        {
          key: "warm",
          label: "Warm",
          kind: "field",
          field:
            interestField.key,
          values: ["Warm"],
          stageKeys: [],
        },
        {
          key: "cold",
          label: "Cold",
          kind: "field",
          field:
            interestField.key,
          values: ["Cold"],
          stageKeys: [],
        },
        ...keep.filter(
          (lens) =>
            [
              "mine",
              "followups",
              "closed",
            ].includes(
              lens.key,
            ),
        ),
      ];

      experience.list.defaultLens =
        "hot";

      experience.list.badgeField =
        interestField.key;

      experience.list.badgeToneRules = [
        {
          value: "Hot",
          tone: "danger",
        },
        {
          value: "Warm",
          tone: "warning",
        },
        {
          value: "Cold",
          tone: "neutral",
        },
      ];

      experience.list.cardFields = [
        interestField.key,
        ...(generated.followUpField
          ? [
              generated.followUpField,
            ]
          : []),
      ].slice(
        0,
        4,
      );

      experience.management.summaryLensKeys = [
        "hot",
        "warm",
        "cold",
        ...(experience.list.lenses.some(
          (lens) =>
            lens.key ===
            "followups",
        )
          ? [
              "followups",
            ]
          : []),
      ];
    }


    setConfig({
      ...generated,
      experience,

      /*
       * Preserve display choices an admin may already have made.
       */
      title:
        config.title ||
        generated.title,

      titleField:
        config.titleField ??
        generated.titleField,

      subtitleFields:
        config.subtitleFields
          .length
          ? config.subtitleFields
          : generated
              .subtitleFields,

      priorityField:
        config.priorityField ??
        generated.priorityField,

      locationField:
        config.locationField ??
        generated.locationField,
    });

    setMessage(
      `Drafted the ${templateKey.replaceAll("_", " ")} experience. Review it before publishing.`,
    );
  }


  function buildAiRequest() {
    if (
      !entity ||
      !config
    ) {
      return "";
    }

    return [
      "You are BRIXTA App Experience AI.",
      "",
      "Your job is to modify ONE operational CRM module used by field employees.",
      "The module already has a list screen, record-detail screen, Navigate/Copy Link actions, stages, timeline and step launcher.",
      "Each section below becomes one operational step on the record-detail screen.",
      "A section may contain form/capture fields. Completion updates the CRM record's Field state and appears in the CMS Data input area.",
      "",
      "IMPORTANT ARCHITECTURE RULES:",
      "- Do not invent Flutter/Dart code.",
      "- Do not create another database/table/record engine.",
      "- Preserve stable existing section keys and field keys whenever the same concept remains.",
      "- You may add new section/field keys using snake_case.",
      "- Existing CRM columns may be used for titleField/subtitleFields/priorityField/locationField.",
      "- New capture fields are allowed; BRIXTA adds their Entity columns when the experience is published.",
      "- Keep stages generic and operational.",
      "- Do not put Responsibility records into this module; this module stores field answers on the linked CRM entity record.",
      "- Return ONE JSON object only. No markdown fences and no prose.",
      "",
      "OUTPUT:",
      "Return a complete FieldAppConfig-shaped object with these top-level keys:",
      "enabled, template, title, titleField, subtitleFields, priorityField, locationField, followUpField, tableFields, experience, stages, sections.",
      "",
      "EXPERIENCE controls the surrounding app UI:",
      "- experience.list.recordScope: all | assigned_to_me",
      "- experience.list.search: boolean",
      "- experience.list.defaultLens: lens key",
      "- experience.list.lenses: list pills / filters",
      "- lens.kind: mine | todo | active | followups | closed | all | stages | field",
      "- field lenses use {field, values}; stage lenses use stageKeys",
      "- experience.list.cardFields: up to 4 CRM/capture field keys",
      "- experience.list.badgeField: prominent classification such as customer_interest",
      "- experience.list.badgeToneRules: [{value,tone}]",
      "- experience.list.showDistance/showAssignee/showFollowUp/showLastActivity",
      "- experience.list.sort: smart | distance | priority | updated | follow_up",
      "- experience.detail.showMap/showNavigate/showCopyLink/showImportedInfo/showTimeline",
      "- experience.management.summaryLensKeys: lens keys management should see as live count cards",
      "",
      "Each stage:",
      '{"key":"verified","label":"Verified","tone":"info","closed":false,"terminal":false}',
      "",
      "Each section:",
      '{"key":"verify","title":"Verify site","hint":"...","requires":[],"setsStage":"verified","stageWhen":[],"fields":[]}',
      "",
      "Each field:",
      '{"key":"site_status","label":"What is here?","type":"choice","required":true,"options":["A","B"],"placeholder":null,"unit":null,"help":null,"min":null,"max":null,"maxPhotos":10,"formula":null,"decimals":2,"showWhen":null}',
      "",
      `USER BRIEF:\n${brief.trim()}`,
      "",
      `CRM LIST:\n${entity.title}`,
      "",
      `AVAILABLE CRM COLUMNS:\n${JSON.stringify(
        entity.fieldDefinitions.map(
          (field) => ({
            key:
              field.key,
            label:
              field.label,
            dataType:
              field.dataType,
          }),
        ),
        null,
        2,
      )}`,
      "",
      `CURRENT MODULE:\n${JSON.stringify(
        config,
        null,
        2,
      )}`,
    ].join("\n");
  }


  async function copyAiRequest() {
    const request =
      buildAiRequest();

    if (!request)
      return;

    try {
      await navigator.clipboard.writeText(
        request,
      );

      setMessage(
        "AI context copied. Give it to your AI, paste the JSON reply here, then Apply AI reply.",
      );
    } catch {
      setError(
        "Clipboard access failed. Copy the AI request manually.",
      );
    }
  }


  function applyAiReply() {
    if (
      !entity ||
      !config
    ) {
      return;
    }

    try {
      const root =
        asObject(
          extractJson(
            aiReply,
          ),
        );

      const raw =
        asObject(
          root.config ??
          root,
        );

      /*
       * AI must return a complete module, but preserve the current values
       * when a top-level field is omitted. This makes "change only X"
       * requests safe.
       */
      const candidate = {
        ...config,
        ...raw,

        stages:
          Array.isArray(
            raw.stages,
          )
            ? raw.stages
            : config.stages,

        sections:
          Array.isArray(
            raw.sections,
          )
            ? raw.sections
            : config.sections,

        version: 0,
        publishedAt: null,
        publishedBy: null,
      };

      const normalized =
        normalizeFieldApp(
          candidate,
          entity.title,
        );

      setConfig(
        normalized,
      );

      const issues =
        normalized.enabled
          ? checkFieldApp(
              normalized,
            )
          : [];

      if (
        issues.length
      ) {
        setMessage(
          `AI reply applied with ${issues.length} item${issues.length === 1 ? "" : "s"} to fix before publishing.`,
        );
      } else {
        setMessage(
          "AI reply applied to the draft. Nothing is live until you publish.",
        );
      }

      setError(
        null,
      );
    } catch (
      failure
    ) {
      setError(
        failure instanceof
          Error
          ? failure.message
          : "Could not apply the AI reply.",
      );
    }
  }


  async function saveDraft() {
    if (
      !entity ||
      !config
    ) {
      return;
    }

    setBusy(
      "save",
    );

    setError(
      null,
    );

    try {
      const cleaned =
        normalizeFieldApp(
          config,
          entity.title,
        );

      const next =
        await call<StoreView>(
          `/api/platform/field-apps/${entity.id}`,
          {
            method:
              "PUT",
            body:
              JSON.stringify({
                config:
                  cleaned,
                revision:
                  store?.draft
                    ?.revision,
              }),
          },
        );

      adoptStore(
        next,
        entity,
      );

      setMessage(
        "Draft saved. Phones are still using the published version.",
      );
    } catch (
      failure
    ) {
      setError(
        failure instanceof
          Error
          ? failure.message
          : "Could not save the draft.",
      );
    } finally {
      setBusy(
        null,
      );
    }
  }


  async function publish() {
    if (
      !entity ||
      !config
    ) {
      return;
    }

    const cleaned =
      normalizeFieldApp(
        config,
        entity.title,
      );

    const issues =
      cleaned.enabled
        ? checkFieldApp(
            cleaned,
          )
        : [];

    if (
      issues.length
    ) {
      setError(
        issues[0].message,
      );
      return;
    }

    setBusy(
      "publish",
    );

    setError(
      null,
    );

    try {
      const next =
        await call<
          StoreView & {
            publishedVersion?:
              number;
          }
        >(
          `/api/platform/field-apps/${entity.id}`,
          {
            method:
              "POST",
            body:
              JSON.stringify({
                action:
                  "publish",
                config:
                  cleaned,
                revision:
                  store?.draft
                    ?.revision,
                note:
                  "Published from App Experience Builder",
              }),
          },
        );

      adoptStore(
        next,
        entity,
      );

      setMessage(
        `Published${next.publishedVersion ? ` v${next.publishedVersion}` : ""}. The existing Flutter Field runtime will use this experience on refresh.`,
      );

      await loadEntities();
    } catch (
      failure
    ) {
      const typed =
        failure as Error & {
          problems?:
            ConfigProblem[];
        };

      setError(
        typed.problems?.[0]
          ?.message ??
        typed.message ??
        "Could not publish.",
      );
    } finally {
      setBusy(
        null,
      );
    }
  }


  const textFields =
    entity?.fieldDefinitions
      .filter(
        (field) =>
          ![
            "location_point",
            "media",
          ].includes(
            field.dataType,
          ),
      ) ??
    [];

  const numberFields =
    entity?.fieldDefinitions
      .filter(
        (field) =>
          field.dataType ===
          "number",
      ) ??
    [];

  const locationFields =
    entity?.fieldDefinitions
      .filter(
        (field) =>
          field.dataType ===
          "location_point",
      ) ??
    [];


  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">

      <PageIntro
        title="App experiences"
        description="Build the operational CRM interface your field team uses — list, record detail, stages and steps. Responsibilities stay available for standalone workflows; this surface controls the CRM Field experience."
      />


      {message && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {message}
          </span>
        </div>
      )}


      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}


      <Panel>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">

          <div className="min-w-0 flex-1">
            <Field
              label="CRM module"
              hint="Each CRM list can publish its own operational experience."
            >
              <select
                className={inputClass}
                value={
                  entityId ??
                  ""
                }
                onChange={(
                  event,
                ) => {
                  setEntityId(
                    Number(
                      event.target
                        .value,
                    ),
                  );

                  setStore(
                    null,
                  );

                  setConfig(
                    null,
                  );

                  setMessage(
                    null,
                  );

                  setError(
                    null,
                  );
                }}
              >
                {entities.map(
                  (item) => (
                    <option
                      key={
                        item.id
                      }
                      value={
                        item.id
                      }
                    >
                      {
                        item.title
                      }
                    </option>
                  ),
                )}
              </select>
            </Field>
          </div>

          <SecondaryButton
            type="button"
            onClick={() =>
              void loadEntities()
            }
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </SecondaryButton>

          {store?.published && (
            <Pill tone="good">
              Live v
              {
                store
                  .published
                  .version
              }
            </Pill>
          )}

          {store?.draft && (
            <Pill tone="warning">
              Draft
            </Pill>
          )}

        </div>
      </Panel>


      {loading && !config && (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading app experience…
        </div>
      )}


      {!loading &&
        entities.length === 0 && (
          <Panel>
            <div className="py-8 text-center text-sm text-muted-foreground">
              Create or import a CRM list first.
            </div>
          </Panel>
        )}


      {entity && config && (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">

          <div className="min-w-0 space-y-6">

            {/* =====================================================
                AI AUTHORING
                ===================================================== */}

            <Panel>
              <div className="flex items-start gap-3">

                <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
                  <Sparkles className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold">
                    Build with AI
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground">
                    BRIXTA gives AI the CRM columns and the current module. The reply modifies this draft — never the live app until you publish.
                  </div>
                </div>

              </div>


              <div className="mt-5 space-y-4">

                <Field
                  label="What should this part of the app do?"
                  hint="Describe the employee experience, not database implementation."
                >
                  <textarea
                    className={textareaClass}
                    rows={5}
                    maxLength={6000}
                    value={brief}
                    onChange={(
                      event,
                    ) =>
                      setBrief(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Example: Show assigned construction sites. Opening a site should show map/navigation, key site information and Verify → Key people → Pitch → Follow-up → Order. Once an order is completed mark the record won."
                  />
                </Field>


                <div className="flex flex-wrap gap-2">

                  <PrimaryButton
                    type="button"
                    onClick={
                      quickDraft
                    }
                  >
                    <Sparkles className="h-4 w-4" />
                    Quick draft
                  </PrimaryButton>

                  <SecondaryButton
                    type="button"
                    onClick={() =>
                      void copyAiRequest()
                    }
                  >
                    <Copy className="h-4 w-4" />
                    Copy AI context
                  </SecondaryButton>

                </div>


                <details className="rounded-xl border">

                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                    Apply an AI reply
                  </summary>

                  <div className="space-y-3 border-t p-4">

                    <div className="text-xs leading-5 text-muted-foreground">
                      Paste the JSON returned from the copied AI context. Existing stable IDs are preserved when the AI leaves them unchanged.
                    </div>

                    <textarea
                      className={`${textareaClass} font-mono text-xs`}
                      rows={8}
                      value={
                        aiReply
                      }
                      onChange={(
                        event,
                      ) =>
                        setAiReply(
                          event.target
                            .value,
                        )
                      }
                      placeholder='{"title":"Field","stages":[...],"sections":[...]}'
                    />

                    <PrimaryButton
                      type="button"
                      disabled={
                        !aiReply.trim()
                      }
                      onClick={
                        applyAiReply
                      }
                    >
                      <Sparkles className="h-4 w-4" />
                      Apply AI reply
                    </PrimaryButton>

                  </div>

                </details>

              </div>
            </Panel>


            {/* =====================================================
                APP SHELL / RECORD PRESENTATION
                ===================================================== */}

            <Panel>
              <div className="text-lg font-semibold">
                App shell
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                These settings control how this CRM module appears in the existing Field interface.
              </div>


              <div className="mt-5 grid gap-4 md:grid-cols-2">

                <Field label="Name in app">
                  <input
                    className={inputClass}
                    value={
                      config.title
                    }
                    onChange={(
                      event,
                    ) =>
                      setConfig({
                        ...config,
                        title:
                          event.target
                            .value,
                      })
                    }
                  />
                </Field>


                <Field
                  label="Card title"
                  hint="Main line on each record card."
                >
                  <select
                    className={inputClass}
                    value={
                      config.titleField ??
                      ""
                    }
                    onChange={(
                      event,
                    ) =>
                      setConfig({
                        ...config,
                        titleField:
                          event.target
                            .value ||
                          null,
                      })
                    }
                  >
                    <option value="">
                      Record ID
                    </option>

                    {textFields.map(
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


                <Field label="Subtitle">
                  <select
                    className={inputClass}
                    value={
                      config
                        .subtitleFields[
                        0
                      ] ??
                      ""
                    }
                    onChange={(
                      event,
                    ) => {
                      const first =
                        event.target
                          .value;

                      setConfig({
                        ...config,
                        subtitleFields:
                          [
                            first,
                            config
                              .subtitleFields[
                              1
                            ] ??
                              "",
                          ].filter(
                            Boolean,
                          ),
                      });
                    }}
                  >
                    <option value="">
                      Nothing
                    </option>

                    {textFields.map(
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


                <Field label="Second subtitle">
                  <select
                    className={inputClass}
                    value={
                      config
                        .subtitleFields[
                        1
                      ] ??
                      ""
                    }
                    onChange={(
                      event,
                    ) => {
                      const second =
                        event.target
                          .value;

                      setConfig({
                        ...config,
                        subtitleFields:
                          [
                            config
                              .subtitleFields[
                              0
                            ] ??
                              "",
                            second,
                          ].filter(
                            Boolean,
                          ),
                      });
                    }}
                  >
                    <option value="">
                      Nothing
                    </option>

                    {textFields.map(
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


                <Field label="Map / navigation location">
                  <select
                    className={inputClass}
                    value={
                      config.locationField ??
                      ""
                    }
                    onChange={(
                      event,
                    ) =>
                      setConfig({
                        ...config,
                        locationField:
                          event.target
                            .value ||
                          null,
                      })
                    }
                  >
                    <option value="">
                      No map
                    </option>

                    {locationFields.map(
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


                <Field label="Priority">
                  <select
                    className={inputClass}
                    value={
                      config.priorityField ??
                      ""
                    }
                    onChange={(
                      event,
                    ) =>
                      setConfig({
                        ...config,
                        priorityField:
                          event.target
                            .value ||
                          null,
                      })
                    }
                  >
                    <option value="">
                      None
                    </option>

                    {numberFields.map(
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
            </Panel>


            <Panel>
              <AppExperienceControls
                entity={entity}
                config={config}
                onChange={setConfig}
              />
            </Panel>


            {/* =====================================================
                OPERATIONAL JOURNEY
                ===================================================== */}

            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-3">

                <div>
                  <div className="text-lg font-semibold">
                    Operational journey
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground">
                    These become the step cards on the CRM record screen in Flutter.
                  </div>
                </div>

                <SecondaryButton
                  type="button"
                  onClick={
                    addSection
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add step
                </SecondaryButton>

              </div>


              <div className="mt-5 space-y-4">

                {config.sections.map(
                  (
                    section,
                    sectionIndex,
                  ) => (

                    <div
                      key={
                        section.key
                      }
                      className="rounded-2xl border bg-background"
                    >

                      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">

                        <div className="flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold">
                          {
                            sectionIndex +
                            1
                          }
                        </div>

                        <div className="min-w-0 flex-1">

                          <input
                            className="w-full bg-transparent text-[15px] font-semibold outline-none"
                            value={
                              section.title
                            }
                            onChange={(
                              event,
                            ) =>
                              replaceSection(
                                sectionIndex,
                                {
                                  title:
                                    event.target
                                      .value,
                                },
                              )
                            }
                          />

                          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {
                              section.key
                            }
                            {" · "}
                            {
                              collectingCount(
                                section,
                              )
                            }
                            {" captures"}
                          </div>

                        </div>


                        <button
                          type="button"
                          aria-label="Move step up"
                          disabled={
                            sectionIndex ===
                            0
                          }
                          onClick={() =>
                            moveSection(
                              sectionIndex,
                              -1,
                            )
                          }
                          className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-30"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>


                        <button
                          type="button"
                          aria-label="Move step down"
                          disabled={
                            sectionIndex ===
                            config.sections
                              .length -
                              1
                          }
                          onClick={() =>
                            moveSection(
                              sectionIndex,
                              1,
                            )
                          }
                          className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-30"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>


                        <button
                          type="button"
                          aria-label="Delete step"
                          onClick={() =>
                            removeSection(
                              sectionIndex,
                            )
                          }
                          className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>

                      </div>


                      <div className="space-y-4 p-4">

                        <div className="grid gap-3 md:grid-cols-3">

                          <Field label="Step guidance">
                            <input
                              className={inputClass}
                              value={
                                section.hint ??
                                ""
                              }
                              onChange={(
                                event,
                              ) =>
                                replaceSection(
                                  sectionIndex,
                                  {
                                    hint:
                                      event.target
                                        .value ||
                                      null,
                                  },
                                )
                              }
                              placeholder="What should the employee do?"
                            />
                          </Field>


                          <Field label="Unlock after">
                            <select
                              className={inputClass}
                              value={
                                section
                                  .requires[
                                  0
                                ] ??
                                ""
                              }
                              onChange={(
                                event,
                              ) =>
                                replaceSection(
                                  sectionIndex,
                                  {
                                    requires:
                                      event.target
                                        .value
                                        ? [
                                            event
                                              .target
                                              .value,
                                          ]
                                        : [],
                                  },
                                )
                              }
                            >
                              <option value="">
                                Immediately
                              </option>

                              {config.sections
                                .filter(
                                  (
                                    other,
                                  ) =>
                                    other.key !==
                                    section.key,
                                )
                                .map(
                                  (
                                    other,
                                  ) => (
                                    <option
                                      key={
                                        other.key
                                      }
                                      value={
                                        other.key
                                      }
                                    >
                                      {
                                        other.title
                                      }
                                    </option>
                                  ),
                                )}
                            </select>
                          </Field>


                          <Field label="Stage after completion">
                            <select
                              className={inputClass}
                              value={
                                section.setsStage ??
                                ""
                              }
                              onChange={(
                                event,
                              ) =>
                                replaceSection(
                                  sectionIndex,
                                  {
                                    setsStage:
                                      event.target
                                        .value ||
                                      null,
                                  },
                                )
                              }
                            >
                              <option value="">
                                Keep current stage
                              </option>

                              {config.stages.map(
                                (
                                  stage,
                                ) => (
                                  <option
                                    key={
                                      stage.key
                                    }
                                    value={
                                      stage.key
                                    }
                                  >
                                    {
                                      stage.label
                                    }
                                  </option>
                                ),
                              )}
                            </select>
                          </Field>

                        </div>


                        <div className="space-y-2">

                          {section.fields.map(
                            (
                              field,
                              fieldIndex,
                            ) => (

                              <div
                                key={
                                  field.key
                                }
                                className="grid gap-2 rounded-xl bg-muted/30 p-3 md:grid-cols-[minmax(160px,1fr)_170px_auto_auto]"
                              >

                                <div>
                                  <input
                                    className={inputClass}
                                    value={
                                      field.label
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      patchQuestion(
                                        sectionIndex,
                                        fieldIndex,
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
                                      field.key
                                    }
                                  </div>
                                </div>


                                <select
                                  className={inputClass}
                                  value={
                                    field.type
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    changeQuestionType(
                                      sectionIndex,
                                      fieldIndex,
                                      event.target
                                        .value as FieldInputType,
                                    )
                                  }
                                >
                                  {FIELD_INPUT_CATALOG.map(
                                    (
                                      spec,
                                    ) => (
                                      <option
                                        key={
                                          spec.type
                                        }
                                        value={
                                          spec.type
                                        }
                                      >
                                        {
                                          spec.label
                                        }
                                      </option>
                                    ),
                                  )}
                                </select>


                                <label className="flex h-10 items-center gap-2 whitespace-nowrap text-xs">
                                  <input
                                    type="checkbox"
                                    checked={
                                      field.required
                                    }
                                    disabled={
                                      field.type ===
                                        "note" ||
                                      field.type ===
                                        "calculated"
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      patchQuestion(
                                        sectionIndex,
                                        fieldIndex,
                                        {
                                          required:
                                            event.target
                                              .checked,
                                        },
                                      )
                                    }
                                  />
                                  Required
                                </label>


                                <button
                                  type="button"
                                  aria-label="Delete question"
                                  onClick={() =>
                                    removeQuestion(
                                      sectionIndex,
                                      fieldIndex,
                                    )
                                  }
                                  className="h-10 rounded-lg px-3 text-muted-foreground hover:bg-red-50 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>


                                {(field.type ===
                                  "choice" ||
                                  field.type ===
                                    "multi_choice") && (
                                  <div className="md:col-span-4">
                                    <Field
                                      label="Options"
                                      hint="Comma separated."
                                    >
                                      <input
                                        className={inputClass}
                                        value={
                                          field.options.join(
                                            ", ",
                                          )
                                        }
                                        onChange={(
                                          event,
                                        ) =>
                                          patchQuestion(
                                            sectionIndex,
                                            fieldIndex,
                                            {
                                              options:
                                                event.target
                                                  .value
                                                  .split(
                                                    ",",
                                                  )
                                                  .map(
                                                    (
                                                      item,
                                                    ) =>
                                                      item.trim(),
                                                  )
                                                  .filter(
                                                    Boolean,
                                                  ),
                                            },
                                          )
                                        }
                                      />
                                    </Field>
                                  </div>
                                )}

                              </div>

                            ),
                          )}


                          <SecondaryButton
                            type="button"
                            onClick={() =>
                              addQuestion(
                                sectionIndex,
                              )
                            }
                          >
                            <Plus className="h-4 w-4" />
                            Add question / capture
                          </SecondaryButton>

                        </div>

                      </div>

                    </div>

                  ),
                )}

              </div>
            </Panel>


            {/* =====================================================
                VALIDATION + PUBLISH
                ===================================================== */}

            <Panel>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">

                <div className="min-w-0 flex-1">

                  <div className="text-sm font-semibold">
                    Publish this experience
                  </div>

                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    Field answers stay on the CRM Entity record and appear under Data input. They are not dumped into Responsibility records.
                  </div>

                  {problems.length > 0 && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <div className="font-semibold">
                        {problems.length} thing
                        {problems.length === 1 ? "" : "s"} to fix
                      </div>

                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {problems
                          .slice(
                            0,
                            6,
                          )
                          .map(
                            (
                              problem,
                              index,
                            ) => (
                              <li
                                key={`${problem.path}-${index}`}
                              >
                                {
                                  problem.message
                                }
                              </li>
                            ),
                          )}
                      </ul>
                    </div>
                  )}

                </div>


                <div className="flex shrink-0 flex-wrap gap-2">

                  <SecondaryButton
                    type="button"
                    disabled={
                      busy !==
                      null
                    }
                    onClick={() =>
                      void saveDraft()
                    }
                  >
                    {busy ===
                    "save" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}

                    Save draft
                  </SecondaryButton>


                  <PrimaryButton
                    type="button"
                    disabled={
                      busy !==
                        null ||
                      problems.length >
                        0
                    }
                    onClick={() =>
                      void publish()
                    }
                  >
                    {busy ===
                    "publish" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Smartphone className="h-4 w-4" />
                    )}

                    Publish to app
                  </PrimaryButton>

                </div>

              </div>

            </Panel>

          </div>


          {/* =======================================================
              DEVICE PREVIEW
              ======================================================= */}

          <div className="min-w-0">

            <div className="sticky top-5">

              <Panel>

                <div className="flex flex-wrap items-center justify-between gap-2">

                  <div>
                    <div className="text-sm font-semibold">
                      Device preview
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Same Field App contract the phone consumes.
                    </div>
                  </div>


                  <div className="flex rounded-lg border p-1">

                    {(
                      [
                        "android",
                        "ios",
                      ] as Device[]
                    ).map(
                      (
                        item,
                      ) => (
                        <button
                          key={
                            item
                          }
                          type="button"
                          onClick={() =>
                            setDevice(
                              item,
                            )
                          }
                          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                            device ===
                            item
                              ? "bg-foreground text-background"
                              : "text-muted-foreground"
                          }`}
                        >
                          {item ===
                          "ios"
                            ? "iOS"
                            : "Android"}
                        </button>
                      ),
                    )}

                  </div>

                </div>


                <div className="mt-3 flex rounded-lg bg-muted p-1">

                  <button
                    type="button"
                    onClick={() =>
                      setPreviewScreen(
                        "list",
                      )
                    }
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                      previewScreen ===
                      "list"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    CRM list
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPreviewScreen(
                        "detail",
                      )
                    }
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                      previewScreen ===
                      "detail"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    Record screen
                  </button>

                </div>


                <div className="mt-5 flex justify-center">

                  <div
                    className={`relative h-[690px] w-[350px] max-w-full overflow-hidden border-[7px] border-[#1f2321] bg-[#f7f7f4] shadow-xl ${
                      device ===
                      "ios"
                        ? "rounded-[48px]"
                        : "rounded-[32px]"
                    }`}
                  >

                    <div className="flex h-7 items-center justify-center bg-[#f7f7f4]">

                      <div
                        className={
                          device ===
                          "ios"
                            ? "h-4 w-24 rounded-full bg-[#1f2321]"
                            : "h-2 w-2 rounded-full bg-[#1f2321]"
                        }
                      />

                    </div>


                    {previewScreen ===
                    "list" ? (

                      <div className="h-full overflow-hidden px-5 pb-10 pt-4">

                        <div className="text-[28px] font-bold tracking-[-0.04em]">
                          {
                            config.title
                          }
                        </div>

                        <div className="mt-1 text-xs text-zinc-500">
                          Nearest first.
                        </div>


                        <div className="mt-5 rounded-full border bg-white px-4 py-3 text-sm text-zinc-400">
                          Search {
                            config.title
                          }
                        </div>


                        <div className="mt-4 flex gap-2 overflow-hidden">

                          {config.experience.list.lenses
                            .slice(0, 4)
                            .map(
                              (
                                item,
                                index,
                              ) => (
                                <div
                                  key={
                                    item.key
                                  }
                                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] ${
                                    index ===
                                    0
                                      ? "bg-[#1f2321] text-white"
                                      : "bg-white"
                                  }`}
                                >
                                  {
                                    item.label
                                  }
                                </div>
                              ),
                            )}

                        </div>


                        {[0, 1, 2].map(
                          (
                            index,
                          ) => {

                            const stage =
                              config.stages[
                                Math.min(
                                  index,
                                  Math.max(
                                    0,
                                    config.stages
                                      .length -
                                      1,
                                  ),
                                )
                              ];

                            return (
                              <div
                                key={
                                  index
                                }
                                className="mt-3 rounded-[20px] border bg-white p-4"
                              >

                                <div className="flex items-center">

                                  <span
                                    className={`rounded-full px-2 py-1 text-[9px] font-semibold ${
                                      stageToneClass(
                                        stage?.tone ??
                                        "neutral",
                                      )
                                    }`}
                                  >
                                    {stage?.label ??
                                      "New"}
                                  </span>

                                  <span className="ml-auto text-base font-bold">
                                    {index ===
                                    0
                                      ? "350 m"
                                      : `${index + 1}.${index} km`}
                                  </span>

                                </div>


                                <div className="mt-3 text-sm font-semibold">
                                  {config.titleField
                                    ? `${entity.title} ${index + 1}`
                                    : `Record ${index + 1}`}
                                </div>


                                <div className="mt-1 text-[11px] text-zinc-500">
                                  {config.subtitleFields.length
                                    ? config.subtitleFields
                                        .map(
                                          (
                                            key,
                                          ) =>
                                            entity.fieldDefinitions.find(
                                              (
                                                field,
                                              ) =>
                                                field.key ===
                                                key,
                                            )?.label ??
                                            key,
                                        )
                                        .join(
                                          " · ",
                                        )
                                    : "Assigned to you"}
                                </div>

                              </div>
                            );
                          },
                        )}

                      </div>

                    ) : (

                      <div className="h-full overflow-hidden px-5 pb-10 pt-3">

                        <div className="h-[120px] rounded-[20px] bg-gradient-to-br from-zinc-200 to-zinc-300 p-4">

                          <div className="flex h-full items-center justify-center">

                            <div className="rounded-full bg-[#1f2321] p-3 text-white">
                              <Smartphone className="h-5 w-5" />
                            </div>

                          </div>

                        </div>


                        <div className="mt-4 flex items-center">

                          <span className="rounded-full bg-blue-100 px-2 py-1 text-[9px] font-semibold text-blue-800">
                            {
                              config.stages[
                                0
                              ]?.label ??
                              "New"
                            }
                          </span>

                          {config.locationField && (
                            <span className="ml-auto text-[9px] font-semibold">
                              350 M AWAY
                            </span>
                          )}

                        </div>


                        <div className="mt-3 text-xl font-bold tracking-[-0.03em]">
                          Sample {
                            entity.title
                          }
                        </div>


                        <div className="mt-1 text-xs text-zinc-500">
                          Live CRM record
                        </div>


                        {config.locationField && (
                          <div className="mt-4 grid grid-cols-2 gap-2">

                            <div className="rounded-xl bg-[#1f2321] px-3 py-3 text-center text-[10px] font-bold text-white">
                              NAVIGATE
                            </div>

                            <div className="rounded-xl border bg-white px-3 py-3 text-center text-[10px] font-bold">
                              COPY LINK
                            </div>

                          </div>
                        )}


                        <div className="mt-6 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                          Steps
                        </div>


                        <div className="mt-2 space-y-2">

                          {config.sections
                            .slice(
                              0,
                              6,
                            )
                            .map(
                              (
                                section,
                                index,
                              ) => (
                                <div
                                  key={
                                    section.key
                                  }
                                  className="flex min-h-[58px] items-center rounded-[18px] border bg-white px-3 py-2.5"
                                >

                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-800 text-[10px] font-bold">
                                    {
                                      index +
                                      1
                                    }
                                  </div>

                                  <div className="ml-3 min-w-0 flex-1">

                                    <div className="truncate text-xs font-semibold">
                                      {
                                        section.title
                                      }
                                    </div>

                                    <div className="mt-0.5 truncate text-[9px] text-zinc-500">
                                      {section.hint ??
                                        `${collectingCount(section)} questions`}
                                    </div>

                                  </div>

                                  <div className="ml-2 text-zinc-400">
                                    ›
                                  </div>

                                </div>
                              ),
                            )}

                        </div>

                      </div>

                    )}

                  </div>

                </div>


                <div className="mt-5 rounded-xl border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                  Publish writes the existing <span className="font-mono">fieldApp</span> config. Flutter already reads this contract, and management results already appear in <strong>Data input</strong>.
                </div>

              </Panel>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
