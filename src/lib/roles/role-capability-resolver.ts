import {
  BUILDER_CAPABILITY_CATALOG,
  type BuilderCapabilityDefinition,
} from "./builder-capability-catalog";
import type {
  RoleCapabilityKey,
  RoleContextDefinition,
} from "./role-context-types";

export type ResolvedBuilderCapabilities = {
  commonKeys: RoleCapabilityKey[];
  common: BuilderCapabilityDefinition[];
  roleSpecific: Array<{
    roleId: number;
    roleLabel: string;
    keys: RoleCapabilityKey[];
    capabilities: BuilderCapabilityDefinition[];
  }>;
};

/**
 * Returns the safe common palette for a Responsibility targeting multiple roles.
 *
 * The builder can always show `common`. `roleSpecific` is useful for an
 * advanced "only for this role" group, but it must never silently add a
 * component that another target role cannot run.
 */
export function resolveBuilderCapabilities(
  definitions: RoleContextDefinition[],
): ResolvedBuilderCapabilities {
  if (definitions.length === 0) {
    return { commonKeys: [], common: [], roleSpecific: [] };
  }

  const sets = definitions.map((item) => new Set(item.capabilities));
  const commonKeys = definitions[0].capabilities.filter((key) =>
    sets.every((set) => set.has(key)),
  );

  return {
    commonKeys,
    common: BUILDER_CAPABILITY_CATALOG.filter((item) =>
      commonKeys.includes(item.key),
    ),
    roleSpecific: definitions.map((definition) => {
      const specificKeys = definition.capabilities.filter(
        (key) => !commonKeys.includes(key),
      );
      return {
        roleId: definition.roleId,
        roleLabel: definition.label,
        keys: specificKeys,
        capabilities: BUILDER_CAPABILITY_CATALOG.filter((item) =>
          specificKeys.includes(item.key),
        ),
      };
    }),
  };
}
