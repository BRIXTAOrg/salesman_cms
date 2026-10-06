"use client";

import {
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import type {
  BuilderAiMode,
} from "@/lib/builder-ai-intent-context";

import {
  textareaClass,
} from "./primitives";


type Props = {
  kind:
    | "app"
    | "logic";

  value: string;

  onChange:
    (value: string) =>
      void;

  mode:
    BuilderAiMode;

  onModeChange:
    (
      mode:
        BuilderAiMode,
    ) => void;

  inventory?:
    string[];

  contextItems?:
    string[];

  /** BRIXTA_UI_V2: no card or heading — for use inside a dialog step. */
  bare?: boolean;
};


const APP_MODES: Array<{
  id: BuilderAiMode;
  label: string;
  description: string;
}> = [
  {
    id: "create",
    label: "Create",
    description:
      "Build a complete app from this brief.",
  },
  {
    id: "modify",
    label: "Modify",
    description:
      "Change only what you ask for.",
  },
  {
    id: "restyle",
    label: "Restyle",
    description:
      "Change the look while preserving behaviour.",
  },
  {
    id: "logic",
    label: "Behaviour",
    description:
      "Describe what should happen.",
  },
];


const LOGIC_MODES: Array<{
  id: BuilderAiMode;
  label: string;
  description: string;
}> = [
  {
    id: "logic",
    label: "Generate",
    description:
      "Build WHEN → IF → THEN behaviour.",
  },
  {
    id: "modify",
    label: "Modify",
    description:
      "Change only the requested logic.",
  },
];


const STYLES = [
  "Editorial",
  "Minimal",
  "Executive",
  "Industrial",
  "Luxury",
  "Monochrome",
  "High Contrast",
  "Dense Operations",
];


const TYPOGRAPHY = [
  "Editorial serif headings",
  "Modern sans",
  "Geometric",
  "Humanist",
  "Technical",
  "Classic serif",
];


function appendIntent(
  current: string,
  intent: string,
) {
  if (
    current
      .toLowerCase()
      .includes(
        intent.toLowerCase(),
      )
  ) {
    return current;
  }

  const clean =
    current.trim();

  return clean
    ? `${clean}\n${intent}`
    : intent;
}


export function AiBuilderBrief({
  kind,
  value,
  onChange,
  mode,
  onModeChange,
  inventory = [],
  contextItems = [],
  bare = false,
}: Props) {

  const modes =
    kind === "app"
      ? APP_MODES
      : LOGIC_MODES;


  const activeMode =
    modes.find(
      (item) =>
        item.id === mode,
    ) ?? modes[0];


  return (
    <section className={bare ? "brixta-ai-compact brixta-ai-bare" : "brixta-ai-compact"}>

      {/* =====================================================
          HEADER
          ===================================================== */}

      {!bare && (
      <div className="brixta-ai-compact-header">

        <div className="flex min-w-0 items-center gap-2">

          <span className="brixta-ai-icon">

            <Sparkles className="h-4 w-4" />

          </span>


          <div className="min-w-0">

            <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">

              {kind === "app"
                ? "Generate with AI"
                : "Talk with AI"}

            </div>


            <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-foreground">

              {kind === "app"
                ? "Describe the app exactly the way you want it."
                : "Tell AI exactly what should change."}

            </h2>

          </div>

        </div>


        <div className="brixta-ai-trust">

          <ShieldCheck className="h-3.5 w-3.5" />

          Uses existing company data

        </div>

      </div>
      )}



      {/* =====================================================
          MODE — SEGMENTED, NOT FOUR CARDS
          ===================================================== */}

      <div className="brixta-ai-body">

        <div className="brixta-ai-mode-tabs">

          {modes.map(
            (item) => {

              const active =
                item.id === mode;

              return (
                <button
                  key={item.id}

                  type="button"

                  data-active={
                    active
                      ? "true"
                      : "false"
                  }

                  onClick={() =>
                    onModeChange(
                      item.id,
                    )
                  }
                >

                  {item.label}

                </button>
              );

            },
          )}

        </div>


        <div className="brixta-ai-mode-hint">

          {activeMode?.description}

        </div>



        {/* =====================================================
            THE BRIEF IS THE HERO
            ===================================================== */}

        <div className="brixta-ai-brief-field">

          <div className="brixta-ai-field-head">

            <span>
              Your brief
            </span>

            <span>
              {value.length.toLocaleString()}
              /6,000
            </span>

          </div>


          <textarea
            value={value}

            onChange={(event) =>
              onChange(
                event.target.value,
              )
            }

            maxLength={6000}

            rows={6}

            placeholder={
              kind === "app"

                ? "Tell BRIXTA what the employee should do. Example: Build a Dealer Visit app. Let the salesman choose a dealer, capture GPS and a proof photo, enter order quantity and follow-up date, then complete the visit."

                : "Describe the behaviour in normal language. Example: Require manager approval when order quantity is above 500 bags. Preserve everything else."
            }

            className={`${textareaClass} brixta-ai-textarea`}
          />

        </div>



        {/* =====================================================
            SHRINKING STACKS
            ===================================================== */}

        {kind === "app" && (

          <>
            <details className="brixta-ai-stack">

              <summary>

                <div>

                  <span className="brixta-ai-stack-title">
                    Style
                  </span>

                  <span className="brixta-ai-stack-preview">
                    Minimal · Executive · Editorial
                  </span>

                </div>


                <ChevronRight className="brixta-ai-stack-chevron h-4 w-4" />

              </summary>


              <div className="brixta-ai-stack-body">

                <div className="brixta-ai-chip-grid">

                  {STYLES.map(
                    (style) => (

                      <button
                        key={style}

                        type="button"

                        onClick={() =>
                          onChange(
                            appendIntent(
                              value,
                              `Look: ${style}.`,
                            ),
                          )
                        }
                      >

                        {style}

                      </button>

                    ),
                  )}

                </div>

              </div>

            </details>



            <details className="brixta-ai-stack">

              <summary>

                <div>

                  <span className="brixta-ai-stack-title">
                    Typography
                  </span>

                  <span className="brixta-ai-stack-preview">
                    Modern sans
                  </span>

                </div>


                <ChevronRight className="brixta-ai-stack-chevron h-4 w-4" />

              </summary>


              <div className="brixta-ai-stack-body">

                <div className="brixta-ai-chip-grid">

                  {TYPOGRAPHY.map(
                    (style) => (

                      <button
                        key={style}

                        type="button"

                        onClick={() =>
                          onChange(
                            appendIntent(
                              value,
                              `Typography: ${style}.`,
                            ),
                          )
                        }
                      >

                        {style}

                      </button>

                    ),
                  )}

                </div>

              </div>

            </details>
          </>

        )}



        <details className="brixta-ai-stack">

          <summary>

            <div>

              <span className="brixta-ai-stack-title">
                AI Context
              </span>

              <span className="brixta-ai-stack-preview">
                {contextItems.length}
                {" "}
                source
                {contextItems.length === 1
                  ? ""
                  : "s"}
              </span>

            </div>


            <ChevronRight className="brixta-ai-stack-chevron h-4 w-4" />

          </summary>


          <div className="brixta-ai-stack-body">

            {contextItems.length > 0 ? (

              <div className="brixta-ai-chip-grid">

                {contextItems.map(
                  (item) => (

                    <span
                      key={item}
                      className="brixta-ai-context-chip"
                    >

                      {item}

                    </span>

                  ),
                )}

              </div>

            ) : (

              <div className="text-xs text-muted-foreground">

                No additional context sources.

              </div>

            )}

          </div>

        </details>



        <details className="brixta-ai-stack">

          <summary>

            <div>

              <span className="brixta-ai-stack-title">
                Available building blocks
              </span>

              <span className="brixta-ai-stack-preview">
                {inventory.length}
                {" "}
                group
                {inventory.length === 1
                  ? ""
                  : "s"}
              </span>

            </div>


            <ChevronRight className="brixta-ai-stack-chevron h-4 w-4" />

          </summary>


          <div className="brixta-ai-stack-body">

            {inventory.length > 0 ? (

              <div className="brixta-ai-chip-grid">

                {inventory.map(
                  (item) => (

                    <span
                      key={item}
                      className="brixta-ai-context-chip"
                    >

                      {item}

                    </span>

                  ),
                )}

              </div>

            ) : (

              <div className="text-xs text-muted-foreground">

                No registered building-block groups.

              </div>

            )}

          </div>

        </details>



        {/* =====================================================
            TINY TRUST FOOTER
            ===================================================== */}

        <div className="brixta-ai-footer">

          <ShieldCheck className="h-3.5 w-3.5" />

          <span>
            Existing Roles, Employees, Data Sources and stable IDs are preserved.
          </span>

        </div>

      </div>

    </section>
  );
}
