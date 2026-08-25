# Graph Report - salesman_cms  (2026-08-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1399 nodes · 2994 edges · 138 communities (56 shown, 82 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ffd9ebb3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- schema.ts
- sidebar.tsx
- chart-area-reusable.tsx
- cn
- zodSchemas.ts
- responsibilities-client.tsx
- responsibility-kernel-types.ts
- hasPermission
- primitives.tsx
- data-table-reusable.tsx
- appliance-types.ts
- multi-select.tsx
- responsibility-kernel-client.tsx
- responsibility-templates/route.ts
- compilerOptions
- portfolio/route.ts
- record-output.tsx
- apiJson
- button.tsx
- publish/route.ts
- platformVNextSchema.ts
- ResponsibilityPowerClient
- platform-vnext-types.ts
- workspace-manifest.ts
- responsibility-app-builder.tsx
- ResponsibilityAppBuilder
- components.json
- responsibility-power-client.tsx
- [userId]/route.ts
- Reusable-constants.ts
- dependencies
- RefreshDataButton.tsx
- applianceSchema.ts
- download-utils.ts
- clone
- entities-client.tsx
- responsibility-power-templates.ts
- devDependencies
- alert.tsx
- lucide-react
- CaptureInspector
- responsibility-power-catalog.ts
- tenant-provisioner.ts
- DashboardAccessClient
- package.json
- utils.ts
- scripts
- ResponsibilityWorldEditor
- eslint.config.mjs
- app/layout.tsx
- AccountSwitcher
- ResponsibilityEventEditor
- main
- organization/page.tsx
- generic-json-table.tsx
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
- exceljs
- @fortune-sheet/react
- jose
- json2csv
- jsonwebtoken
- leaflet
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
- AssignmentsClient
- auth.ts
- @eslint/eslintrc
- @next/bundle-analyzer

## God Nodes (most connected - your core abstractions)
1. `cn()` - 174 edges
2. `apiJson()` - 44 edges
3. `hasPermission()` - 40 edges
4. `ensureTenantPlatformVNext()` - 29 edges
5. `ResponsibilityPowerClient()` - 26 edges
6. `cx()` - 25 edges
7. `withTenantDb()` - 23 edges
8. `clone()` - 23 edges
9. `verifySession()` - 21 edges
10. `Panel()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `GET` --calls--> `hasPermission()`  [EXTRACTED]
  src/app/api/dashboardPagesAPI/users-and-team/team-overview/dataFetch/route.ts → src/lib/auth.ts
- `GET` --calls--> `hasPermission()`  [EXTRACTED]
  src/app/api/dashboardPagesAPI/users-and-team/users/[userId]/route.ts → src/lib/auth.ts
- `DELETE` --calls--> `hasPermission()`  [EXTRACTED]
  src/app/api/platform/roles/[id]/route.ts → src/lib/auth.ts
- `PATCH` --calls--> `hasPermission()`  [EXTRACTED]
  src/app/api/platform/roles/[id]/route.ts → src/lib/auth.ts
- `POST` --calls--> `hasPermission()`  [EXTRACTED]
  src/app/api/platform/roles/route.ts → src/lib/auth.ts

## Import Cycles
- None detected.

## Communities (138 total, 82 thin omitted)

### Community 0 - "schema.ts"
Cohesion: 0.11
Nodes (27): distributors, influencers, institutions, outlets, roles, tadaBillItems, tadaBills, userMobileCapabilities (+19 more)

### Community 1 - "sidebar.tsx"
Cohesion: 0.05
Nodes (48): DashboardShellProps, User, AppSidebar(), icons, Props, SiteHeader(), titleForPath(), Separator() (+40 more)

### Community 2 - "chart-area-reusable.tsx"
Cohesion: 0.08
Nodes (31): WelcomeViewProps, SignedOutHomePage(), LoginPage(), AuthBoundary(), SignupPage(), slugify(), ChartAreaInteractive(), ChartAreaInteractiveProps (+23 more)

### Community 3 - "cn"
Cohesion: 0.08
Nodes (32): Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage() (+24 more)

### Community 4 - "zodSchemas.ts"
Cohesion: 0.05
Nodes (36): dailyVisitReports, dealers, geoTracking, journeyBreadcrumbs, journeyOps, journeys, permanentJourneyPlans, salesmanAttendance (+28 more)

### Community 5 - "responsibilities-client.tsx"
Cohesion: 0.08
Nodes (50): actionFromDefinition(), ActionProperties(), patch(), setFieldEnabled(), setFieldRequired(), appFromDefinition(), blankAction(), blankState() (+42 more)

### Community 6 - "responsibility-kernel-types.ts"
Cohesion: 0.07
Nodes (48): ConditionEditor(), EffectEditor(), EVENT_KINDS, makeRef(), refDisplay(), refKind(), randomKey(), ResponsibilityOutputEditor() (+40 more)

### Community 7 - "hasPermission"
Cohesion: 0.13
Nodes (24): dataSources, entityRecords, entityTypes, GET, POST, NOTE: dashboardHashedPassword is plaintext here despite the, Context, DataSourcePatch (+16 more)

### Community 8 - "primitives.tsx"
Cohesion: 0.16
Nodes (23): cx(), formatWhen(), ControlCenterClient(), Credentials, DashboardUser, Discovered, EMPTY_TOTALS, PortfolioCompany (+15 more)

### Community 9 - "data-table-reusable.tsx"
Cohesion: 0.08
Nodes (25): DataTableProps, GlobalFilterBar(), GlobalFilterBarProps, Option, DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem() (+17 more)

### Community 10 - "appliance-types.ts"
Cohesion: 0.07
Nodes (35): DynamicWorkClient(), blankAction(), blankApproval(), BuilderState, BuilderStep, builderStepFromExisting(), enabledOperations(), latestVersion() (+27 more)

### Community 11 - "multi-select.tsx"
Cohesion: 0.10
Nodes (27): MultiSelect(), MultiSelectProps, Option, Option, SearchSelect(), SearchSelectProps, Badge(), badgeVariants (+19 more)

### Community 12 - "responsibility-kernel-client.tsx"
Cohesion: 0.12
Nodes (29): asKernel(), ExtensionResponse, humanize(), normalizeKey(), PossibilitiesEditor(), addAction(), addCapture(), randomKey() (+21 more)

### Community 13 - "responsibility-templates/route.ts"
Cohesion: 0.14
Nodes (20): organizationEntitlements, organizations, IMPORTANT:, POST(), IMPORTANT: login must never reactivate a suspended/inactive user., normalizeKey(), POST(), uniqueResponsibilityKey() (+12 more)

### Community 14 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, src/generated/prisma (+20 more)

### Community 15 - "portfolio/route.ts"
Cohesion: 0.09
Nodes (20): actionDefinitions, approvalPolicies, approvalPolicyActors, workflowDefinitions, workflowInstances, workflowStepDependencies, workflowStepInstances, workflowSteps (+12 more)

### Community 16 - "record-output.tsx"
Cohesion: 0.18
Nodes (24): formatDateTime(), MapPoint, MapRoute, CardsOutput(), DetailOutput(), displayValue(), fieldsFor(), GalleryOutput() (+16 more)

### Community 17 - "apiJson"
Cohesion: 0.13
Nodes (17): ApprovalsClient(), decide(), apiJson(), DataSourcesClient(), connect(), remove(), capitalizeFirst(), EmployeesClient() (+9 more)

### Community 18 - "button.tsx"
Cohesion: 0.11
Nodes (19): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+11 more)

### Community 19 - "publish/route.ts"
Cohesion: 0.17
Nodes (21): compiledResponsibilityManifests, Context, kernelFromMetadata(), POST, IMPORTANT: Draft Kernel metadata is the source of truth. The employee app, Context, GET, PUT (+13 more)

### Community 20 - "platformVNextSchema.ts"
Cohesion: 0.13
Nodes (16): EntityFieldDefinition, entityFieldMemory, platformAuditEvents, platformMeta, recordLinks, responsibilityExtensions, responsibilityVersions, mobileCapabilities (+8 more)

### Community 21 - "ResponsibilityPowerClient"
Cohesion: 0.12
Nodes (18): baseFields(), humanize(), issueTone(), normalizeKey(), objectValue(), randomKey(), ResponsibilityPowerClient(), addComputedField() (+10 more)

### Community 22 - "platform-vnext-types.ts"
Cohesion: 0.09
Nodes (21): CompiledResponsibilityManifest, ConditionOperand, EvidenceBundle, FieldBehaviorPolicy, PlatformDataSourceType, PlatformEntityField, PlatformEntityRecord, PlatformEntityType (+13 more)

### Community 23 - "workspace-manifest.ts"
Cohesion: 0.07
Nodes (36): DELETE, entitlementGuard(), GET, isResponsibilityWrite(), isWorkflowWrite(), PATCH, POST, proxy() (+28 more)

### Community 24 - "responsibility-app-builder.tsx"
Cohesion: 0.07
Nodes (48): actionEventIds(), applySimulationEffect(), behaviorChips(), BlockPreview(), BrainBar(), captureIcon(), compareValues(), ConditionRow() (+40 more)

### Community 25 - "ResponsibilityAppBuilder"
Cohesion: 0.20
Nodes (20): addRule(), ensureActionEvent(), ensureBaseRule(), humanize(), normalizeKey(), randomKey(), ResponsibilityAppBuilder(), addAction() (+12 more)

### Community 26 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 27 - "responsibility-power-client.tsx"
Cohesion: 0.11
Nodes (16): ExtensionResponse, RuntimeResponse, StudioTab, TAB_DEFS, ValidateResponse, VersionResponse, ComputedField, FieldMemoryPolicy (+8 more)

### Community 28 - "[userId]/route.ts"
Cohesion: 0.32
Nodes (6): generateRandomPassword(), GET, PUT, NOTE: dashboardHashedPassword is plaintext here despite the, RouteContext, updateUserSchema

### Community 29 - "Reusable-constants.ts"
Cohesion: 0.14
Nodes (11): Locations, Locations, BASE_URL, brands, dealerTypes, JOB_ROLES, JWT_KEY, ORG_ROLES (+3 more)

### Community 30 - "dependencies"
Cohesion: 0.13
Nodes (15): bcryptjs, cmdk, jszip, next, dependencies, bcryptjs, cmdk, jszip (+7 more)

### Community 31 - "RefreshDataButton.tsx"
Cohesion: 0.60
Nodes (3): refreshCompanyCache(), RefreshDataButton(), RefreshDataButtonProps

### Community 32 - "applianceSchema.ts"
Cohesion: 0.15
Nodes (12): adminOwnershipRules, applianceAuditLog, approvalRequests, attentionItems, capabilityAssignmentRules, deviceRegistrations, dynamicSubmissions, employeeRuntimeState (+4 more)

### Community 33 - "download-utils.ts"
Cohesion: 0.32
Nodes (11): appendRows(), autoSizeColumns(), estimateWidth(), exportTablesToCSVZip(), generateAndStreamXlsx(), generateAndStreamXlsxMulti(), normalizeCell(), normalizeCells() (+3 more)

### Community 34 - "clone"
Cohesion: 0.30
Nodes (18): addOrReplaceActor(), addOrReplaceContext(), addOrReplaceState(), attendanceEssentialsRecipe(), biometricRecipe(), clone(), conditionalApprovalRecipe(), ensureAction() (+10 more)

### Community 35 - "entities-client.tsx"
Cohesion: 0.15
Nodes (12): EntitiesClient(), create(), EntityField, EntityType, FIELD_TYPES, newField(), normalizeKey(), textareaClass (+4 more)

### Community 36 - "responsibility-power-templates.ts"
Cohesion: 0.40
Nodes (4): ResponsibilityBuilderMode, ResponsibilityExtensionConfig, RESPONSIBILITY_TEMPLATES, ResponsibilityTemplateDefinition

### Community 37 - "devDependencies"
Cohesion: 0.18
Nodes (11): baseline-browser-mapping, drizzle-kit, devDependencies, baseline-browser-mapping, drizzle-kit, @tailwindcss/postcss, @types/pg, typescript (+3 more)

### Community 38 - "alert.tsx"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 40 - "CaptureInspector"
Cohesion: 0.19
Nodes (13): ActionInspector(), patchAction(), patchConfig(), ActorInspector(), patch(), CaptureInspector(), patch(), patchConfig() (+5 more)

### Community 41 - "responsibility-power-catalog.ts"
Cohesion: 0.16
Nodes (16): PlatformDataSource, ResponsibilityOutputRenderer, ResponsibilityValidationIssue, SmartBlockKind, BUILT_IN_DATA_SOURCES, BUILT_IN_SOURCE_KEYS, OUTPUT_RENDERERS, RESPONSIBILITY_MODES (+8 more)

### Community 42 - "tenant-provisioner.ts"
Cohesion: 0.29
Nodes (8): POST(), assertControlPlaneInstalled(), CORE_SQL, DEFAULT_ROLES, provisionCompany(), ProvisionCompanyInput, runSqlFile(), TENANT_PLATFORM_SQL

### Community 44 - "package.json"
Cohesion: 0.29
Nodes (6): name, overrides, @types/react, @types/react-dom, private, version

### Community 45 - "utils.ts"
Cohesion: 0.16
Nodes (9): Checkbox(), Progress(), Switch(), Textarea(), ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle() (+1 more)

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

### Community 51 - "ResponsibilityEventEditor"
Cohesion: 0.50
Nodes (3): randomKey(), ResponsibilityEventEditor(), addRule()

### Community 52 - "main"
Cohesion: 0.83
Nodes (3): main(), remove_path(), Path

### Community 139 - "auth.ts"
Cohesion: 0.14
Nodes (18): GET(), POST(), POST(), GET(), assertControlPlane(), claimCurrentOrganizationsForEmail(), ensureAccountSubstrate(), findOrganizationForAccountEmail() (+10 more)

## Knowledge Gaps
- **363 isolated node(s):** `RouteContext`, `Context`, `DashboardShellProps`, `User`, `Props` (+358 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **82 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `sidebar.tsx`, `chart-area-reusable.tsx`, `alert.tsx`, `data-table-reusable.tsx`, `multi-select.tsx`, `utils.ts`, `button.tsx`?**
  _High betweenness centrality (0.153) - this node is a cross-community bridge._
- **Why does `apiJson()` connect `apiJson` to `entities-client.tsx`, `responsibilities-client.tsx`, `primitives.tsx`, `AssignmentsClient`, `appliance-types.ts`, `responsibility-kernel-client.tsx`, `ResponsibilityPowerClient`, `responsibility-power-client.tsx`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `ResponsibilityPowerClient()` connect `ResponsibilityPowerClient` to `entities-client.tsx`, `primitives.tsx`, `apiJson`, `publish/route.ts`, `responsibility-power-client.tsx`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `RouteContext`, `Context`, `DashboardShellProps` to the rest of the system?**
  _363 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `schema.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1092436974789916 - nodes in this community are weakly interconnected._
- **Should `sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.04811507936507937 - nodes in this community are weakly interconnected._
- **Should `chart-area-reusable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08140610545790934 - nodes in this community are weakly interconnected._