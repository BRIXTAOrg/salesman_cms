# Graph Report - salesman_cms  (2026-08-26)

## Corpus Check
- 229 files · ~231,005 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2247 nodes · 5282 edges · 187 communities (101 shown, 86 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 75 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f7276b56`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- hasPermission
- sidebar.tsx
- signup/page.tsx
- cn
- schema.ts
- src/components/appliance/responsibilities-client.tsx
- src/lib/responsibility-kernel-types.ts
- platformVNextSchema.ts
- primitives.tsx
- data-table-reusable.tsx
- appliance-types.ts
- utils.ts
- src/lib/responsibility-kernel-compiler.ts
- entitlements.ts
- compilerOptions
- portfolio/route.ts
- record-output.tsx
- apiJson
- button.tsx
- ensureTenantPlatformVNext
- remove-attendance-starter-20260826-034904/src/components/appliance/responsibilities-client.tsx
- all-responsibilities-delete-20260826-003442/src/components/appliance/responsibilities-client.tsx
- platform-vnext-types.ts
- responsibility-templates/route.ts
- src/components/appliance/responsibility-app-builder.tsx
- ResponsibilityAppBuilder
- components.json
- responsibility-power-client.tsx
- src/lib/workspace-manifest.ts
- Reusable-constants.ts
- dependencies
- inline-human-review-20260826-040158/src/components/appliance/responsibility-app-builder.tsx
- applianceSchema.ts
- download-utils.ts
- clone
- entities-client.tsx
- responsibility-power-templates.ts
- devDependencies
- responsibility-semantic-compiler.ts
- lucide-react
- ActionInspector
- responsibility-power-catalog.ts
- tenant-provisioner.ts
- DashboardAccessClient
- package.json
- toggle-group.tsx
- scripts
- ResponsibilityWorldEditor
- eslint.config.mjs
- app/layout.tsx
- AccountSwitcher
- src/components/appliance/responsibility-event-editor.tsx
- main
- organization/page.tsx
- generic-json-table.tsx
- baseline-browser-mapping
- class-variance-authority
- clsx
- @corbe30/fortune-excel
- csv-stringify
- date-fns
- @dnd-kit/core
- @dnd-kit/modifiers
- @dnd-kit/sortable
- @dnd-kit/utilities
- dotenv
- drizzle-orm
- drizzle-zod
- employee-own-history-v2-20260826-042335/src/components/appliance/responsibility-app-builder.tsx
- eslint-config-next
- employee-own-history-v2-20260826-042335/src/lib/responsibility-kernel-types.ts
- exceljs
- @fortune-sheet/react
- jose
- json2csv
- jsonwebtoken
- leaflet
- semantic-builder-v1-20260826-024801/src/components/appliance/responsibility-app-builder.tsx
- @neondatabase/serverless
- next-auth
- cors
- next.config.ts
- next-themes
- nodemailer
- pg
- @radix-ui/react-alert-dialog
- @radix-ui/react-checkbox
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-label
- @radix-ui/react-popover
- @radix-ui/react-progress
- @radix-ui/react-radio-group
- @radix-ui/react-scroll-area
- @radix-ui/react-select
- @radix-ui/react-separator
- @radix-ui/react-slot
- @radix-ui/react-tabs
- @radix-ui/react-toggle
- @radix-ui/react-toggle-group
- @radix-ui/react-tooltip
- react
- react-day-picker
- @react-email/components
- react-leaflet
- resend
- socket.io
- socket.io-client
- sonner
- @tabler/icons-react
- tailwind-merge
- @tanstack/react-table
- semantic-runtime-v2-20260826-033804/src/components/appliance/responsibility-app-builder.tsx
- vaul
- ws
- zod
- recharts
- tailwindcss
- ResponsibilityPowerClient
- tw-animate-css
- @types/json2csv
- @types/jsonwebtoken
- @types/leaflet
- @types/node
- @types/nodemailer
- @types/react
- @types/react-dom
- @types/ws
- postcss.config.mjs
- README.md
- fortune-sheet.d.ts
- start.sh
- responsibility-kernel-catalog.ts
- AssignmentsClient
- auth.ts
- @eslint/eslintrc
- @next/bundle-analyzer
- chart-area-reusable.tsx
- runtime-types.ts
- configString
- ResponsibilityAppBuilder
- configString
- ResponsibilityAppBuilder
- configString
- configString
- ResponsibilityAppBuilder
- role-context-types.ts
- ResponsibilityAppBuilder
- configString
- clone
- CaptureInspector
- clone
- clone
- clone
- ActionInspector
- src/components/appliance/responsibility-kernel-client.tsx
- RolesVNextClient
- initial-state-runtime-20260826-022320/src/lib/responsibility-kernel-compiler.ts
- semantic-builder-v1-20260826-024801/src/lib/responsibility-kernel-compiler.ts
- role-context-store.ts
- responsibility-intent-graph.ts
- role-context-normalizer.ts
- authoritative-phone-layout-20260825-233239/responsibility-kernel-compiler.ts
- ActionInspector
- ActionInspector
- semantic-runtime-v2-20260826-033804/src/lib/responsibility-kernel-compiler.ts
- Responsibility
- role-capability-resolver.ts
- EffectRow
- EffectRow
- EffectRow
- EffectRow
- role-context-resolver.ts
- final-responsibility-cleanup-20260826-002238/src/components/appliance/responsibility-platform-studio.tsx
- ResponsibilityOutputEditor
- actionEventIds
- StateInspector
- StateInspector
- StateInspector
- eslint
- uuid
- StateInspector

## God Nodes (most connected - your core abstractions)
1. `cn()` - 174 edges
2. `hasPermission()` - 50 edges
3. `apiJson()` - 43 edges
4. `ensureTenantPlatformVNext()` - 41 edges
5. `withTenantDb()` - 28 edges
6. `ResponsibilityKernel` - 26 edges
7. `cx()` - 25 edges
8. `clone()` - 24 edges
9. `ResponsibilityPowerClient()` - 24 edges
10. `clone()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `ResponsibilityAppBuilder()` --calls--> `rankIntentCandidates()`  [EXTRACTED]
  .brixta-backups/employee-own-history-v2-20260826-042335/src/components/appliance/responsibility-app-builder.tsx → src/lib/responsibility-intent-graph.ts
- `ResponsibilityAppBuilder()` --calls--> `suggestRecipeComposition()`  [EXTRACTED]
  .brixta-backups/employee-own-history-v2-20260826-042335/src/components/appliance/responsibility-app-builder.tsx → src/lib/responsibility-intent-graph.ts
- `ResponsibilityAppBuilder()` --calls--> `compileResponsibilitySemantics()`  [EXTRACTED]
  .brixta-backups/employee-own-history-v2-20260826-042335/src/components/appliance/responsibility-app-builder.tsx → src/lib/responsibility-semantic-compiler.ts
- `POST` --calls--> `hasPermission()`  [EXTRACTED]
  .brixta-backups/event-no-action-20260825-213237/src/app/api/platform/responsibility-extensions/[id]/publish/route.ts → src/lib/auth.ts
- `PUT` --calls--> `hasPermission()`  [EXTRACTED]
  .brixta-backups/event-no-action-20260825-213237/src/app/api/platform/responsibility-extensions/[id]/route.ts → src/lib/auth.ts

## Import Cycles
- None detected.

## Communities (187 total, 86 thin omitted)

### Community 0 - "hasPermission"
Cohesion: 0.09
Nodes (34): roles, userRoles, users, approvalPolicyActors, GET, editMappingSchema, POST, editRoleSchema (+26 more)

### Community 1 - "sidebar.tsx"
Cohesion: 0.05
Nodes (47): DashboardShellProps, User, AppSidebar(), icons, Props, SiteHeader(), titleForPath(), Separator() (+39 more)

### Community 2 - "signup/page.tsx"
Cohesion: 0.20
Nodes (13): WelcomeViewProps, LoginPage(), SignupPage(), slugify(), Card(), CardAction(), CardContent(), CardDescription() (+5 more)

### Community 3 - "cn"
Cohesion: 0.06
Nodes (40): Alert(), AlertDescription(), AlertTitle(), alertVariants, AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription() (+32 more)

### Community 4 - "schema.ts"
Cohesion: 0.05
Nodes (43): dailyVisitReports, dealers, distributors, geoTracking, influencers, institutions, journeyBreadcrumbs, journeyOps (+35 more)

### Community 5 - "src/components/appliance/responsibilities-client.tsx"
Cohesion: 0.10
Nodes (43): actionFromDefinition(), ActionProperties(), patch(), setFieldEnabled(), setFieldRequired(), appFromDefinition(), blankAction(), BuilderAction (+35 more)

### Community 6 - "src/lib/responsibility-kernel-types.ts"
Cohesion: 0.12
Nodes (20): CONTEXT_CATALOG, KernelActionKind, KernelActor, KernelActorResolver, KernelCaptureKind, KernelConditionGroup, KernelContext, KernelContextSource (+12 more)

### Community 7 - "platformVNextSchema.ts"
Cohesion: 0.06
Nodes (39): compiledResponsibilityManifests, dataSources, EntityFieldDefinition, entityFieldMemory, entityRecords, entityTypes, platformAuditEvents, platformMeta (+31 more)

### Community 8 - "primitives.tsx"
Cohesion: 0.12
Nodes (28): cx(), formatWhen(), ControlCenterClient(), Credentials, DashboardUser, Discovered, DynamicWorkClient(), capitalizeFirst() (+20 more)

### Community 9 - "data-table-reusable.tsx"
Cohesion: 0.06
Nodes (33): DataTableProps, GlobalFilterBar(), GlobalFilterBarProps, Option, MultiSelect(), DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent() (+25 more)

### Community 10 - "appliance-types.ts"
Cohesion: 0.08
Nodes (35): blankAction(), blankApproval(), BuilderState, BuilderStep, builderStepFromExisting(), enabledOperations(), latestVersion(), localId() (+27 more)

### Community 11 - "utils.ts"
Cohesion: 0.11
Nodes (25): MultiSelectProps, Option, Option, SearchSelectProps, Badge(), badgeVariants, Command(), CommandDialog() (+17 more)

### Community 12 - "src/lib/responsibility-kernel-compiler.ts"
Cohesion: 0.38
Nodes (9): actionToBaseAction(), captureToField(), captureType(), hydrateKernelFromBaseDefinition(), normalizeKey(), requiredState(), resultingState(), ruleForAction() (+1 more)

### Community 13 - "entitlements.ts"
Cohesion: 0.18
Nodes (12): organizationEntitlements, organizations, IMPORTANT:, POST(), IMPORTANT: login must never reactivate a suspended/inactive user., GET(), encrypt(), ENTITLEMENT_KEYS (+4 more)

### Community 14 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, src/generated/prisma (+20 more)

### Community 15 - "portfolio/route.ts"
Cohesion: 0.12
Nodes (16): actionDefinitions, approvalPolicies, workflowDefinitions, workflowInstances, workflowStepDependencies, workflowStepInstances, workflowSteps, workflowVersions (+8 more)

### Community 16 - "record-output.tsx"
Cohesion: 0.19
Nodes (23): formatDateTime(), MapPoint, MapRoute, CardsOutput(), DetailOutput(), displayValue(), fieldsFor(), GalleryOutput() (+15 more)

### Community 17 - "apiJson"
Cohesion: 0.11
Nodes (20): ApprovalsClient(), decide(), apiJson(), DataSourcesClient(), connect(), remove(), EmployeesClient(), createEmployee() (+12 more)

### Community 18 - "button.tsx"
Cohesion: 0.21
Nodes (11): Button(), buttonVariants, Calendar(), CalendarDayButton(), Pagination(), PaginationContent(), PaginationEllipsis(), PaginationLink() (+3 more)

### Community 19 - "ensureTenantPlatformVNext"
Cohesion: 0.12
Nodes (43): Context, kernelFromMetadata(), POST, IMPORTANT: Draft Kernel metadata is the source of truth. The employee app, Context, GET, PUT, Context (+35 more)

### Community 20 - "remove-attendance-starter-20260826-034904/src/components/appliance/responsibilities-client.tsx"
Cohesion: 0.08
Nodes (45): actionFromDefinition(), ActionProperties(), patch(), setFieldEnabled(), setFieldRequired(), appFromDefinition(), blankAction(), blankState() (+37 more)

### Community 21 - "all-responsibilities-delete-20260826-003442/src/components/appliance/responsibilities-client.tsx"
Cohesion: 0.08
Nodes (45): actionFromDefinition(), ActionProperties(), patch(), setFieldEnabled(), setFieldRequired(), appFromDefinition(), blankAction(), blankState() (+37 more)

### Community 22 - "platform-vnext-types.ts"
Cohesion: 0.09
Nodes (21): ConditionOperand, EvidenceBundle, FieldBehaviorPolicy, PlatformDataSourceType, PlatformEntityField, PlatformEntityRecord, PlatformEntityType, ReferenceFilterValue (+13 more)

### Community 23 - "responsibility-templates/route.ts"
Cohesion: 0.12
Nodes (29): GET(), objectValue(), DELETE, entitlementGuard(), GET, isResponsibilityWrite(), isWorkflowWrite(), PATCH (+21 more)

### Community 24 - "src/components/appliance/responsibility-app-builder.tsx"
Cohesion: 0.08
Nodes (23): BrainBar(), compareValues(), CONTEXT_SOURCE_LABELS, DiscoverGroup, DiscoverItem, DiscoverKind, DiscoveryCard(), initialSimulation() (+15 more)

### Community 25 - "ResponsibilityAppBuilder"
Cohesion: 0.20
Nodes (19): addRule(), discoveryItems(), ensureActionEvent(), ensureBaseRule(), normalizeKey(), randomKey(), ResponsibilityAppBuilder(), addAction() (+11 more)

### Community 26 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 27 - "responsibility-power-client.tsx"
Cohesion: 0.12
Nodes (15): ExtensionResponse, RuntimeResponse, StudioTab, TAB_DEFS, ValidateResponse, VersionResponse, ComputedField, FieldMemoryPolicy (+7 more)

### Community 28 - "src/lib/workspace-manifest.ts"
Cohesion: 0.08
Nodes (42): addNav(), BuildWorkspaceInput, buildWorkspaceManifest(), countState(), emptyStepRuntime(), keyForGroup(), mapWorkflow(), navGroups() (+34 more)

### Community 29 - "Reusable-constants.ts"
Cohesion: 0.14
Nodes (11): Locations, Locations, BASE_URL, brands, dealerTypes, JOB_ROLES, JWT_KEY, ORG_ROLES (+3 more)

### Community 30 - "dependencies"
Cohesion: 0.13
Nodes (15): bcryptjs, cmdk, jszip, next, dependencies, bcryptjs, cmdk, jszip (+7 more)

### Community 31 - "inline-human-review-20260826-040158/src/components/appliance/responsibility-app-builder.tsx"
Cohesion: 0.08
Nodes (25): compareValues(), ConditionRow(), CONTEXT_SOURCE_LABELS, ContextInspector(), decodeRef(), DiscoverGroup, DiscoverItem, DiscoverKind (+17 more)

### Community 32 - "applianceSchema.ts"
Cohesion: 0.12
Nodes (18): adminOwnershipRules, applianceAuditLog, approvalRequests, attentionItems, capabilityAssignmentRules, deviceRegistrations, dynamicSubmissions, employeeRuntimeState (+10 more)

### Community 33 - "download-utils.ts"
Cohesion: 0.32
Nodes (11): appendRows(), autoSizeColumns(), estimateWidth(), exportTablesToCSVZip(), generateAndStreamXlsx(), generateAndStreamXlsxMulti(), normalizeCell(), normalizeCells() (+3 more)

### Community 34 - "clone"
Cohesion: 0.30
Nodes (18): addOrReplaceActor(), addOrReplaceContext(), addOrReplaceState(), attendanceEssentialsRecipe(), biometricRecipe(), clone(), conditionalApprovalRecipe(), ensureAction() (+10 more)

### Community 35 - "entities-client.tsx"
Cohesion: 0.17
Nodes (11): EntitiesClient(), create(), EntityField, EntityType, FIELD_TYPES, newField(), normalizeKey(), textareaClass (+3 more)

### Community 36 - "responsibility-power-templates.ts"
Cohesion: 0.40
Nodes (4): ResponsibilityBuilderMode, ResponsibilityExtensionConfig, RESPONSIBILITY_TEMPLATES, ResponsibilityTemplateDefinition

### Community 37 - "devDependencies"
Cohesion: 0.18
Nodes (11): drizzle-kit, devDependencies, drizzle-kit, @tailwindcss/postcss, ts-node, @types/pg, typescript, @tailwindcss/postcss (+3 more)

### Community 38 - "responsibility-semantic-compiler.ts"
Cohesion: 0.15
Nodes (29): actionToBaseAction(), captureToField(), captureType(), compileKernelToBaseDefinition(), hydrateKernelFromBaseDefinition(), normalizeKey(), requiredState(), resultingState() (+21 more)

### Community 40 - "ActionInspector"
Cohesion: 0.16
Nodes (14): actionEventIds(), ActionInspector(), patchAction(), patchConfig(), AutomaticActionInspector(), patchAction(), patchReview(), AutomaticOutputInspector() (+6 more)

### Community 41 - "responsibility-power-catalog.ts"
Cohesion: 0.16
Nodes (16): PlatformDataSource, ResponsibilityOutputRenderer, ResponsibilityValidationIssue, SmartBlockKind, BUILT_IN_DATA_SOURCES, BUILT_IN_SOURCE_KEYS, OUTPUT_RENDERERS, RESPONSIBILITY_MODES (+8 more)

### Community 42 - "tenant-provisioner.ts"
Cohesion: 0.25
Nodes (9): POST(), assertControlPlaneInstalled(), CORE_SQL, DEFAULT_ROLES, provisionCompany(), ProvisionCompanyInput, ROLE_CONTEXT_SQL, runSqlFile() (+1 more)

### Community 44 - "package.json"
Cohesion: 0.29
Nodes (6): name, overrides, @types/react, @types/react-dom, private, version

### Community 45 - "toggle-group.tsx"
Cohesion: 0.43
Nodes (5): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 46 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, check, dev, lint, start

### Community 47 - "ResponsibilityWorldEditor"
Cohesion: 0.29
Nodes (10): actorResolverNeedsTarget(), currentUserResolver(), randomKey(), resolverTargetLabel(), ResponsibilityWorldEditor(), patchActor(), patchContext(), patchObject() (+2 more)

### Community 48 - "eslint.config.mjs"
Cohesion: 0.40
Nodes (4): compat, __dirname, eslintConfig, __filename

### Community 49 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 51 - "src/components/appliance/responsibility-event-editor.tsx"
Cohesion: 0.10
Nodes (24): ConditionEditor(), EffectEditor(), EVENT_KINDS, makeRef(), randomKey(), refDisplay(), refKind(), ResponsibilityEventEditor() (+16 more)

### Community 52 - "main"
Cohesion: 0.83
Nodes (3): main(), remove_path(), Path

### Community 68 - "employee-own-history-v2-20260826-042335/src/components/appliance/responsibility-app-builder.tsx"
Cohesion: 0.08
Nodes (20): compareValues(), CONTEXT_SOURCE_LABELS, DiscoverGroup, DiscoverItem, DiscoverKind, initialSimulation(), initialState(), INTENT_SYNONYMS (+12 more)

### Community 70 - "employee-own-history-v2-20260826-042335/src/lib/responsibility-kernel-types.ts"
Cohesion: 0.07
Nodes (27): KernelAction, KernelActionKind, KernelActor, KernelActorResolver, KernelCapture, KernelCaptureKind, KernelCondition, KernelConditionGroup (+19 more)

### Community 77 - "semantic-builder-v1-20260826-024801/src/components/appliance/responsibility-app-builder.tsx"
Cohesion: 0.09
Nodes (20): compareValues(), CONTEXT_SOURCE_LABELS, DiscoverGroup, DiscoverItem, DiscoverKind, initialSimulation(), initialState(), INTENT_SYNONYMS (+12 more)

### Community 112 - "semantic-runtime-v2-20260826-033804/src/components/appliance/responsibility-app-builder.tsx"
Cohesion: 0.09
Nodes (20): compareValues(), CONTEXT_SOURCE_LABELS, DiscoverGroup, DiscoverItem, DiscoverKind, initialSimulation(), initialState(), INTENT_SYNONYMS (+12 more)

### Community 118 - "ResponsibilityPowerClient"
Cohesion: 0.12
Nodes (18): baseFields(), humanize(), issueTone(), normalizeKey(), objectValue(), randomKey(), ResponsibilityPowerClient(), addComputedField() (+10 more)

### Community 137 - "responsibility-kernel-catalog.ts"
Cohesion: 0.16
Nodes (20): asKernel(), ExtensionResponse, normalizeKey(), ResponsibilityKernelClient(), createResponsibility(), publish(), saveDraft(), targetRoleIdsFrom() (+12 more)

### Community 139 - "auth.ts"
Cohesion: 0.11
Nodes (21): refreshCompanyCache(), GET(), POST(), POST(), SignedOutHomePage(), AuthBoundary(), RefreshDataButton(), RefreshDataButtonProps (+13 more)

### Community 142 - "chart-area-reusable.tsx"
Cohesion: 0.13
Nodes (18): ChartAreaInteractive(), ChartAreaInteractiveProps, ChartDataItem, ChartPieReusable(), ChartPieReusableProps, PIE_COLORS, renderActiveShape(), ChartConfig (+10 more)

### Community 143 - "runtime-types.ts"
Cohesion: 0.17
Nodes (17): CompiledResponsibilityManifest, assertCmsCanControlCapability(), getRuntimeCapability(), isCmsControllableCapability(), RUNTIME_CAPABILITY_REGISTRY, buildRuntimeManifest(), BuildRuntimeManifestInput, calculateRuntimeChanges() (+9 more)

### Community 144 - "configString"
Cohesion: 0.21
Nodes (20): ActorInspector(), patch(), applySimulationEffect(), behaviorChips(), BlockPreview(), captureIcon(), CaptureInspector(), patchConfig() (+12 more)

### Community 145 - "ResponsibilityAppBuilder"
Cohesion: 0.19
Nodes (20): addRule(), discoveryItems(), ensureActionEvent(), ensureBaseRule(), normalizeKey(), randomKey(), ResponsibilityAppBuilder(), addAction() (+12 more)

### Community 146 - "configString"
Cohesion: 0.20
Nodes (20): ActorInspector(), patch(), applySimulationEffect(), behaviorChips(), BlockPreview(), captureIcon(), CaptureInspector(), patchConfig() (+12 more)

### Community 147 - "ResponsibilityAppBuilder"
Cohesion: 0.19
Nodes (20): addRule(), discoveryItems(), ensureActionEvent(), ensureBaseRule(), normalizeKey(), randomKey(), ResponsibilityAppBuilder(), addAction() (+12 more)

### Community 148 - "configString"
Cohesion: 0.20
Nodes (20): ActorInspector(), patch(), applySimulationEffect(), behaviorChips(), BlockPreview(), captureIcon(), CaptureInspector(), patchConfig() (+12 more)

### Community 149 - "configString"
Cohesion: 0.21
Nodes (20): ActorInspector(), patch(), applySimulationEffect(), behaviorChips(), BlockPreview(), captureIcon(), CaptureInspector(), patchConfig() (+12 more)

### Community 150 - "ResponsibilityAppBuilder"
Cohesion: 0.20
Nodes (19): addRule(), discoveryItems(), ensureActionEvent(), ensureBaseRule(), normalizeKey(), randomKey(), ResponsibilityAppBuilder(), addAction() (+11 more)

### Community 151 - "role-context-types.ts"
Cohesion: 0.14
Nodes (18): BASE_ROLE_CAPABILITIES, ResolvedRoleContext, ROLE_CONTEXT_SCHEMA_VERSION, RoleId, RoleRelationship, RoleRelationshipKind, RoleTargetResolver, RoleVisibilityRule (+10 more)

### Community 152 - "ResponsibilityAppBuilder"
Cohesion: 0.22
Nodes (18): addRule(), ensureActionEvent(), ensureBaseRule(), normalizeKey(), randomKey(), ResponsibilityAppBuilder(), addAction(), addActor() (+10 more)

### Community 153 - "configString"
Cohesion: 0.20
Nodes (18): applySimulationEffect(), behaviorChips(), BlockPreview(), captureIcon(), configBoolean(), configNumber(), configString(), discoveryItems() (+10 more)

### Community 154 - "clone"
Cohesion: 0.30
Nodes (18): addOrReplaceActor(), addOrReplaceContext(), addOrReplaceState(), attendanceEssentialsRecipe(), biometricRecipe(), clone(), conditionalApprovalRecipe(), ensureAction() (+10 more)

### Community 155 - "CaptureInspector"
Cohesion: 0.15
Nodes (17): ActionInspector(), patchAction(), patchConfig(), ActorInspector(), patch(), AutomaticActionInspector(), patchAction(), AutomaticOutputInspector() (+9 more)

### Community 156 - "clone"
Cohesion: 0.30
Nodes (18): addOrReplaceActor(), addOrReplaceContext(), addOrReplaceState(), attendanceEssentialsRecipe(), biometricRecipe(), clone(), conditionalApprovalRecipe(), ensureAction() (+10 more)

### Community 157 - "clone"
Cohesion: 0.30
Nodes (18): addOrReplaceActor(), addOrReplaceContext(), addOrReplaceState(), attendanceEssentialsRecipe(), biometricRecipe(), clone(), conditionalApprovalRecipe(), ensureAction() (+10 more)

### Community 158 - "clone"
Cohesion: 0.30
Nodes (18): addOrReplaceActor(), addOrReplaceContext(), addOrReplaceState(), attendanceEssentialsRecipe(), biometricRecipe(), clone(), conditionalApprovalRecipe(), ensureAction() (+10 more)

### Community 159 - "ActionInspector"
Cohesion: 0.16
Nodes (14): actionEventIds(), ActionInspector(), patchAction(), patchConfig(), AutomaticActionInspector(), patchAction(), patchReview(), AutomaticOutputInspector() (+6 more)

### Community 160 - "src/components/appliance/responsibility-kernel-client.tsx"
Cohesion: 0.25
Nodes (13): asKernel(), builderActionOperation(), ExtensionResponse, inlineReviewIntent(), inlineReviewWorkflowKey(), normalizeKey(), ResponsibilityKernelClient(), createResponsibility() (+5 more)

### Community 161 - "RolesVNextClient"
Cohesion: 0.17
Nodes (7): RolesVNextClient(), remove(), rename(), setWorkflow(), workflowValue(), targetFrom(), targetValue()

### Community 162 - "initial-state-runtime-20260826-022320/src/lib/responsibility-kernel-compiler.ts"
Cohesion: 0.38
Nodes (10): actionToBaseAction(), captureToField(), captureType(), compileKernelToBaseDefinition(), hydrateKernelFromBaseDefinition(), normalizeKey(), requiredState(), resultingState() (+2 more)

### Community 163 - "semantic-builder-v1-20260826-024801/src/lib/responsibility-kernel-compiler.ts"
Cohesion: 0.38
Nodes (10): actionToBaseAction(), captureToField(), captureType(), compileKernelToBaseDefinition(), hydrateKernelFromBaseDefinition(), normalizeKey(), requiredState(), resultingState() (+2 more)

### Community 164 - "role-context-store.ts"
Cohesion: 0.38
Nodes (9): Context, GET, PUT, roleIdFrom(), createDefaultRoleContext(), getRoleContextDefinition(), labelOf(), listRoleContextDefinitions() (+1 more)

### Community 165 - "responsibility-intent-graph.ts"
Cohesion: 0.27
Nodes (10): Edge, EDGES, graphWeights(), IntentSearchItem, normalize(), RankedIntent, rankIntentCandidates(), SUBSUMES (+2 more)

### Community 166 - "role-context-normalizer.ts"
Cohesion: 0.55
Nodes (10): array(), enabled(), normalizeRelationship(), normalizeRoleContextDefinition(), normalizeTarget(), normalizeVisibility(), normalizeWorkflow(), object() (+2 more)

### Community 167 - "authoritative-phone-layout-20260825-233239/responsibility-kernel-compiler.ts"
Cohesion: 0.44
Nodes (9): actionToBaseAction(), captureToField(), captureType(), compileKernelToBaseDefinition(), hydrateKernelFromBaseDefinition(), normalizeKey(), requiredState(), resultingState() (+1 more)

### Community 168 - "ActionInspector"
Cohesion: 0.22
Nodes (9): actionEventIds(), ActionInspector(), patchAction(), patchConfig(), patch(), patch(), removeSelection(), rulesForAction() (+1 more)

### Community 169 - "ActionInspector"
Cohesion: 0.22
Nodes (9): actionEventIds(), ActionInspector(), patchAction(), patchConfig(), patch(), patch(), removeSelection(), rulesForAction() (+1 more)

### Community 170 - "semantic-runtime-v2-20260826-033804/src/lib/responsibility-kernel-compiler.ts"
Cohesion: 0.44
Nodes (9): actionToBaseAction(), captureToField(), captureType(), compileKernelToBaseDefinition(), hydrateKernelFromBaseDefinition(), normalizeKey(), requiredState(), resultingState() (+1 more)

### Community 171 - "Responsibility"
Cohesion: 0.28
Nodes (6): ArchivedResponsibilityClient(), objectValue(), IMPORTANT:, RecordOutput(), GenericRecord, Responsibility

### Community 172 - "role-capability-resolver.ts"
Cohesion: 0.31
Nodes (5): BUILDER_CAPABILITY_CATALOG, BuilderCapabilityDefinition, ResolvedBuilderCapabilities, RoleCapabilityKey, RoleContextDefinition

### Community 173 - "EffectRow"
Cohesion: 0.36
Nodes (7): ConditionRow(), ContextInspector(), decodeRef(), EffectRow(), encodeRef(), parseLiteral(), valueRefOptions()

### Community 174 - "EffectRow"
Cohesion: 0.36
Nodes (7): ConditionRow(), ContextInspector(), decodeRef(), EffectRow(), encodeRef(), parseLiteral(), valueRefOptions()

### Community 175 - "EffectRow"
Cohesion: 0.36
Nodes (7): ConditionRow(), ContextInspector(), decodeRef(), EffectRow(), encodeRef(), parseLiteral(), valueRefOptions()

### Community 176 - "EffectRow"
Cohesion: 0.36
Nodes (7): ConditionRow(), ContextInspector(), decodeRef(), EffectRow(), encodeRef(), parseLiteral(), valueRefOptions()

### Community 177 - "role-context-resolver.ts"
Cohesion: 0.43
Nodes (6): getUserRoles(), resolveRoleContext(), roleLabel(), userLabel(), ResolvedRoleReference, ResolvedUserReference

### Community 178 - "final-responsibility-cleanup-20260826-002238/src/components/appliance/responsibility-platform-studio.tsx"
Cohesion: 0.40
Nodes (3): LegacyKey, TabKey, tabs

### Community 179 - "ResponsibilityOutputEditor"
Cohesion: 0.50
Nodes (3): randomKey(), ResponsibilityOutputEditor(), addOutput()

### Community 180 - "actionEventIds"
Cohesion: 0.67
Nodes (3): actionEventIds(), removeSelection(), rulesForAction()

## Knowledge Gaps
- **482 isolated node(s):** `MeResponse`, `BuilderField`, `BuilderAction`, `CanvasBlock`, `BuilderState` (+477 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **86 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `sidebar.tsx`, `signup/page.tsx`, `primitives.tsx`, `data-table-reusable.tsx`, `utils.ts`, `toggle-group.tsx`, `chart-area-reusable.tsx`, `button.tsx`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Why does `ResponsibilityKernel` connect `ensureTenantPlatformVNext` to `src/components/appliance/responsibility-kernel-client.tsx`, `initial-state-runtime-20260826-022320/src/lib/responsibility-kernel-compiler.ts`, `semantic-builder-v1-20260826-024801/src/lib/responsibility-kernel-compiler.ts`, `employee-own-history-v2-20260826-042335/src/components/appliance/responsibility-app-builder.tsx`, `responsibility-semantic-compiler.ts`, `authoritative-phone-layout-20260825-233239/responsibility-kernel-compiler.ts`, `primitives.tsx`, `responsibility-kernel-catalog.ts`, `semantic-runtime-v2-20260826-033804/src/lib/responsibility-kernel-compiler.ts`, `src/lib/responsibility-kernel-types.ts`, `src/lib/responsibility-kernel-compiler.ts`, `semantic-builder-v1-20260826-024801/src/components/appliance/responsibility-app-builder.tsx`, `semantic-runtime-v2-20260826-033804/src/components/appliance/responsibility-app-builder.tsx`, `src/components/appliance/responsibility-event-editor.tsx`, `src/components/appliance/responsibility-app-builder.tsx`, `inline-human-review-20260826-040158/src/components/appliance/responsibility-app-builder.tsx`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `SearchSelect()` connect `primitives.tsx` to `src/components/appliance/responsibility-kernel-client.tsx`, `responsibility-kernel-catalog.ts`, `utils.ts`, `cn`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `MeResponse`, `BuilderField`, `BuilderAction` to the rest of the system?**
  _482 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `hasPermission` be split into smaller, more focused modules?**
  _Cohesion score 0.09393939393939393 - nodes in this community are weakly interconnected._
- **Should `sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.04864311315924219 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.05536723163841808 - nodes in this community are weakly interconnected._