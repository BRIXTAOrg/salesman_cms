// src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { JWT_KEY } from './Reusable-constants';
import { withTenantSchema, type AppDatabase } from './drizzle';

export type { AppDatabase };

// In production, MUST use a strong, random 32+ character string in your .env
const key = new TextEncoder().encode(JWT_KEY);

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Session lasts 7 days
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    });
    return payload;
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
      return await withTenantSchema(session.schemaName, (db) =>
        handler(req, db, session, context),
      );
    } catch (error) {
      console.error('Tenant-scoped CMS route error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 },
      );
    }
  };
}