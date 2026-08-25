import type {
  ResolvedRoleContext,
  WorkflowResolution,
} from "@/lib/roles/role-context-types";
import type { CompiledResponsibilityManifest } from "@/lib/platform-vnext-types";

export type RuntimeMode = "prototype" | "published";

export type RuntimeCapabilityOwnership = "core" | "native" | "dynamic";

export type RuntimeCapabilityDefinition = {
  key: string;
  ownership: RuntimeCapabilityOwnership;
  cmsControllable: boolean;
  storesBusinessData: boolean;
  replacementSlot?: string;
  description: string;
};

export type RuntimeCapabilityState = {
  key: string;
  enabled: boolean;
  provider?: string;
};

export type RuntimeFeatureSlot = {
  slot: string;
  provider: string;
  previousProvider?: string | null;
};

export type ResolvedResponsibilityRuntime = {
  responsibilityId: number;
  responsibilityKey: string;
  responsibilityTitle: string;
  version: number;
  manifest: CompiledResponsibilityManifest;

  targetRoleId: number;
  context: {
    userId: number;
    roleId: number;
    managerUserId?: number | null;
    department?: string | null;
    designation?: string | null;
    area?: string | null;
    zone?: string | null;
  };

  workflow: {
    approval: WorkflowResolution;
    review: WorkflowResolution;
    escalation: WorkflowResolution;
    handoff: WorkflowResolution;
  };
};

export type RuntimeManifest = {
  manifestVersion: 1;
  generation: number;
  mode: RuntimeMode;
  generatedAt: string;

  user: {
    id: number;
    roleId: number;
    roleLabel: string;
  };

  roleContext: ResolvedRoleContext;

  responsibilities: ResolvedResponsibilityRuntime[];

  capabilities: RuntimeCapabilityState[];
  featureSlots: RuntimeFeatureSlot[];

  /**
   * Server/business data is never part of a runtime reset. Flutter may clear
   * cached UI and configuration but must sync pending mutations before applying
   * a new generation.
   */
  resetPolicy: {
    preserveServerData: true;
    syncPendingMutationsFirst: true;
    clearLocalRuntimeCache: true;
  };
};

export type DeviceRuntimeSnapshot = {
  installedGeneration: number;
  activeProviders: string[];
  nativeCapabilityStates: Record<string, boolean>;
};

export type RuntimeChangeSet = {
  fromGeneration: number;
  toGeneration: number;
  installProviders: string[];
  removeProviders: string[];
  enableNative: string[];
  disableNative: string[];
  requiresRuntimeCacheReset: boolean;
  preserveServerData: true;
  syncPendingMutationsFirst: true;
};
