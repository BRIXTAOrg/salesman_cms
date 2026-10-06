import {
  redirect,
} from "next/navigation";

/*
 * BRIXTA_ONE_BUILDER_V1
 *
 * The old drag/drop Responsibility editor is retired.
 *
 * Every authoring workflow now enters the canonical:
 *
 *   ResponsibilityPlatformStudio
 *       -> ResponsibilityKernelClient
 *       -> ResponsibilityAppBuilder
 *
 * Old bookmarks remain safe through this redirect.
 */
export default function AllResponsibilitiesPage() {
  redirect(
    "/dashboard/workspace/responsibilities",
  );
}
