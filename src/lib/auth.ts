// src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { JWT_KEY } from './Reusable-constants';
import { withTenantSchema, type AppDatabase } from './drizzle';
import { eq } from 'drizzle-orm';
import { roles, userRoles, users } from '../../drizzle/schema';

export type { AppDatabase };

// In production, MUST use a strong, random 32+ character string in your .env
const key = new TextEncoder().encode(JWT_KEY);

// BRIXTA_CMS_TOKEN_AUDIENCE_V1
// Dashboard cookies are stamped "brixta-cms" and mobile tokens
// "brixta-mobile", so one can never be replayed as the other even if both
// services share the same JWT_SECRET.
export const CMS_TOKEN_AUDIENCE = 'brixta-cms';

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setAudience(CMS_TOKEN_AUDIENCE)
    .setExpirationTime('7d') // Session lasts 7 days
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    });

    if (payload.aud === undefined) {
      // Cookies issued before the audience stamp (they expire within 7
      // days). Accept only dashboard-shaped ones: mobile tokens never carry
      // a permissions list.
      return Array.isArray((payload as any).permissions) ? payload : null;
    }

    const audiences = Array.isArray(payload.aud)
      ? payload.aud
      : [payload.aud];

    return audiences.includes(CMS_TOKEN_AUDIENCE) ? payload : null;
  } catch (error) {
    return null;
  }
}

export type Session = {
  token: string;
  userId: number;
  schemaName: string;
  companyName: string;
  username: string;
  email: string;
  orgRole: string;
  jobRoles: string[];
  permissions: string[];
};

export async function verifySession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;

  const payload = await decrypt(token);
  //console.log("Decrypted paylod in auth.ts: ", payload);
  if (!payload) return null;

  return {
    token,
    userId: payload.userId as number,
    schemaName: payload.schemaName as string,
    companyName: (payload.companyName as string) || 'Company',
    username: payload.username as string,
    email: payload.email as string,
    orgRole: (payload.orgRole as string) || '',
    jobRoles: (payload.jobRoles as string[]) || [],
    permissions: (payload.permissions as string[]) || [], 
  };
}

// Simple helper function to use in routes
export function hasPermission(sessionPerms: string[], required: string | string[]): boolean {
  // We can also bake the ALL_ACCESS check right for ADMIN user in here to save time!
  if (sessionPerms.includes('ALL_ACCESS')) return true;
  
  // If an array was passed, check if the user has AT LEAST ONE of them
  if (Array.isArray(required)) {
    return required.some(perm => sessionPerms.includes(perm));
  }
  
  // If a single string was passed, just check that one
  return sessionPerms.includes(required);
}

// BRIXTA_LIVE_DASHBOARD_ACCESS_V1
// The cookie says who you are; the database says what you may do *now*.
// Switching someone's dashboard access off, deactivating them or changing
// their role takes effect on their very next request instead of after the
// 7-day cookie expires.
export async function liveDashboardAccess(
  db: AppDatabase,
  userId: number,
): Promise<
  | { ok: false; status: number; error: string }
  | { ok: true; orgRole: string; jobRoles: string[]; permissions: string[] }
> {
  if (!Number.isInteger(userId) || userId <= 0) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const [user] = await db
    .select({
      status: users.status,
      isDashboardUser: users.isDashboardUser,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.isDashboardUser) {
    return {
      ok: false,
      status: 401,
      error: 'Dashboard access is not enabled for this account.',
    };
  }

  if (user.status !== 'active') {
    return {
      ok: false,
      status: 401,
      error: 'This dashboard account is not active.',
    };
  }

  const roleRows = await db
    .select({
      orgRole: roles.orgRole,
      jobRole: roles.jobRole,
      grantedPerms: roles.grantedPerms,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  const permissions: string[] = Array.from(
    new Set<string>(
      roleRows.flatMap((row) =>
        Array.isArray(row.grantedPerms) ? (row.grantedPerms as string[]) : [],
      ),
    ),
  );

  if (permissions.length === 0) {
    return {
      ok: false,
      status: 403,
      error: 'Dashboard permissions are not configured for this account.',
    };
  }

  return {
    ok: true,
    permissions,
    orgRole:
      roleRows
        .map((row) => row.orgRole)
        .find((value): value is string => Boolean(value)) ?? '',
    jobRoles: Array.from(
      new Set<string>(
        roleRows
          .map((row) => row.jobRole)
          .filter((value): value is string => Boolean(value)),
      ),
    ),
  };
}

/**
 * CMS equivalent of the backend's middleware/auth.ts withTenantDb --
 * wraps a Next.js route handler so it receives a `db` already scoped to
 * the caller's tenant schema (via the session cookie's schemaName),
 * instead of the route importing the module-level `db` singleton from
 * lib/drizzle directly.
 *
 * Works for both static routes and dynamic ones with [param] segments --
 * `context` is passed through untouched so `context.params` still works
 * exactly like it does in a normal route handler.
 *
 * Usage:
 *   export const GET = withTenantDb(async (req, db, session) => {
 *     const rows = await db.select().from(dealers)...
 *     return NextResponse.json({ success: true, data: rows });
 *   });
 *
 *   // with dynamic route params:
 *   export const GET = withTenantDb(async (req, db, session, context) => {
 *     const { id } = await context.params;
 *     ...
 *   });
 */
export function withTenantDb<Ctx = unknown>(
  handler: (
    req: NextRequest,
    db: AppDatabase,
    session: Session,
    context: Ctx,
  ) => Promise<NextResponse>,
) {
  return async (req: NextRequest, context: Ctx) => {
    const session = await verifySession();

    if (!session?.schemaName) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    try {
      return await withTenantSchema(session.schemaName, async (db) => {
        const access = await liveDashboardAccess(db, session.userId);

        if (!access.ok) {
          return NextResponse.json(
            { success: false, error: access.error },
            { status: access.status },
          );
        }

        return handler(
          req,
          db,
          {
            ...session,
            orgRole: access.orgRole || session.orgRole,
            jobRoles: access.jobRoles,
            permissions: access.permissions,
          },
          context,
        );
      });
    } catch (error) {
      console.error('Tenant-scoped CMS route error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 },
      );
    }
  };
}