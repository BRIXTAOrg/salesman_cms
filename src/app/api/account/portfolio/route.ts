import { NextResponse } from "next/server";
import {
  and,
  asc,
  count,
  eq,
  sql,
} from "drizzle-orm";

import { verifySession } from "@/lib/auth";
import { listOrganizationsForAccountEmail } from "@/lib/account-platform";
import { withTenantSchema } from "@/lib/drizzle";
import {
  mobileCapabilities,
  users,
} from "../../../../../drizzle/schema";
import {
  workflowDefinitions,
} from "../../../../../drizzle/workflowSchema";

type AccountOrganization = Awaited<
  ReturnType<typeof listOrganizationsForAccountEmail>
>[number];

type PersonPreview = {
  id: number;
  name: string;
  designation: string | null;
  department: string | null;
};

type ResponsibilityPreview = {
  id: number;
  key: string;
  title: string;
};

type WorkflowPreview = {
  id: number;
  key: string;
  name: string;
};

type CompanyPortfolio = {
  id: number;
  name: string;
  schemaName: string;
  isProvisioned: boolean;
  platformVersion?: number;
  registryStatus?: string;
  isCurrent: boolean;
  available: boolean;
  stats: {
    activeEmployees: number;
    departments: number;
    responsibilities: number;
    workflows: number;
  };
  departments: string[];
  people: PersonPreview[];
  responsibilities: ResponsibilityPreview[];
  workflows: WorkflowPreview[];
  error?: string;
};

const PREVIEW_PEOPLE = 8;
const PREVIEW_RESPONSIBILITIES = 8;
const PREVIEW_WORKFLOWS = 6;
const MAX_PARALLEL_COMPANIES = 4;

async function loadCompany(
  organization: AccountOrganization,
  currentSchemaName: string,
): Promise<CompanyPortfolio> {
  const base = {
    id: organization.id,
    name: organization.name,
    schemaName: organization.schemaName,
    isProvisioned: organization.isProvisioned,
    platformVersion: organization.platformVersion,
    registryStatus: organization.registryStatus,
    isCurrent: organization.schemaName === currentSchemaName,
  };

  if (!organization.isProvisioned) {
    return {
      ...base,
      available: false,
      stats: {
        activeEmployees: 0,
        departments: 0,
        responsibilities: 0,
        workflows: 0,
      },
      departments: [],
      people: [],
      responsibilities: [],
      workflows: [],
      error: "Company is not fully provisioned yet.",
    };
  }

  try {
    return await withTenantSchema(
      organization.schemaName,
      async (db) => {
        const workforceFilter = and(
          eq(users.status, "active"),
          eq(users.isSalesAppUser, true),
        );

        const [employeeCountRow] = await db
          .select({ value: count() })
          .from(users)
          .where(workforceFilter);

        const departmentRows = await db
          .selectDistinct({
            department: users.department,
          })
          .from(users)
          .where(workforceFilter)
          .orderBy(asc(users.department));

        const peopleRows = await db
          .select({
            id: users.id,
            displayName: users.displayName,
            username: users.username,
            email: users.email,
            designation: users.designation,
            department: users.department,
          })
          .from(users)
          .where(workforceFilter)
          .orderBy(
            asc(users.department),
            asc(users.displayName),
            asc(users.username),
          )
          .limit(PREVIEW_PEOPLE);

        const [responsibilityCountRow] = await db
          .select({ value: count() })
          .from(mobileCapabilities)
          .where(eq(mobileCapabilities.isActive, true));

        const responsibilityRows = await db
          .select({
            id: mobileCapabilities.id,
            key: mobileCapabilities.key,
            title: mobileCapabilities.title,
          })
          .from(mobileCapabilities)
          .where(eq(mobileCapabilities.isActive, true))
          .orderBy(asc(mobileCapabilities.title))
          .limit(PREVIEW_RESPONSIBILITIES);

        // Older tenants may not have workflow tables yet. Treat that as
        // zero workflows instead of failing the entire account panorama.
        const workflowTable = await db.execute(sql`
          SELECT to_regclass('workflow_definitions')::text AS table_name
        `);

        let workflowCount = 0;
        let workflowRows: WorkflowPreview[] = [];

        if (
          (workflowTable.rows[0] as { table_name?: string } | undefined)
            ?.table_name
        ) {
          const [workflowCountRow] = await db
            .select({ value: count() })
            .from(workflowDefinitions)
            .where(eq(workflowDefinitions.isActive, true));

          workflowCount = Number(workflowCountRow?.value ?? 0);

          workflowRows = await db
            .select({
              id: workflowDefinitions.id,
              key: workflowDefinitions.key,
              name: workflowDefinitions.name,
            })
            .from(workflowDefinitions)
            .where(eq(workflowDefinitions.isActive, true))
            .orderBy(asc(workflowDefinitions.name))
            .limit(PREVIEW_WORKFLOWS);
        }

        const departments = departmentRows
          .map((row) => row.department?.trim() ?? "")
          .filter(Boolean);

        return {
          ...base,
          available: true,
          stats: {
            activeEmployees: Number(employeeCountRow?.value ?? 0),
            departments: departments.length,
            responsibilities: Number(
              responsibilityCountRow?.value ?? 0,
            ),
            workflows: workflowCount,
          },
          departments,
          people: peopleRows.map((person) => ({
            id: person.id,
            name:
              person.displayName?.trim() ||
              person.username?.trim() ||
              person.email,
            designation: person.designation,
            department: person.department,
          })),
          responsibilities: responsibilityRows,
          workflows: workflowRows,
        };
      },
    );
  } catch (error) {
    console.error(
      `Account portfolio read failed for ${organization.schemaName}:`,
      error,
    );

    return {
      ...base,
      available: false,
      stats: {
        activeEmployees: 0,
        departments: 0,
        responsibilities: 0,
        workflows: 0,
      },
      departments: [],
      people: [],
      responsibilities: [],
      workflows: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to read this company.",
    };
  }
}

async function mapWithLimit<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const result = new Array<R>(values.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;

      if (index >= values.length) {
        return;
      }

      result[index] = await mapper(values[index]);
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          Math.max(limit, 1),
          Math.max(values.length, 1),
        ),
      },
      () => worker(),
    ),
  );

  return result;
}

export async function GET() {
  const session = await verifySession();

  if (!session?.email || !session.schemaName) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  try {
    // This is the authorization boundary: only organizations already
    // attached to the signed-in account can enter the cross-company read.
    const organizations = await listOrganizationsForAccountEmail(
      session.email,
    );

    const companies = await mapWithLimit(
      organizations,
      MAX_PARALLEL_COMPANIES,
      (organization) =>
        loadCompany(
          organization,
          session.schemaName,
        ),
    );

    return NextResponse.json({
      success: true,
      currentSchemaName: session.schemaName,
      companies,
      totals: {
        companies: companies.length,
        activeEmployees: companies.reduce(
          (sum, company) =>
            sum + company.stats.activeEmployees,
          0,
        ),
        departments: companies.reduce(
          (sum, company) =>
            sum + company.stats.departments,
          0,
        ),
        responsibilities: companies.reduce(
          (sum, company) =>
            sum + company.stats.responsibilities,
          0,
        ),
        workflows: companies.reduce(
          (sum, company) =>
            sum + company.stats.workflows,
          0,
        ),
      },
    });
  } catch (error) {
    console.error("Account portfolio error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load account portfolio.",
      },
      { status: 500 },
    );
  }
}
