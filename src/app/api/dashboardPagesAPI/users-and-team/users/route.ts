// src/app/api/dashboardPagesAPI/users-and-team/users/route.ts
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { withTenantDb, hasPermission } from "@/lib/auth";
import { users, roles as rolesTable, userRoles } from "../../../../../../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

// =================
// POST ROUTE 
// =================

export const POST = withTenantDb(async (request, db, session) => {
    try {
        if (!hasPermission(session.permissions, "WRITE")) {
            return NextResponse.json({ error: 'Forbidden: WRITE access required' }, { status: 403 });
        }

        // --- 1. PARSE REQUEST DATA ---
        const body = await request.json();
        const {
            email, username, phoneNumber, jobRole, orgRole, zone, area,
            isDashboardUser, isSalesAppUser
        } = body;

        // jobRole is likely an array now based on your multi-role requirement
        const jobRolesArray = Array.isArray(jobRole) ? jobRole : [jobRole].filter(Boolean);

        if (!email || !username || (!orgRole && !jobRole)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // --- 2. EXISTING USER CHECK ---
        const existingUserResult = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (existingUserResult[0]) {
            return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
        }

        // --- 3. INSERT (User + Roles) ---
        // Note: No nested db.transaction() is needed here because withTenantDb 
        // already wraps this entire execution block in a transaction.
        const newUserData: any = {
            email,
            username,
            phoneNumber,

            // BACKWARD COMPATIBILITY save orgRole to legacy role column
            role: orgRole || 'junior-executive',

            zone,
            area,
            status: "active",
            isDashboardUser: !!isDashboardUser,
            isSalesAppUser: !!isSalesAppUser,
        };

        const credentials: any = {};
        const emailLocalPart = email.split('@')[0];
        
        // Reusable logic for "firstname@123"
        let defaultGeneratedPassword = "";
        if (emailLocalPart.includes('.')) {
            defaultGeneratedPassword = emailLocalPart.split('.')[0] + '@123';
        } else {
            defaultGeneratedPassword = emailLocalPart.substring(0, 6) + '@123';
        }

        // Credential Generation Logic
        if (newUserData.isDashboardUser) {
            // NOTE: dashboardHashedPassword is plaintext here despite the
            // column name -- matches app/api/auth/login/route.ts's
            // comparison (`user.dashboardHashedPassword !== password`),
            // which is also plaintext. This is a pre-existing pattern on
            // the dashboard-login side, left as-is here since fixing it
            // requires changing both sides together, not just this route.
            newUserData.dashboardLoginId = email;
            newUserData.dashboardHashedPassword = defaultGeneratedPassword;
            credentials.dashboardEmail = email;
            credentials.dashboardPassword = defaultGeneratedPassword;
        }

        if (newUserData.isSalesAppUser) {
            // ID becomes the phone number, password uses the identical dashboard logic
            const salesmanId = phoneNumber;
            const salesPassword = defaultGeneratedPassword;

            // Actually hash it here, matching the backend's bcrypt.compare
            // against salesAppPasswordHash in salesapp_backend/src/auth/login.ts.
            // Previously this saved the plaintext password into
            // salesAppPassword -- that field still exists as a legacy
            // fallback the backend auto-migrates on first login, but
            // there's no reason to rely on that path for brand-new users
            // when we can just hash it correctly up front.
            const salesPasswordHash = await bcrypt.hash(salesPassword, 12);

            newUserData.salesmanLoginId = salesmanId;
            newUserData.salesAppPasswordHash = salesPasswordHash;
            newUserData.salesAppPassword = null;
            credentials.salesmanId = salesmanId;
            credentials.salesmanPassword = salesPassword;
        }

        // A. Insert User
        const inserted = await db.insert(users).values(newUserData).returning();
        const createdUser = inserted[0];

        // B. Map and Insert Job Roles into userRoles table
        if (jobRolesArray.length > 0) {
            const dbRoles = await db
                .select({ id: rolesTable.id })
                .from(rolesTable)
                .where(
                    and(
                        eq(rolesTable.orgRole, newUserData.role),
                        inArray(rolesTable.jobRole, jobRolesArray)
                    )
                );

            if (dbRoles.length > 0) {
                const roleLinks = dbRoles.map(r => ({
                    userId: createdUser.id,
                    roleId: r.id
                }));
                await db.insert(userRoles).values(roleLinks);
            }
        }

        // 4. Return Data (No email sending)
        return NextResponse.json({
            message: 'User created successfully',
            user: createdUser,
            credentials
        }, { status: 201 });

    } catch (error: any) {
        console.error('Error creating user:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
});

// =======================================================
// GET
// =======================================================

export const GET = withTenantDb(async (request, db, session) => {
    try {
        if (!hasPermission(session.permissions, "READ")) {
            return NextResponse.json({ error: 'Forbidden: READ access required' }, { status: 403 });
        }

        // 1. Fetch all users explicitly joining roles to get orgRole and jobRole
        const rawData = await db
            .select({
                id: users.id,
                email: users.email,
                username: users.username,
                zone: users.zone,
                area: users.area,
                status: users.status,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
                phoneNumber: users.phoneNumber,
                deviceId: users.deviceId,
                isDashboardUser: users.isDashboardUser,
                isSalesAppUser: users.isSalesAppUser,
                salesmanLoginId: users.salesmanLoginId,
                // Role Data from JOIN
                orgRole: rolesTable.orgRole,
                jobRole: rolesTable.jobRole,
            })
            .from(users)
            .leftJoin(userRoles, eq(users.id, userRoles.userId))
            .leftJoin(rolesTable, eq(userRoles.roleId, rolesTable.id))
            .orderBy(desc(users.createdAt));

        // 2. Aggregate the multiple rows per user into a single object
        const usersMap = new Map();

        for (const row of rawData) {
            const userId = row.id;

            if (!usersMap.has(userId)) {
                // First time seeing this user, set up the base object
                usersMap.set(userId, {
                    id: row.id,
                    email: row.email,
                    username: row.username,
                    zone: row.zone,
                    area: row.area,
                    status: row.status,
                    createdAt: row.createdAt,
                    updatedAt: row.updatedAt,
                    phoneNumber: row.phoneNumber,
                    deviceId: row.deviceId,
                    isDashboardUser: row.isDashboardUser,
                    isSalesAppUser: row.isSalesAppUser,
                    salesmanLoginId: row.salesmanLoginId,
                    // Role processing
                    orgRole: row.orgRole || 'Unassigned',
                    jobRoles: new Set<string>(), // Use a Set to collect job roles without duplicates
                });
            }

            const u = usersMap.get(userId);

            // Add the job role from this row to the user's Set
            if (row.jobRole) {
                u.jobRoles.add(row.jobRole);
            }

            // If the first row we hit had a null orgRole, but a subsequent row has one, use it.
            if (row.orgRole && u.orgRole === 'Unassigned') {
                u.orgRole = row.orgRole;
            }
        }

        // 3. Format the final array, converting Set to Array
        const formattedUsers = Array.from(usersMap.values()).map(u => ({
            ...u,
            jobRole: Array.from(u.jobRoles) // Convert Set to Array for JSON transmission
        }));

        return NextResponse.json({ users: formattedUsers }, { status: 200 });

    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
});