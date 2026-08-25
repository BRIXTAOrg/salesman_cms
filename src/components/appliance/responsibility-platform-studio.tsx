"use client";

import { useState } from "react";
import { Boxes, BrainCircuit, Database, ShieldCheck } from "lucide-react";

import DataSourcesClient from "./data-sources-client";
import EntitiesClient from "./entities-client";
import ResponsibilityKernelClient from "./responsibility-kernel-client";
import RolesVNextClient from "./roles-vnext-client";

type TabKey = "studio" | "entities" | "data" | "roles";

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

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden">
      <div className="relative z-10 min-w-0 border-b bg-background px-3 py-3 sm:px-4 md:px-6">
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 lg:grid-cols-4">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = item.key === tab;

            return (
              <button
                type="button"
                key={item.key}
                onClick={() => setTab(item.key)}
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
      </div>

      {tab === "studio" && (
        <div className="w-full min-w-0 px-3 pb-6 pt-5 sm:px-4 md:px-6">
          <ResponsibilityKernelClient />
        </div>
      )}

      {tab === "entities" && (
        <div className="w-full min-w-0 px-3 pb-6 pt-5 sm:px-4 md:px-6">
          <EntitiesClient />
        </div>
      )}

      {tab === "data" && (
        <div className="w-full min-w-0 px-3 pb-6 pt-5 sm:px-4 md:px-6">
          <DataSourcesClient />
        </div>
      )}

      {tab === "roles" && (
        <div className="w-full min-w-0 px-3 pb-6 pt-5 sm:px-4 md:px-6">
          <RolesVNextClient />
        </div>
      )}
    </div>
  );
}
