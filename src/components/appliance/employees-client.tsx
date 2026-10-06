"use client";

/*
 * BRIXTA_CLEAN_UI_V1 — Employees.
 *
 * One list, one "Add employee" dialog, one "Manage" dialog.
 *   - Only name, employee ID and an app password are needed to add someone.
 *     The password is generated for you and shown once, ready to copy.
 *   - Manager / approver is optional ("Not set yet" is allowed).
 *   - Every error shows inside the dialog you're working in.
 */

import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldOff,
  UserRound,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import type {
  Employee,
  EmployeeDetail,
  ReportingPolicy,
  ReportingSnapshot,
  Role,
} from "@/lib/appliance-types";
import { MultiSelect } from "@/components/multi-select";
import { SearchSelect } from "@/components/search-select";
import { apiJson, cx, formatWhen } from "./client";
import ReportingPolicyEditor from "./reporting-policy-editor";
import RolesVNextClient from "./roles-vnext-client";
import {
  DangerButton,
  EmptyState,
  Field,
  inputClass,
  Modal,
  Notice,
  PageIntro,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
} from "./primitives";

const UNSET: ReportingPolicy = { version: 1, mode: "unset" };

// No 0/o, 1/l/i — easy to read out and type on a phone.
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function makePassword() {
  const bytes = new Uint32Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

function suggestEmployeeId(employees: Employee[]) {
  let highest = 0;
  for (const employee of employees) {
    const match = /^EMP-?(\d+)$/i.exec(employee.employeeCode ?? "");
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `EMP-${String(highest + 1).padStart(3, "0")}`;
}

function nameOf(employee: Employee) {
  return employee.name ?? employee.username ?? `Employee ${employee.id}`;
}

function splitList(value: string | null | undefined) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function capitalizeFirst(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

type Credentials = {
  name: string;
  employeeCode: string;
  password: string;
};

function CredentialsCard({
  credentials,
  companyCode,
}: {
  credentials: Credentials;
  companyCode: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const text = [
    companyCode ? `Company code: ${companyCode}` : null,
    `Employee ID: ${credentials.employeeCode}`,
    `Password: ${credentials.password}`,
  ]
    .filter(Boolean)
    .join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copy didn't work here. Select the text and copy it.");
    }
  }

  return (
    <div className="space-y-4">
      <Notice tone="good">
        {credentials.name} can now sign in to the field app. Share these details with them; the
        password won&apos;t be shown again.
      </Notice>
      <dl className="grid gap-3 rounded-[12px] border bg-[#FAFBFA] p-4 sm:grid-cols-3">
        {companyCode && (
          <div>
            <dt className="text-[12px] text-muted-foreground">Company code</dt>
            <dd className="mt-0.5 font-mono text-[15px] font-medium">{companyCode}</dd>
          </div>
        )}
        <div>
          <dt className="text-[12px] text-muted-foreground">Employee ID</dt>
          <dd className="mt-0.5 font-mono text-[15px] font-medium">{credentials.employeeCode}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted-foreground">Password</dt>
          <dd className="mt-0.5 font-mono text-[15px] font-medium">{credentials.password}</dd>
        </div>
      </dl>
      <SecondaryButton onClick={() => void copy()}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy login details"}
      </SecondaryButton>
    </div>
  );
}

export default function EmployeesClient() {
  const [tab, setTab] = useState<"people" | "roles">("people");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const [meId, setMeId] = useState<number | null>(null);

  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState<"active" | "all" | "inactive">("active");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [employeeBody, roleBody] = await Promise.all([
        apiJson<{ employees: Employee[] }>("/api/appliance/employees"),
        apiJson<{ roles: Role[] }>("/api/appliance/roles"),
      ]);
      setEmployees(employeeBody.employees ?? []);
      setRoles(roleBody.roles ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load employees.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    apiJson<{ schemaName?: string; userId?: number }>("/api/me")
      .then((me) => {
        setCompanyCode(me.schemaName ?? null);
        setMeId(typeof me.userId === "number" ? me.userId : null);
      })
      .catch(() => setCompanyCode(null));
  }, [load]);

  const departmentOptions = useMemo(
    () =>
      [...new Set(roles.map((role) => role.jobRole).filter((value): value is string => Boolean(value)))]
        .sort()
        .map((value) => ({ label: value, value })),
    [roles],
  );

  const designationOptions = useMemo(
    () =>
      [...new Set(roles.map((role) => role.orgRole).filter((value): value is string => Boolean(value)))]
        .sort()
        .map((value) => ({ label: value, value })),
    [roles],
  );

  const departments = useMemo(
    () => [...new Set(employees.flatMap((employee) => splitList(employee.department)))].sort(),
    [employees],
  );

  const counts = useMemo(() => {
    const active = employees.filter((employee) => employee.status === "active").length;
    return { all: employees.length, active, inactive: employees.length - active };
  }, [employees]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return employees
      .filter((employee) => {
        if (status === "active" && employee.status !== "active") return false;
        if (status === "inactive" && employee.status === "active") return false;
        if (department !== "all" && !splitList(employee.department).includes(department)) return false;
        if (!needle) return true;
        return [
          employee.name,
          employee.username,
          employee.employeeCode,
          employee.department,
          employee.designation,
          employee.phoneNumber,
          employee.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  }, [employees, query, department, status]);

  const [creating, setCreating] = useState(false);
  const [manageId, setManageId] = useState<number | null>(null);

  if (tab === "roles") {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
        <Tabs tab={tab} onChange={setTab} />
        <RolesVNextClient />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        title="Employees"
        description="Everyone on your team. Add someone, give them a field app login and choose their manager."
        action={
          <>
            <SecondaryButton onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </SecondaryButton>
            <PrimaryButton onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Add employee
            </PrimaryButton>
          </>
        }
      />

      <Tabs tab={tab} onChange={setTab} />

      {loadError && (
        <Notice tone="danger">
          {loadError}{" "}
          <button type="button" className="font-medium underline" onClick={() => void load()}>
            Try again
          </button>
        </Notice>
      )}

      <Panel className="p-0 md:p-0">
        <div className="flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center">
          <div className="flex h-10 w-full min-w-0 shrink-0 items-center gap-2 rounded-[10px] md:flex-1 border border-input bg-white px-3 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(47,107,98,0.15)]">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, ID, phone or department"
              aria-label="Search employees"
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
            />
          </div>
          <select
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            className={cx(inputClass, "md:w-52")}
            aria-label="Department"
          >
            <option value="all">All departments</option>
            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="flex rounded-[10px] border border-input bg-[#F6F7F5] p-0.5" role="group" aria-label="Status">
            {(
              [
                ["active", `Active ${counts.active}`],
                ["inactive", `Inactive ${counts.inactive}`],
                ["all", `All ${counts.all}`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={cx(
                  "h-9 rounded-[8px] px-3 text-[13px] font-medium transition-colors",
                  status === value ? "bg-white text-foreground shadow-[0_1px_2px_rgba(29,35,33,0.08)]" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading && employees.length === 0 ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={employees.length === 0 ? "No employees yet" : "No one matches these filters"}
              description={
                employees.length === 0
                  ? "Add your first employee to give them a field app login."
                  : "Try another name, department or status."
              }
              action={
                employees.length === 0 ? (
                  <PrimaryButton onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" />
                    Add employee
                  </PrimaryButton>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[14px]">
              <thead>
                <tr className="border-b bg-[#F7F8F6] text-[12.5px] text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Phone</th>
                  <th className="px-4 py-2.5 font-semibold">Department</th>
                  <th className="px-4 py-2.5 font-semibold">Manager</th>
                  <th className="px-4 py-2.5 font-semibold">Last seen</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((employee) => (
                  <tr
                    key={employee.id}
                    onClick={() => setManageId(employee.id)}
                    className="cursor-pointer border-b last:border-b-0 hover:bg-[#F9FAF8]"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{nameOf(employee)}</div>
                      <div className="text-[12.5px] text-muted-foreground">
                        {employee.employeeCode ?? "No app login"}
                        {employee.designation ? `, ${employee.designation}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{employee.phoneNumber || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{employee.department || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {employee.reportingStatus === "resolved"
                        ? employee.reportingManagerName ?? "Set"
                        : employee.reportingStatus === "top_level"
                          ? "Top level"
                          : employee.reportingStatus === "ambiguous" || employee.reportingStatus === "invalid"
                            ? <span className="text-[#9A2A1F]">Needs fixing</span>
                            : "Not set"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatWhen(employee.lastSeenAt)}</td>
                    <td className="px-4 py-3">
                      <Pill tone={employee.status === "active" ? "good" : employee.status === "suspended" ? "danger" : "neutral"}>
                        {employee.status === "active" ? "Active" : employee.status === "suspended" ? "Suspended" : "Inactive"}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <SecondaryButton
                        className="h-8 px-3 text-[13px]"
                        onClick={(event) => {
                          event.stopPropagation();
                          setManageId(employee.id);
                        }}
                      >
                        Manage
                      </SecondaryButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {creating && (
        <AddEmployeeDialog
          employees={employees}
          roles={roles}
          departmentOptions={departmentOptions}
          designationOptions={designationOptions}
          companyCode={companyCode}
          onClose={() => setCreating(false)}
          onCreated={() => void load()}
        />
      )}

      {manageId !== null && (
        <ManageEmployeeDialog
          employeeId={manageId}
          employees={employees}
          roles={roles}
          departmentOptions={departmentOptions}
          designationOptions={designationOptions}
          companyCode={companyCode}
          isMe={meId !== null && manageId === meId}
          onClose={() => setManageId(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

function Tabs({
  tab,
  onChange,
}: {
  tab: "people" | "roles";
  onChange: (tab: "people" | "roles") => void;
}) {
  return (
    <div className="flex gap-1 border-b">
      {(
        [
          ["people", "People"],
          ["roles", "Roles & permissions"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cx(
            "-mb-px border-b-2 px-3 pb-2.5 pt-1 text-[14px] font-medium transition-colors",
            tab === value
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type Option = { label: string; value: string };

function AddEmployeeDialog({
  employees,
  roles,
  departmentOptions,
  designationOptions,
  companyCode,
  onClose,
  onCreated,
}: {
  employees: Employee[];
  roles: Role[];
  departmentOptions: Option[];
  designationOptions: Option[];
  companyCode: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [employeeCode, setEmployeeCode] = useState(() => suggestEmployeeId(employees));
  const [password, setPassword] = useState(makePassword);
  const [departmentsPicked, setDepartmentsPicked] = useState<string[]>([]);
  const [designation, setDesignation] = useState("");
  const [area, setArea] = useState("");
  const [zone, setZone] = useState("");
  const [policy, setPolicy] = useState<ReportingPolicy>(UNSET);
  const [showReporting, setShowReporting] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<Credentials | null>(null);

  function reset() {
    setName("");
    setPhone("");
    setEmail("");
    setEmployeeCode(suggestEmployeeId(employees));
    setPassword(makePassword());
    setDepartmentsPicked([]);
    setDesignation("");
    setArea("");
    setZone("");
    setPolicy(UNSET);
    setShowReporting(false);
    setError(null);
    setFieldErrors({});
    setCreated(null);
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const problems: Record<string, string> = {};
    if (!name.trim()) problems.name = "Enter their name.";
    if (!employeeCode.trim()) problems.employeeCode = "Enter an employee ID.";
    if (password.length < 6) problems.password = "At least 6 characters.";
    const digits = phone.replace(/\D/g, "");
    if (phone.trim() && digits.length < 6) problems.phone = "This phone number looks too short.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) problems.email = "Check the email address.";
    if (policy.mode === "specific_user" && !policy.userId) problems.policy = "Pick the manager, or choose “Not set yet”.";
    if (policy.mode === "role" && !policy.roleId) problems.policy = "Pick the manager's role, or choose “Not set yet”.";
    setFieldErrors(problems);
    if (Object.keys(problems).length) {
      setError("Fix the highlighted fields.");
      if (problems.policy) setShowReporting(true);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiJson("/api/appliance/employees", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          employeeCode: employeeCode.trim(),
          password,
          phoneNumber: phone.trim() || null,
          email: email.trim() || null,
          department: departmentsPicked.length ? departmentsPicked.join(", ") : null,
          designation: designation.trim() || null,
          role: designation.trim() || null,
          area: area.trim() || null,
          zone: zone.trim() || null,
          ...(policy.mode === "unset" ? {} : { reportingPolicy: policy }),
          responsibilityIds: [],
          roleIds: [],
        }),
      });
      setCreated({ name: name.trim(), employeeCode: employeeCode.trim(), password });
      toast.success(`${name.trim()} was added.`);
      onCreated();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not add this employee.");
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <Modal
        open
        size="md"
        title="Employee added"
        onClose={onClose}
        footer={
          <>
            <SecondaryButton onClick={reset}>Add another</SecondaryButton>
            <PrimaryButton onClick={onClose}>Done</PrimaryButton>
          </>
        }
      >
        <CredentialsCard credentials={created} companyCode={companyCode} />
      </Modal>
    );
  }

  return (
    <Modal
      open
      size="lg"
      title="Add employee"
      description="Only the name, employee ID and password are required. Everything else can be added later."
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add employee
          </PrimaryButton>
        </>
      }
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-6" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}

        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={fieldErrors.name} className="sm:col-span-2">
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="e.g. Rahul Das"
            />
          </Field>
          <Field label="Phone" hint="Employees can also sign in with this number." error={fieldErrors.phone}>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={inputClass}
              inputMode="tel"
              placeholder="98XXXXXXXX"
            />
          </Field>
          <Field label="Email" error={fieldErrors.email}>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              type="email"
              placeholder="Optional"
            />
          </Field>
        </section>

        <section className="space-y-3">
          <div className="text-[14px] font-semibold">Field app login</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee ID" required hint="They type this to sign in." error={fieldErrors.employeeCode}>
              <input
                value={employeeCode}
                onChange={(event) => setEmployeeCode(event.target.value.toUpperCase())}
                className={cx(inputClass, "font-mono")}
              />
            </Field>
            <Field label="Password" required hint="Generated for you. You can type your own." error={fieldErrors.password}>
              <div className="flex gap-2">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={cx(inputClass, "font-mono")}
                  aria-label="Password"
                />
                <SecondaryButton
                  className="w-10 shrink-0 px-0"
                  title="Make a new password"
                  aria-label="Make a new password"
                  onClick={() => setPassword(makePassword())}
                >
                  <Wand2 className="h-4 w-4" />
                </SecondaryButton>
              </div>
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <div className="text-[14px] font-semibold">Team</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department">
              <MultiSelect
                options={departmentOptions}
                selectedValues={departmentsPicked}
                onValueChange={setDepartmentsPicked}
                placeholder="Choose departments"
              />
            </Field>
            <Field label="Designation">
              <SearchSelect
                options={designationOptions}
                value={designation}
                onChange={(next) => setDesignation(String(next ?? ""))}
                placeholder="Choose a designation"
              />
            </Field>
            <Field label="Area">
              <input
                value={area}
                onChange={(event) => setArea(capitalizeFirst(event.target.value))}
                className={inputClass}
                placeholder="e.g. Guwahati East"
              />
            </Field>
            <Field label="Zone">
              <input
                value={zone}
                onChange={(event) => setZone(capitalizeFirst(event.target.value))}
                className={inputClass}
                placeholder="e.g. North-East"
              />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[14px] font-semibold">Manager and approver</div>
              <div className="text-[13px] text-muted-foreground">
                {policy.mode === "unset" ? "Not set yet. You can set it later." : "Set."}
              </div>
            </div>
            {!showReporting && (
              <SecondaryButton className="h-9" onClick={() => setShowReporting(true)}>
                Set manager
              </SecondaryButton>
            )}
          </div>
          {showReporting && (
            <>
              <ReportingPolicyEditor value={policy} onChange={setPolicy} employees={employees} roles={roles} />
              {fieldErrors.policy && <p className="text-[12.5px] text-[#B42318]">{fieldErrors.policy}</p>}
            </>
          )}
        </section>

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

function ManageEmployeeDialog({
  employeeId,
  employees,
  roles,
  departmentOptions,
  designationOptions,
  companyCode,
  isMe = false,
  onClose,
  onChanged,
}: {
  employeeId: number;
  employees: Employee[];
  roles: Role[];
  departmentOptions: Option[];
  designationOptions: Option[];
  companyCode: string | null;
  isMe?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [departmentsPicked, setDepartmentsPicked] = useState<string[]>([]);
  const [designation, setDesignation] = useState("");
  const [area, setArea] = useState("");
  const [zone, setZone] = useState("");
  const [policy, setPolicy] = useState<ReportingPolicy>(UNSET);
  const [snapshot, setSnapshot] = useState<ReportingSnapshot | null>(null);
  const [roleIds, setRoleIds] = useState<number[]>([]);

  const [busy, setBusy] = useState<null | "profile" | "roles" | "status" | "password">(null);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<Credentials | null>(null);

  const loadDetail = useCallback(async () => {
    setLoadError(null);
    try {
      const body = await apiJson<EmployeeDetail>(`/api/appliance/employees/${employeeId}`);
      setDetail(body);
      const employee = body.employee;
      setName(employee.name ?? employee.username ?? "");
      setPhone(employee.phoneNumber ?? "");
      setEmail(employee.email ?? "");
      setDepartmentsPicked(splitList(employee.department));
      setDesignation(employee.designation ?? "");
      setArea(employee.area === "area" ? "" : employee.area ?? "");
      setZone(employee.zone === "zone" ? "" : employee.zone ?? "");
      setPolicy(
        body.reporting?.policy ??
          (employee.reportsToId
            ? { version: 1, mode: "specific_user", userId: employee.reportsToId }
            : UNSET),
      );
      setSnapshot(body.reporting ?? null);
      setRoleIds(body.directRoleIds ?? []);
    } catch (failure) {
      setLoadError(failure instanceof Error ? failure.message : "Could not open this employee.");
    }
  }, [employeeId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function saveProfile(event?: FormEvent) {
    event?.preventDefault();
    if (!name.trim()) {
      setError("Enter their name.");
      return;
    }
    setBusy("profile");
    setError(null);
    try {
      await apiJson(`/api/appliance/employees/${employeeId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          phoneNumber: phone.trim() || null,
          email: email.trim() || null,
          department: departmentsPicked.length ? departmentsPicked.join(", ") : null,
          designation: designation.trim() || null,
          role: designation.trim() || null,
          area: area.trim() || null,
          zone: zone.trim() || null,
          reportingPolicy: policy,
        }),
      });
      toast.success("Changes saved.");
      onChanged();
      await loadDetail();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the changes.");
    } finally {
      setBusy(null);
    }
  }

  async function previewManager() {
    try {
      const body = await apiJson<ReportingSnapshot>(
        `/api/appliance/employees/${employeeId}/reporting-policy/preview`,
        { method: "POST", body: JSON.stringify({ reportingPolicy: policy }) },
      );
      setSnapshot(body);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not check this manager rule.");
    }
  }

  async function saveRoles() {
    setBusy("roles");
    setError(null);
    try {
      await apiJson(`/api/appliance/employees/${employeeId}/roles`, {
        method: "PUT",
        body: JSON.stringify({ roleIds }),
      });
      toast.success("Roles saved.");
      await loadDetail();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the roles.");
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(next: "active" | "suspended") {
    if (next === "suspended" && !window.confirm("Suspend this employee? Their app stops working right away.")) return;
    setBusy("status");
    setError(null);
    try {
      await apiJson(`/api/appliance/employees/${employeeId}/status`, {
        method: "POST",
        body: JSON.stringify({ status: next }),
      });
      toast.success(next === "active" ? "Employee re-activated." : "Employee suspended.");
      onChanged();
      await loadDetail();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not change the status.");
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword() {
    if (!window.confirm("Make a new app password? The old one stops working.")) return;
    const password = makePassword();
    setBusy("password");
    setError(null);
    try {
      await apiJson(`/api/appliance/employees/${employeeId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setNewPassword({
        name: name || "This employee",
        employeeCode: detail?.employee.employeeCode ?? "",
        password,
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not reset the password.");
    } finally {
      setBusy(null);
    }
  }

  const employee = detail?.employee;
  const active = employee?.status === "active";

  return (
    <Modal
      open
      size="lg"
      title={employee ? name || nameOf(employee) : "Employee"}
      description={
        employee
          ? [employee.employeeCode ? `ID ${employee.employeeCode}` : "No app login", employee.lastSeenAt ? `last seen ${formatWhen(employee.lastSeenAt).toLowerCase()}` : null]
              .filter(Boolean)
              .join(", ")
          : undefined
      }
      onClose={onClose}
      footer={
        employee ? (
          <>
            <div className="mr-auto flex items-center gap-2">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <Pill tone={active ? "good" : employee.status === "suspended" ? "danger" : "neutral"}>
                {active ? "Active" : employee.status === "suspended" ? "Suspended" : "Inactive"}
              </Pill>
            </div>
            {active && isMe ? (
              <span className="text-[13px] text-muted-foreground">This is you</span>
            ) : active ? (
              <DangerButton onClick={() => void changeStatus("suspended")} disabled={busy !== null}>
                <ShieldOff className="h-4 w-4" />
                Suspend
              </DangerButton>
            ) : (
              <SecondaryButton onClick={() => void changeStatus("active")} disabled={busy !== null}>
                Activate
              </SecondaryButton>
            )}
            <PrimaryButton onClick={() => void saveProfile()} disabled={busy !== null}>
              {busy === "profile" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </PrimaryButton>
          </>
        ) : undefined
      }
    >
      {loadError ? (
        <Notice tone="danger">{loadError}</Notice>
      ) : !detail ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {error && (
            <Notice tone="danger" onDismiss={() => setError(null)}>
              {error}
            </Notice>
          )}

          <form onSubmit={(event) => void saveProfile(event)} className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required className="sm:col-span-2">
              <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} inputMode="tel" />
            </Field>
            <Field label="Email">
              <input value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} type="email" />
            </Field>
            <Field label="Department">
              <MultiSelect
                options={departmentOptions}
                selectedValues={departmentsPicked}
                onValueChange={setDepartmentsPicked}
                placeholder="Choose departments"
              />
            </Field>
            <Field label="Designation">
              <SearchSelect
                options={designationOptions}
                value={designation}
                onChange={(next) => setDesignation(String(next ?? ""))}
                placeholder="Choose a designation"
              />
            </Field>
            <Field label="Area">
              <input value={area} onChange={(event) => setArea(capitalizeFirst(event.target.value))} className={inputClass} />
            </Field>
            <Field label="Zone">
              <input value={zone} onChange={(event) => setZone(capitalizeFirst(event.target.value))} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <ReportingPolicyEditor
                value={policy}
                onChange={(next) => {
                  setPolicy(next);
                  setSnapshot(null);
                }}
                employees={employees}
                roles={roles}
                subjectId={employeeId}
                snapshot={snapshot}
                onPreview={() => void previewManager()}
              />
            </div>
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>

          <section className="rounded-[12px] border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[14px] font-semibold">Field app login</div>
                <div className="text-[13px] text-muted-foreground">
                  {employee?.employeeCode
                    ? `Signs in with ${employee.employeeCode}${employee.phoneNumber ? ` or ${employee.phoneNumber}` : ""}.`
                    : "No app login yet."}
                </div>
              </div>
              <SecondaryButton onClick={() => void resetPassword()} disabled={busy !== null}>
                {busy === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                New password
              </SecondaryButton>
            </div>
            {newPassword && (
              <div className="mt-4">
                <CredentialsCard credentials={newPassword} companyCode={companyCode} />
              </div>
            )}
          </section>

          <section className="rounded-[12px] border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[14px] font-semibold">Responsibilities</div>
                <div className="text-[13px] text-muted-foreground">
                  {detail.responsibilities.length
                    ? `${detail.responsibilities.length} in their app right now.`
                    : "Nothing assigned yet."}
                </div>
              </div>
              <Link
                href="/dashboard/workspace/assignments"
                className="brixta-secondary-button inline-flex h-9 items-center px-3 text-[13px] font-medium"
              >
                Open assignments
              </Link>
            </div>
            {detail.responsibilities.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {detail.responsibilities.map((responsibility) => (
                  <Pill key={responsibility.id}>{responsibility.title}</Pill>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[12px] border p-4">
            <div className="text-[14px] font-semibold">Approval roles</div>
            <div className="mb-3 text-[13px] text-muted-foreground">
              Approval steps in workflows use these roles to find who decides.
            </div>
            <MultiSelect
              options={roles.map((role) => ({ label: role.label, value: String(role.id) }))}
              selectedValues={roleIds.map(String)}
              onValueChange={(values) => setRoleIds(values.map(Number))}
              placeholder="Choose roles"
            />
            <div className="mt-3 flex justify-end">
              <SecondaryButton onClick={() => void saveRoles()} disabled={busy !== null}>
                {busy === "roles" && <Loader2 className="h-4 w-4 animate-spin" />}
                Save roles
              </SecondaryButton>
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
