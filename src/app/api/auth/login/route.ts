// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, withTenantSchema } from '@/lib/drizzle';
import { users, roles, userRoles } from '../../../../../drizzle/schema';
import { organizations } from '../../../../../drizzle/publicSchema';
import { eq } from 'drizzle-orm';
import { encrypt } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyCode, email, password } = body;

    if (!companyCode || !email || !password) {
      return NextResponse.json({ error: 'Company code, email and password are required' }, { status: 400 });
    }

    // 1. Resolve tenant. Same as the backend's mobile login: this is the
    // ONE query that deliberately runs against the unscoped `db` --
    // public.organizations is the one thing every deployment can always
    // see, regardless of search_path, because there's no tenant to
    // resolve into yet at this point.
    const [org] = await db
      .select({ schemaName: organizations.schemaName })
      .from(organizations)
      .where(eq(organizations.schemaName, String(companyCode).trim().toLowerCase()))
      .limit(1);

    if (!org) {
      return NextResponse.json({ error: 'Invalid company code' }, { status: 401 });
    }

    // 2. Now that we know the schema, do everything else inside a
    // transaction with search_path locked to it.
    const result = await withTenantSchema(org.schemaName, async (tx) => {
      // Find user by Dashboard Login ID
      const userResult = await tx
        .select({
          user: users,
        })
        .from(users)
        .where(eq(users.dashboardLoginId, email))
        .limit(1);

      const row = userResult[0];

      if (!row || !row.user) {
        return { ok: false as const, status: 401, error: 'Invalid email or password' };
      }

      const user = row.user;

      // Check if they are allowed to use the dashboard
      if (!user.isDashboardUser) {
        return { ok: false as const, status: 403, error: 'Invalid email or ID' };
      }

      // Check if the password is correct
      if (user.dashboardHashedPassword !== password) {
        return { ok: false as const, status: 401, error: 'Invalid password' };
      }

      // Fetch assigned Job Roles and the associated CRUD permissions
      const userRolesResult = await tx
        .select({
          orgRole: roles.orgRole,
          jobRole: roles.jobRole,
          rawPermissions: roles.grantedPerms
        })
        .from(userRoles)
        .leftJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, user.id));

      const orgRolesList = userRolesResult.map(r => r.orgRole).filter(Boolean) as string[];
      const primaryOrgRole = orgRolesList.length > 0 ? orgRolesList[0] : '';
      const jobRoleNames = Array.from(new Set(userRolesResult.map(r => r.jobRole).filter(Boolean))) as string[];

      // Safely extract and flatten the permissions
      let extractedPerms: string[] = [];
      userRolesResult.forEach(row => {
        if (Array.isArray(row.rawPermissions)) {
          extractedPerms.push(...row.rawPermissions);
        } else if (typeof row.rawPermissions === 'string') {
          try {
            const parsed = JSON.parse(row.rawPermissions);
            if (Array.isArray(parsed)) extractedPerms.push(...parsed);
          } catch (e) {
            console.error("Failed to parse permissions string:", row.rawPermissions);
          }
        }
      });

      const allPerms = Array.from(new Set(extractedPerms));

      // Update Status if needed
      if (user.status !== 'active') {
        await tx.update(users).set({ status: 'active' }).where(eq(users.id, user.id));
      }

      return {
        ok: true as const,
        user,
        primaryOrgRole,
        jobRoleNames,
        allPerms,
      };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { user, primaryOrgRole, jobRoleNames, allPerms } = result;

    // 3. Create the JWT payload -- schemaName rides along on every
    // request from here, same as the mobile JWT.
    const sessionData = {
      userId: user.id,
      schemaName: org.schemaName,
      email: user.email,
      username: user.username,
      orgRole: primaryOrgRole,
      jobRoles: jobRoleNames,
      permissions: allPerms,
    };

    // 4. Encrypt and set cookie
    const token = await encrypt(sessionData);
    const cookieStore = await cookies();

    cookieStore.set('auth_token', token, {
      httpOnly: true,
      //secure: process.env.NODE_ENV === 'production',
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return NextResponse.json({
      message: 'Login successful',
      user: {
        isDashboardUser: user.isDashboardUser,
        isSalesAppUser: user.isSalesAppUser
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}