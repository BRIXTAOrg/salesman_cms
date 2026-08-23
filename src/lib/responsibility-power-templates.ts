import templateData from "@/lib/responsibility-power-templates.json";
import type {
  ResponsibilityBuilderMode,
  ResponsibilityExtensionConfig,
} from "@/lib/platform-vnext-types";

export type ResponsibilityTemplateDefinition = {
  key: string;
  mode: ResponsibilityBuilderMode;
  title: string;
  description: string;
  setupNotes: string[];
  base: {
    title: string;
    description: string;
    icon: string;
    config: Record<string, unknown>;
  };
  extension: ResponsibilityExtensionConfig;
};

export const RESPONSIBILITY_TEMPLATES =
  templateData.templates as ResponsibilityTemplateDefinition[];

export function findResponsibilityTemplate(key: string) {
  return RESPONSIBILITY_TEMPLATES.find((template) => template.key === key) ?? null;
}
