import type { ResolvedRoleContext } from "@/lib/roles/role-context-types";
import type {
  ResolvedResponsibilityRuntime,
  RuntimeCapabilityState,
  RuntimeFeatureSlot,
  RuntimeManifest,
  RuntimeMode,
} from "./runtime-types";
import { assertCmsCanControlCapability } from "./capability-registry";

export type BuildRuntimeManifestInput = {
  generation: number;
  mode: RuntimeMode;
  roleContext: ResolvedRoleContext;
  responsibilities: ResolvedResponsibilityRuntime[];

  nativeOverrides?: Record<string, boolean>;

  /**
   * Maps logical slots such as "attendance" to the provider that should render
   * them. Example: attendance -> responsibility.attendance.12
   */
  featureSlots?: RuntimeFeatureSlot[];
};

export function buildRuntimeManifest(
  input: BuildRuntimeManifestInput,
): RuntimeManifest {
  const capabilities: RuntimeCapabilityState[] = Object.entries(
    input.nativeOverrides ?? {},
  ).map(([key, enabled]) => {
    assertCmsCanControlCapability(key);
    return { key, enabled };
  });

  return {
    manifestVersion: 1,
    generation: input.generation,
    mode: input.mode,
    generatedAt: new Date().toISOString(),
    user: {
      id: input.roleContext.user.id,
      roleId: input.roleContext.activeRole.id,
      roleLabel: input.roleContext.activeRole.label,
    },
    roleContext: input.roleContext,
    responsibilities: input.responsibilities,
    capabilities,
    featureSlots: input.featureSlots ?? [],
    resetPolicy: {
      preserveServerData: true,
      syncPendingMutationsFirst: true,
      clearLocalRuntimeCache: true,
    },
  };
}
