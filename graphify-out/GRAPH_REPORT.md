# Graph Report - salesman_cms  (2026-08-25)

## Corpus Check
- 184 files · ~124,826 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1319 nodes · 2749 edges · 138 communities (58 shown, 80 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2b95ea0a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- publish/route.ts
- sidebar.tsx
- ResponsibilitiesClient
- [...path]/route.ts
- cn
- responsibility-app-builder.tsx
- workflows-client.tsx
- schema.ts
- responsibility-kernel-client.tsx
- data-table-reusable.tsx
- multi-select.tsx
- compilerOptions
- users
- record-output.tsx
- button.tsx
- apiJson
- alert-dialog.tsx
- ResponsibilityPowerClient
- chart-area-reusable.tsx
- platform-vnext-types.ts
- portfolio/route.ts
- components.json
- responsibility-templates/route.ts
- auth.ts
- responsibility-event-editor.tsx
- responsibility-power-client.tsx
- responsibility-power-catalog.ts
- Reusable-constants.ts
- dependencies
- editMapping/route.ts
- responsibility-kernel-types.ts
- applianceSchema.ts
- download-utils.ts
- responsibility-kernel-catalog.ts
- ResponsibilityKernelClient
- devDependencies
- responsibility-kernel-compiler.ts
- tenant-provisioner.ts
- ResponsibilityWorldEditor
- hasPermission
- DashboardAccessClient
- package.json
- toggle-group.tsx
- scripts
- humanize
- eslint.config.mjs
- workspace-manifest.ts
- app/layout.tsx
- AccountSwitcher
- workflowSchema.ts
- responsibility-power-templates.ts
- main
- organization-client.tsx
- generic-json-table.tsx
- class-variance-authority
- baseline-browser-mapping
- @corbe30/fortune-excel
- cors
- csv-stringify
- date-fns
- @dnd-kit/core
- @dnd-kit/modifiers
- @dnd-kit/sortable
- responsibilities-client.tsx
- dotenv
- drizzle-orm
- drizzle-zod
- eslint
- @dnd-kit/utilities
- @eslint/eslintrc
- exceljs
- @fortune-sheet/react
- jose
- json2csv
- jsonwebtoken
- leaflet
- lucide-react
- @neondatabase/serverless
- next-auth
- @next/bundle-analyzer
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
- fortune-sheet.d.ts
- start.sh
- responsibility-platform-studio.tsx
- README.md
- bcryptjs

## God Nodes (most connected - your core abstractions)
1. `cn()` - 172 edges
2. `apiJson()` - 45 edges
3. `hasPermission()` - 40 edges
4. `ensureTenantPlatformVNext()` - 29 edges
5. `ResponsibilityPowerClient()` - 26 edges
6. `cx()` - 23 edges
7. `withTenantDb()` - 23 edges
8. `verifySession()` - 21 edges
9. `Panel()` - 20 edges
10. `SecondaryButton()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `GET` --calls--> `hasPermission()`  [EXTRACTED]
  src/app/api/dashboardPagesAPI/users-and-team/team-overview/dataFetch/route.ts → src/lib/auth.ts
- `GET` --calls--> `hasPermission()`  [EXTRACTED]
  src/app/api/dashboardPagesAPI/users-and-team/users/[userId]/route.ts → src/lib/auth.ts
- `GET` --calls--> `ensureTenantPlatformVNext()`  [EXTRACTED]
  src/app/api/platform/responsibility-extensions/[id]/versions/route.ts → src/lib/platform-vnext-db.ts
- `PATCH` --calls--> `hasPermission()`  [EXTRACTED]
  src/app/api/platform/roles/[id]/route.ts → src/lib/auth.ts
- `DELETE` --calls--> `hasPermission()`  [EXTRACTED]
  src/app/api/platform/roles/[id]/route.ts → src/lib/auth.ts

## Import Cycles
- None detected.

## Communities (138 total, 80 thin omitted)

### Community 0 - "publish/route.ts"
Cohesion: 0.08
Nodes (37): compiledResponsibilityManifests, EntityFieldDefinition, entityFieldMemory, platformAuditEvents, platformMeta, recordLinks, responsibilityExtensions, responsibilityVersions (+29 more)

### Community 1 - "sidebar.tsx"
Cohesion: 0.05
Nodes (47): DashboardShellProps, User, AppSidebar(), icons, Props, SiteHeader(), titleForPath(), Separator() (+39 more)

### Community 2 - "ResponsibilitiesClient"
Cohesion: 0.08
Nodes (41): actionFromDefinition(), ActionProperties(), patch(), setFieldEnabled(), setFieldRequired(), appFromDefinition(), blankAction(), blankState() (+33 more)

### Community 3 - "[...path]/route.ts"
Cohesion: 0.13
Nodes (19): organizationEntitlements, organizations, IMPORTANT:, DELETE, entitlementGuard(), GET, isResponsibilityWrite(), isWorkflowWrite() (+11 more)

### Community 4 - "cn"
Cohesion: 0.07
Nodes (40): Alert(), AlertDescription(), AlertTitle(), alertVariants, Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis() (+32 more)

### Community 5 - "responsibility-app-builder.tsx"
Cohesion: 0.12
Nodes (30): actionEventRule(), ActionInspector(), patchAction(), patchConfig(), captureIcon(), CaptureInspector(), patch(), clone() (+22 more)

### Community 6 - "workflows-client.tsx"
Cohesion: 0.13
Nodes (22): blankAction(), blankApproval(), BuilderState, BuilderStep, builderStepFromExisting(), enabledOperations(), latestVersion(), localId() (+14 more)

### Community 7 - "schema.ts"
Cohesion: 0.05
Nodes (43): dailyVisitReports, dealers, distributors, geoTracking, influencers, institutions, journeyBreadcrumbs, journeyOps (+35 more)

### Community 8 - "responsibility-kernel-client.tsx"
Cohesion: 0.13
Nodes (29): cx(), formatWhen(), ControlCenterClient(), DashboardUser, Discovered, EntityField, EntityType, FIELD_TYPES (+21 more)

### Community 9 - "data-table-reusable.tsx"
Cohesion: 0.07
Nodes (26): DataTableProps, DataTableReusable(), GlobalFilterBar(), GlobalFilterBarProps, Option, MultiSelect(), DropdownMenu(), DropdownMenuCheckboxItem() (+18 more)

### Community 10 - "multi-select.tsx"
Cohesion: 0.10
Nodes (23): MultiSelectProps, Option, Badge(), badgeVariants, Command(), CommandDialog(), CommandEmpty(), CommandGroup() (+15 more)

### Community 11 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, src/generated/prisma (+20 more)

### Community 12 - "users"
Cohesion: 0.14
Nodes (17): roles, userRoles, users, POST(), POST(), IMPORTANT: login must never reactivate a suspended/inactive user., GET, generateRandomPassword() (+9 more)

### Community 13 - "record-output.tsx"
Cohesion: 0.19
Nodes (23): formatDateTime(), MapPoint, MapRoute, CardsOutput(), DetailOutput(), displayValue(), fieldsFor(), GalleryOutput() (+15 more)

### Community 14 - "button.tsx"
Cohesion: 0.19
Nodes (14): WelcomeViewProps, LoginPage(), SignupPage(), slugify(), Button(), Card(), CardAction(), CardContent() (+6 more)

### Community 15 - "apiJson"
Cohesion: 0.14
Nodes (16): ApprovalsClient(), decide(), apiJson(), DataSourcesClient(), connect(), remove(), EmployeesClient(), createEmployee() (+8 more)

### Community 16 - "alert-dialog.tsx"
Cohesion: 0.10
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+10 more)

### Community 17 - "ResponsibilityPowerClient"
Cohesion: 0.12
Nodes (18): baseFields(), humanize(), issueTone(), normalizeKey(), objectValue(), randomKey(), ResponsibilityPowerClient(), addComputedField() (+10 more)

### Community 18 - "chart-area-reusable.tsx"
Cohesion: 0.13
Nodes (18): ChartAreaInteractive(), ChartAreaInteractiveProps, ChartDataItem, ChartPieReusable(), ChartPieReusableProps, PIE_COLORS, renderActiveShape(), ChartConfig (+10 more)

### Community 19 - "platform-vnext-types.ts"
Cohesion: 0.09
Nodes (21): ConditionOperand, FieldBehaviorPolicy, PlatformDataSourceType, PlatformEntityField, PlatformEntityRecord, PlatformEntityType, ReferenceFilter, ReferenceFilterValue (+13 more)

### Community 20 - "portfolio/route.ts"
Cohesion: 0.19
Nodes (13): AccountOrganization, CompanyPortfolio, GET(), loadCompany(), mapWithLimit(), PersonPreview, ResponsibilityPreview, WorkflowPreview (+5 more)

### Community 21 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 22 - "responsibility-templates/route.ts"
Cohesion: 0.17
Nodes (17): proxy(), normalizeKey(), POST(), uniqueResponsibilityKey(), GET(), objectValue(), DashboardShell(), AuthenticatedLayout() (+9 more)

### Community 23 - "auth.ts"
Cohesion: 0.13
Nodes (14): refreshCompanyCache(), GET(), SignedOutHomePage(), AuthBoundary(), RefreshDataButton(), RefreshDataButtonProps, decrypt(), key (+6 more)

### Community 24 - "responsibility-event-editor.tsx"
Cohesion: 0.14
Nodes (15): ConditionEditor(), EffectEditor(), EVENT_KINDS, makeRef(), randomKey(), refDisplay(), refKind(), ResponsibilityEventEditor() (+7 more)

### Community 25 - "responsibility-power-client.tsx"
Cohesion: 0.12
Nodes (15): ExtensionResponse, RuntimeResponse, StudioTab, TAB_DEFS, ValidateResponse, VersionResponse, ComputedField, EvidenceBundle (+7 more)

### Community 26 - "responsibility-power-catalog.ts"
Cohesion: 0.17
Nodes (17): PlatformDataSource, ResponsibilityOutputRenderer, ResponsibilityValidationIssue, SmartBlockKind, BUILT_IN_DATA_SOURCES, BUILT_IN_SOURCE_KEYS, OUTPUT_RENDERERS, RESPONSIBILITY_MODES (+9 more)

### Community 27 - "Reusable-constants.ts"
Cohesion: 0.14
Nodes (11): Locations, Locations, BASE_URL, brands, dealerTypes, JOB_ROLES, JWT_KEY, ORG_ROLES (+3 more)

### Community 28 - "dependencies"
Cohesion: 0.13
Nodes (15): clsx, cmdk, jszip, next, dependencies, clsx, cmdk, jszip (+7 more)

### Community 29 - "editMapping/route.ts"
Cohesion: 0.26
Nodes (11): editMappingSchema, POST, editRoleSchema, POST, canAssignRole(), getRoleWeight(), getVisibleRoles(), isSuperUser() (+3 more)

### Community 30 - "responsibility-kernel-types.ts"
Cohesion: 0.15
Nodes (17): CONTEXT_CATALOG, KernelAction, KernelActionKind, KernelActor, KernelActorResolver, KernelCapture, KernelCaptureKind, KernelContext (+9 more)

### Community 31 - "applianceSchema.ts"
Cohesion: 0.15
Nodes (12): adminOwnershipRules, applianceAuditLog, approvalRequests, attentionItems, capabilityAssignmentRules, deviceRegistrations, dynamicSubmissions, employeeRuntimeState (+4 more)

### Community 32 - "download-utils.ts"
Cohesion: 0.32
Nodes (11): appendRows(), autoSizeColumns(), estimateWidth(), exportTablesToCSVZip(), generateAndStreamXlsx(), generateAndStreamXlsxMulti(), normalizeCell(), normalizeCells() (+3 more)

### Community 33 - "responsibility-kernel-catalog.ts"
Cohesion: 0.36
Nodes (9): ACTION_CATALOG, addActionRule(), attendanceKernelTemplate(), blankResponsibilityKernel(), CAPTURE_CATALOG, key(), leaveKernelTemplate(), simpleFormTemplate() (+1 more)

### Community 34 - "ResponsibilityKernelClient"
Cohesion: 0.23
Nodes (11): asKernel(), ResponsibilityKernelClient(), createResponsibility(), publish(), saveDraft(), withKernel(), KernelEffect, ResponsibilityKernel (+3 more)

### Community 35 - "devDependencies"
Cohesion: 0.18
Nodes (11): drizzle-kit, eslint-config-next, devDependencies, drizzle-kit, eslint-config-next, @tailwindcss/postcss, @types/pg, typescript (+3 more)

### Community 36 - "responsibility-kernel-compiler.ts"
Cohesion: 0.44
Nodes (9): actionToBaseAction(), captureToField(), captureType(), compileKernelToBaseDefinition(), hydrateKernelFromBaseDefinition(), normalizeKey(), requiredState(), resultingState() (+1 more)

### Community 37 - "tenant-provisioner.ts"
Cohesion: 0.29
Nodes (8): POST(), assertControlPlaneInstalled(), CORE_SQL, DEFAULT_ROLES, provisionCompany(), ProvisionCompanyInput, runSqlFile(), TENANT_PLATFORM_SQL

### Community 38 - "ResponsibilityWorldEditor"
Cohesion: 0.29
Nodes (10): actorResolverNeedsTarget(), currentUserResolver(), randomKey(), resolverTargetLabel(), ResponsibilityWorldEditor(), patchActor(), patchContext(), patchObject() (+2 more)

### Community 39 - "hasPermission"
Cohesion: 0.11
Nodes (28): dataSources, entityRecords, entityTypes, GET, POST, NOTE: dashboardHashedPassword is plaintext here despite the, GET, Context (+20 more)

### Community 41 - "package.json"
Cohesion: 0.29
Nodes (6): name, overrides, @types/react, @types/react-dom, private, version

### Community 42 - "toggle-group.tsx"
Cohesion: 0.43
Nodes (5): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 43 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, check, dev, lint, start

### Community 44 - "humanize"
Cohesion: 0.53
Nodes (6): humanize(), normalizeKey(), PossibilitiesEditor(), addAction(), addCapture(), randomKey()

### Community 45 - "eslint.config.mjs"
Cohesion: 0.40
Nodes (4): compat, __dirname, eslintConfig, __filename

### Community 46 - "workspace-manifest.ts"
Cohesion: 0.15
Nodes (18): PlatformRuntime, ResponsibilityDefinition, WorkflowRuntime, addNav(), BuildWorkspaceInput, buildWorkspaceManifest(), countState(), emptyStepRuntime() (+10 more)

### Community 47 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 49 - "workflowSchema.ts"
Cohesion: 0.14
Nodes (12): actionDefinitions, approvalPolicies, approvalPolicyActors, workflowDefinitions, workflowInstances, workflowStepDependencies, workflowStepInstances, workflowSteps (+4 more)

### Community 50 - "responsibility-power-templates.ts"
Cohesion: 0.40
Nodes (4): ResponsibilityBuilderMode, ResponsibilityExtensionConfig, RESPONSIBILITY_TEMPLATES, ResponsibilityTemplateDefinition

### Community 51 - "main"
Cohesion: 0.83
Nodes (3): main(), remove_path(), Path

### Community 52 - "organization-client.tsx"
Cohesion: 0.22
Nodes (5): EMPTY_TOTALS, OrganizationClient(), PortfolioCompany, PortfolioResponse, Stat()

### Community 63 - "responsibilities-client.tsx"
Cohesion: 0.07
Nodes (28): AssignmentsClient(), DynamicWorkClient(), RecordOutput(), BuilderAction, BuilderField, BuilderState, Canvas(), CanvasBlock (+20 more)

### Community 135 - "responsibility-platform-studio.tsx"
Cohesion: 0.20
Nodes (8): EntitiesClient(), create(), newField(), normalizeKey(), LegacyKey, ResponsibilityPlatformStudio(), TabKey, tabs

## Knowledge Gaps
- **347 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+342 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **80 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `sidebar.tsx`, `data-table-reusable.tsx`, `multi-select.tsx`, `toggle-group.tsx`, `button.tsx`, `alert-dialog.tsx`, `chart-area-reusable.tsx`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Why does `apiJson()` connect `apiJson` to `ResponsibilitiesClient`, `ResponsibilityKernelClient`, `workflows-client.tsx`, `responsibility-platform-studio.tsx`, `responsibility-kernel-client.tsx`, `DashboardAccessClient`, `ResponsibilityPowerClient`, `organization-client.tsx`, `responsibility-power-client.tsx`, `responsibilities-client.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `roles` connect `users` to `publish/route.ts`, `hasPermission`, `schema.ts`, `workflowSchema.ts`, `responsibility-templates/route.ts`, `editMapping/route.ts`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _347 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `publish/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08484848484848485 - nodes in this community are weakly interconnected._
- **Should `sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.04864311315924219 - nodes in this community are weakly interconnected._
- **Should `ResponsibilitiesClient` be split into smaller, more focused modules?**
  _Cohesion score 0.08456659619450317 - nodes in this community are weakly interconnected._