# Graph Report - salesman_cms  (2026-08-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1326 nodes · 2775 edges · 137 communities (55 shown, 82 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `031e61cd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- hasPermission
- sidebar.tsx
- chart-area-reusable.tsx
- cn
- schema.ts
- ResponsibilitiesClient
- responsibility-kernel-types.ts
- ensureTenantPlatformVNext
- primitives.tsx
- data-table-reusable.tsx
- responsibilities-client.tsx
- multi-select.tsx
- responsibility-kernel-client.tsx
- auth.ts
- compilerOptions
- portfolio/route.ts
- record-output.tsx
- apiJson
- button.tsx
- publish/route.ts
- responsibility-app-builder.tsx
- ResponsibilityPowerClient
- platform-vnext-types.ts
- workspace-manifest.ts
- WorkflowsClient
- ResponsibilityAppBuilder
- components.json
- responsibility-power-client.tsx
- responsibility-kernel-catalog.ts
- Reusable-constants.ts
- dependencies
- responsibility-templates/route.ts
- applianceSchema.ts
- download-utils.ts
- dashboardShell.tsx
- responsibility-platform-studio.tsx
- responsibility-power-catalog.ts
- devDependencies
- entitlements.ts
- [...path]/route.ts
- drawer.tsx
- responsibility-validation.ts
- tenant-provisioner.ts
- DashboardAccessClient
- package.json
- toggle-group.tsx
- scripts
- SiteHeader
- eslint.config.mjs
- app/layout.tsx
- AccountSwitcher
- ResponsibilityEventEditor
- main
- organization/page.tsx
- generic-json-table.tsx
- bcryptjs
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
- eslint
- eslint-config-next
- baseline-browser-mapping
- exceljs
- @fortune-sheet/react
- jose
- json2csv
- jsonwebtoken
- leaflet
- lucide-react
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
- uuid
- vaul
- ws
- zod
- recharts
- tailwindcss
- ts-node
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

## God Nodes (most connected - your core abstractions)
1. `cn()` - 174 edges
2. `apiJson()` - 44 edges
3. `hasPermission()` - 40 edges
4. `ensureTenantPlatformVNext()` - 29 edges
5. `ResponsibilityPowerClient()` - 26 edges
6. `withTenantDb()` - 23 edges
7. `cx()` - 23 edges
8. `verifySession()` - 21 edges
9. `Panel()` - 20 edges
10. `SecondaryButton()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `SheetFooter()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/sheet.tsx → src/lib/utils.ts
- `SheetOverlay()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/sheet.tsx → src/lib/utils.ts
- `SidebarFooter()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/sidebar.tsx → src/lib/utils.ts
- `SidebarGroupAction()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/sidebar.tsx → src/lib/utils.ts
- `SidebarGroupContent()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/sidebar.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (137 total, 82 thin omitted)

### Community 0 - "hasPermission"
Cohesion: 0.08
Nodes (39): roles, userRoles, users, approvalPolicyActors, GET, editMappingSchema, POST, editRoleSchema (+31 more)

### Community 1 - "sidebar.tsx"
Cohesion: 0.06
Nodes (40): icons, Props, Separator(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader() (+32 more)

### Community 2 - "chart-area-reusable.tsx"
Cohesion: 0.08
Nodes (32): WelcomeViewProps, SignedOutHomePage(), LoginPage(), AuthBoundary(), SignupPage(), slugify(), ChartAreaInteractive(), ChartAreaInteractiveProps (+24 more)

### Community 3 - "cn"
Cohesion: 0.08
Nodes (34): Alert(), AlertDescription(), AlertTitle(), alertVariants, Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis() (+26 more)

### Community 4 - "schema.ts"
Cohesion: 0.05
Nodes (43): dailyVisitReports, dealers, distributors, geoTracking, influencers, institutions, journeyBreadcrumbs, journeyOps (+35 more)

### Community 5 - "ResponsibilitiesClient"
Cohesion: 0.08
Nodes (41): actionFromDefinition(), ActionProperties(), patch(), setFieldEnabled(), setFieldRequired(), appFromDefinition(), blankAction(), blankState() (+33 more)

### Community 6 - "responsibility-kernel-types.ts"
Cohesion: 0.07
Nodes (39): ConditionEditor(), EffectEditor(), EVENT_KINDS, makeRef(), refDisplay(), refKind(), actorResolverNeedsTarget(), currentUserResolver() (+31 more)

### Community 7 - "ensureTenantPlatformVNext"
Cohesion: 0.09
Nodes (31): dataSources, EntityFieldDefinition, entityFieldMemory, entityRecords, entityTypes, platformMeta, recordLinks, responsibilityVersions (+23 more)

### Community 8 - "primitives.tsx"
Cohesion: 0.15
Nodes (24): formatWhen(), Credentials, DashboardUser, Discovered, EntityField, EntityType, FIELD_TYPES, EMPTY_TOTALS (+16 more)

### Community 9 - "data-table-reusable.tsx"
Cohesion: 0.07
Nodes (26): DataTableProps, GlobalFilterBar(), GlobalFilterBarProps, Option, MultiSelect(), DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent() (+18 more)

### Community 10 - "responsibilities-client.tsx"
Cohesion: 0.09
Nodes (30): DynamicWorkClient(), textareaClass, BuilderAction, BuilderField, BuilderState, CanvasBlock, MeResponse, PaletteDragData (+22 more)

### Community 11 - "multi-select.tsx"
Cohesion: 0.10
Nodes (26): MultiSelectProps, Option, Option, SearchSelect(), SearchSelectProps, Badge(), badgeVariants, Command() (+18 more)

### Community 12 - "responsibility-kernel-client.tsx"
Cohesion: 0.12
Nodes (30): asKernel(), ExtensionResponse, humanize(), normalizeKey(), PossibilitiesEditor(), addAction(), addCapture(), randomKey() (+22 more)

### Community 13 - "auth.ts"
Cohesion: 0.13
Nodes (18): refreshCompanyCache(), POST(), POST(), IMPORTANT: login must never reactivate a suspended/inactive user., POST(), RefreshDataButton(), RefreshDataButtonProps, decrypt() (+10 more)

### Community 14 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, src/generated/prisma (+20 more)

### Community 15 - "portfolio/route.ts"
Cohesion: 0.10
Nodes (23): actionDefinitions, approvalPolicies, workflowDefinitions, workflowInstances, workflowStepDependencies, workflowStepInstances, workflowSteps, workflowVersions (+15 more)

### Community 16 - "record-output.tsx"
Cohesion: 0.18
Nodes (24): formatDateTime(), MapPoint, MapRoute, CardsOutput(), DetailOutput(), displayValue(), fieldsFor(), GalleryOutput() (+16 more)

### Community 17 - "apiJson"
Cohesion: 0.10
Nodes (18): ApprovalsClient(), decide(), AssignmentsClient(), apiJson(), DataSourcesClient(), connect(), remove(), capitalizeFirst() (+10 more)

### Community 18 - "button.tsx"
Cohesion: 0.11
Nodes (19): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+11 more)

### Community 19 - "publish/route.ts"
Cohesion: 0.16
Nodes (21): compiledResponsibilityManifests, platformAuditEvents, responsibilityExtensions, Context, kernelFromMetadata(), POST, IMPORTANT: Draft Kernel metadata is the source of truth. The employee app, Context (+13 more)

### Community 20 - "responsibility-app-builder.tsx"
Cohesion: 0.12
Nodes (18): cx(), ControlCenterClient(), Canvas(), PaletteBlock(), actionEventRule(), captureIcon(), initialState(), PaletteItem() (+10 more)

### Community 21 - "ResponsibilityPowerClient"
Cohesion: 0.12
Nodes (18): baseFields(), humanize(), issueTone(), normalizeKey(), objectValue(), randomKey(), ResponsibilityPowerClient(), addComputedField() (+10 more)

### Community 22 - "platform-vnext-types.ts"
Cohesion: 0.09
Nodes (21): CompiledResponsibilityManifest, ConditionOperand, EvidenceBundle, FieldBehaviorPolicy, PlatformDataSourceType, PlatformEntityField, PlatformEntityRecord, PlatformEntityType (+13 more)

### Community 23 - "workspace-manifest.ts"
Cohesion: 0.15
Nodes (18): ResponsibilityDefinition, WorkflowRuntime, addNav(), BuildWorkspaceInput, buildWorkspaceManifest(), countState(), emptyStepRuntime(), keyForGroup() (+10 more)

### Community 24 - "WorkflowsClient"
Cohesion: 0.14
Nodes (16): blankAction(), blankApproval(), builderStepFromExisting(), enabledOperations(), latestVersion(), localId(), objectValue(), payloadSteps() (+8 more)

### Community 25 - "ResponsibilityAppBuilder"
Cohesion: 0.20
Nodes (18): ActionInspector(), patchAction(), patchConfig(), CaptureInspector(), patch(), clone(), configString(), ensureActionBehavior() (+10 more)

### Community 26 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 27 - "responsibility-power-client.tsx"
Cohesion: 0.11
Nodes (16): ExtensionResponse, RuntimeResponse, StudioTab, TAB_DEFS, ValidateResponse, VersionResponse, ComputedField, FieldMemoryPolicy (+8 more)

### Community 28 - "responsibility-kernel-catalog.ts"
Cohesion: 0.19
Nodes (14): randomKey(), ResponsibilityOutputEditor(), addOutput(), ACTION_CATALOG, addActionRule(), attendanceKernelTemplate(), blankResponsibilityKernel(), CAPTURE_CATALOG (+6 more)

### Community 29 - "Reusable-constants.ts"
Cohesion: 0.14
Nodes (11): Locations, Locations, BASE_URL, brands, dealerTypes, JOB_ROLES, JWT_KEY, ORG_ROLES (+3 more)

### Community 30 - "dependencies"
Cohesion: 0.13
Nodes (15): cmdk, jszip, next, @next/bundle-analyzer, dependencies, cmdk, jszip, next (+7 more)

### Community 31 - "responsibility-templates/route.ts"
Cohesion: 0.31
Nodes (12): proxy(), normalizeKey(), POST(), uniqueResponsibilityKey(), GET(), objectValue(), applianceBackendFetch(), forwardBackendJson() (+4 more)

### Community 32 - "applianceSchema.ts"
Cohesion: 0.15
Nodes (12): adminOwnershipRules, applianceAuditLog, approvalRequests, attentionItems, capabilityAssignmentRules, deviceRegistrations, dynamicSubmissions, employeeRuntimeState (+4 more)

### Community 33 - "download-utils.ts"
Cohesion: 0.32
Nodes (11): appendRows(), autoSizeColumns(), estimateWidth(), exportTablesToCSVZip(), generateAndStreamXlsx(), generateAndStreamXlsxMulti(), normalizeCell(), normalizeCells() (+3 more)

### Community 34 - "dashboardShell.tsx"
Cohesion: 0.18
Nodes (7): DashboardShell(), DashboardShellProps, User, AuthenticatedLayout(), metadata, AppSidebar(), SidebarInset()

### Community 35 - "responsibility-platform-studio.tsx"
Cohesion: 0.20
Nodes (8): EntitiesClient(), create(), newField(), normalizeKey(), LegacyKey, ResponsibilityPlatformStudio(), TabKey, tabs

### Community 36 - "responsibility-power-catalog.ts"
Cohesion: 0.18
Nodes (10): ResponsibilityBuilderMode, ResponsibilityExtensionConfig, ResponsibilityOutputRenderer, SmartBlockKind, BUILT_IN_DATA_SOURCES, OUTPUT_RENDERERS, RESPONSIBILITY_MODES, SMART_BLOCK_CATALOG (+2 more)

### Community 37 - "devDependencies"
Cohesion: 0.18
Nodes (11): drizzle-kit, @eslint/eslintrc, devDependencies, drizzle-kit, @eslint/eslintrc, @tailwindcss/postcss, @types/pg, typescript (+3 more)

### Community 38 - "entitlements.ts"
Cohesion: 0.27
Nodes (8): organizationEntitlements, organizations, IMPORTANT:, GET(), EntitlementFlags, EntitlementKey, getTenantEntitlements(), isCurrentlyEffective()

### Community 39 - "[...path]/route.ts"
Cohesion: 0.22
Nodes (10): DELETE, entitlementGuard(), GET, isResponsibilityWrite(), isWorkflowWrite(), PATCH, POST, PUT (+2 more)

### Community 40 - "drawer.tsx"
Cohesion: 0.18
Nodes (6): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 41 - "responsibility-validation.ts"
Cohesion: 0.31
Nodes (10): ResponsibilityValidationIssue, BUILT_IN_SOURCE_KEYS, SUPPORTED_OUTPUT_RENDERERS, SUPPORTED_SMART_BLOCKS, asArray(), asObject(), baseActionKeys(), baseFieldKeys() (+2 more)

### Community 42 - "tenant-provisioner.ts"
Cohesion: 0.29
Nodes (8): POST(), assertControlPlaneInstalled(), CORE_SQL, DEFAULT_ROLES, provisionCompany(), ProvisionCompanyInput, runSqlFile(), TENANT_PLATFORM_SQL

### Community 44 - "package.json"
Cohesion: 0.29
Nodes (6): name, overrides, @types/react, @types/react-dom, private, version

### Community 45 - "toggle-group.tsx"
Cohesion: 0.43
Nodes (5): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 46 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, check, dev, lint, start

### Community 48 - "eslint.config.mjs"
Cohesion: 0.40
Nodes (4): compat, __dirname, eslintConfig, __filename

### Community 49 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 51 - "ResponsibilityEventEditor"
Cohesion: 0.50
Nodes (3): randomKey(), ResponsibilityEventEditor(), addRule()

### Community 52 - "main"
Cohesion: 0.83
Nodes (3): main(), remove_path(), Path

## Knowledge Gaps
- **350 isolated node(s):** `Context`, `DataSourcePatch`, `RouteContext`, `Context`, `SidebarContextProps` (+345 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **82 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `sidebar.tsx`, `chart-area-reusable.tsx`, `dashboardShell.tsx`, `drawer.tsx`, `data-table-reusable.tsx`, `multi-select.tsx`, `toggle-group.tsx`, `button.tsx`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Why does `apiJson()` connect `apiJson` to `responsibility-platform-studio.tsx`, `ResponsibilitiesClient`, `primitives.tsx`, `responsibilities-client.tsx`, `responsibility-kernel-client.tsx`, `ResponsibilityPowerClient`, `WorkflowsClient`, `responsibility-power-client.tsx`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `hasPermission()` connect `hasPermission` to `publish/route.ts`, `responsibility-templates/route.ts`, `auth.ts`, `ensureTenantPlatformVNext`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `Context`, `DataSourcePatch`, `RouteContext` to the rest of the system?**
  _350 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `hasPermission` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06037414965986394 - nodes in this community are weakly interconnected._
- **Should `chart-area-reusable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07890070921985816 - nodes in this community are weakly interconnected._