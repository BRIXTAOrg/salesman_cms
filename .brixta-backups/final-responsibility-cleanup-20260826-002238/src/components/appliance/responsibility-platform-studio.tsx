"use client";

import { useState } from "react";
import {
  Blocks,
  Boxes,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Database,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import ResponsibilitiesClient from "./responsibilities-client";
import DataSourcesClient from "./data-sources-client";
import EntitiesClient from "./entities-client";
import ResponsibilityKernelClient from "./responsibility-kernel-client";
import ResponsibilityPowerClient from "./responsibility-power-client";
import RolesVNextClient from "./roles-vnext-client";

type TabKey = "studio" | "entities" | "data" | "roles";
type LegacyKey = "form" | "power";

const tabs = [
  {
    key: "studio" as const,
    label: "STUDIO",
    description: "Build app + operational behavior",
    icon: BrainCircuit,
  },
  {
    key: "entities" as const,
    label: "ENTITIES",
    description: "Reusable business things",
    icon: Boxes,
  },
  {
    key: "data" as const,
    label: "DATA",
    description: "Connect existing records",
    icon: Database,
  },
  {
    key: "roles" as const,
    label: "ROLES",
    description: "Who can act and what they can do",
    icon: ShieldCheck,
  },
];

export default function ResponsibilityPlatformStudio() {
  const [tab, setTab] = useState<TabKey>("studio");
  const [showLegacy, setShowLegacy] = useState(false);
  const [legacy, setLegacy] = useState<LegacyKey>("form");

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden">
      {/* Deliberately NOT sticky: a second sticky toolbar used to cover/cut Studio content. */}
      <div className="relative z-10 min-w-0 border-b bg-background px-3 py-3 sm:px-4 md:px-6">
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 lg:grid-cols-4">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = item.key === tab && !showLegacy;
            return (
              <button
                type="button"
                key={item.key}
                onClick={() => {
                  setShowLegacy(false);
                  setTab(item.key);
                }}
                className={[
                  "min-w-0 rounded-lg border px-3 py-3 text-left transition",
                  active
                    ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20"
                    : "hover:bg-muted/50",
                ].join(" ")}
              >
                <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                <div className="mt-1 hidden text-[11px] leading-snug text-muted-foreground sm:block">
                  {item.description}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setShowLegacy((value) => !value)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
          >
            <Wrench className="h-3.5 w-3.5" />
            Legacy / developer tools
            {showLegacy ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {showLegacy && (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border bg-muted/10 p-2">
            <button
              type="button"
              onClick={() => setLegacy("form")}
              className={[
                "rounded-md border px-3 py-2 text-left text-xs",
                legacy === "form" ? "border-primary bg-primary/[0.06]" : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 font-semibold">
                <Blocks className="h-3.5 w-3.5" />
                Old Form Canvas
              </div>
              <div className="mt-1 text-muted-foreground">Temporary compatibility editor.</div>
            </button>
            <button
              type="button"
              onClick={() => setLegacy("power")}
              className={[
                "rounded-md border px-3 py-2 text-left text-xs",
                legacy === "power" ? "border-primary bg-primary/[0.06]" : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 font-semibold">
                <Wrench className="h-3.5 w-3.5" />
                Power V2
              </div>
              <div className="mt-1 text-muted-foreground">Developer-only compatibility controls.</div>
            </button>
          </div>
        )}
      </div>

      {showLegacy ? (
        legacy === "form" ? (
          <div className="min-w-0 overflow-x-auto"><ResponsibilitiesClient /></div>
        ) : (
          <div className="w-full min-w-0 px-3 pb-6 pt-5 sm:px-4 md:px-6"><ResponsibilityPowerClient /></div>
        )
      ) : (
        <>
          {tab === "studio" && (
            <div className="w-full min-w-0 px-3 pb-6 pt-5 sm:px-4 md:px-6"><ResponsibilityKernelClient /></div>
          )}
          {tab === "entities" && (
            <div className="w-full min-w-0 px-3 pb-6 pt-5 sm:px-4 md:px-6"><EntitiesClient /></div>
          )}
          {tab === "data" && (
            <div className="w-full min-w-0 px-3 pb-6 pt-5 sm:px-4 md:px-6"><DataSourcesClient /></div>
          )}
          {tab === "roles" && (
            <div className="w-full min-w-0 px-3 pb-6 pt-5 sm:px-4 md:px-6"><RolesVNextClient /></div>
          )}
        </>
      )}
    </div>
  );
}
