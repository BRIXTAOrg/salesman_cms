import { assertCmsCanControlCapability } from "./capability-registry";
import type {
  DeviceRuntimeSnapshot,
  RuntimeChangeSet,
  RuntimeManifest,
} from "./runtime-types";

function unique(values: string[]) {
  return [...new Set(values)];
}

/**
 * Pure desired-state reconciliation.
 *
 * This function NEVER deletes business records. It only describes changes to
 * runtime providers/native feature visibility/cache.
 */
export function calculateRuntimeChanges(
  current: DeviceRuntimeSnapshot,
  desired: RuntimeManifest,
): RuntimeChangeSet {
  const desiredProviders = desired.featureSlots.map((item) => item.provider);
  const currentProviders = current.activeProviders;

  const installProviders = desiredProviders.filter(
    (item) => !currentProviders.includes(item),
  );
  const removeProviders = currentProviders.filter(
    (item) => !desiredProviders.includes(item),
  );

  const enableNative: string[] = [];
  const disableNative: string[] = [];

  for (const state of desired.capabilities) {
    if (!state.key.startsWith("native.")) continue;

    const currentlyEnabled = current.nativeCapabilityStates[state.key] === true;
    if (state.enabled && !currentlyEnabled) {
      assertCmsCanControlCapability(state.key);
      enableNative.push(state.key);
    }
    if (!state.enabled && currentlyEnabled) {
      assertCmsCanControlCapability(state.key);
      disableNative.push(state.key);
    }
  }

  return {
    fromGeneration: current.installedGeneration,
    toGeneration: desired.generation,
    installProviders: unique(installProviders),
    removeProviders: unique(removeProviders),
    enableNative: unique(enableNative),
    disableNative: unique(disableNative),
    requiresRuntimeCacheReset:
      current.installedGeneration !== desired.generation ||
      installProviders.length > 0 ||
      removeProviders.length > 0 ||
      enableNative.length > 0 ||
      disableNative.length > 0,
    preserveServerData: true,
    syncPendingMutationsFirst: true,
  };
}
