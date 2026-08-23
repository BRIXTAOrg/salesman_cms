import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { withTenantDb } from "@/lib/auth";
import { ensureTenantPlatformVNext } from "@/lib/platform-vnext-db";
import {
  responsibilityExtensions,
} from "../../../../../../../drizzle/platformVNextSchema";
import { mobileCapabilities } from "../../../../../../../drizzle/schema";

type Context = {
  params: Promise<{ id: string }>;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const GET = withTenantDb<Context>(
  async (_request, db, _session, context) => {
    await ensureTenantPlatformVNext(db);
    const { id } = await context.params;
    const responsibilityId = Number(id);

    if (!Number.isInteger(responsibilityId)) {
      return NextResponse.json(
        { success: false, error: "Invalid Responsibility id." },
        { status: 400 },
      );
    }

    const [responsibility] = await db
      .select({
        id: mobileCapabilities.id,
        key: mobileCapabilities.key,
        title: mobileCapabilities.title,
      })
      .from(mobileCapabilities)
      .where(eq(mobileCapabilities.id, responsibilityId))
      .limit(1);

    if (!responsibility) {
      return NextResponse.json(
        { success: false, error: "Responsibility not found." },
        { status: 404 },
      );
    }

    const [extension] = await db
      .select({
        publishedVersion: responsibilityExtensions.publishedVersion,
      })
      .from(responsibilityExtensions)
      .where(eq(responsibilityExtensions.responsibilityId, responsibilityId))
      .limit(1);

    const counts = await db.execute(sql`
      SELECT
        (
          SELECT count(*)::int
          FROM user_mobile_capabilities
          WHERE capability_id = ${responsibilityId}
        ) AS direct_assigned_users,
        (
          SELECT count(*)::int
          FROM capability_assignment_rules
          WHERE capability_id = ${responsibilityId}
            AND enabled = true
        ) AS assignment_rules
    `);

    const countRow = (counts.rows[0] ?? {}) as Record<string, unknown>;

    const deviceTable = await db.execute(sql`
      SELECT to_regclass('device_registrations')::text AS table_name
    `);
    const hasDeviceTable = Boolean(
      (deviceTable.rows[0] as { table_name?: string } | undefined)?.table_name,
    );

    let devices: Array<Record<string, unknown>> = [];

    if (hasDeviceTable) {
      const deviceRows = await db.execute(sql`
        SELECT
          d.id,
          d.user_id,
          d.device_id,
          d.platform,
          d.app_version,
          d.is_active,
          d.last_seen_at,
          d.last_sync_at,
          d.metadata,
          u.display_name,
          u.username,
          u.email
        FROM device_registrations d
        INNER JOIN users u ON u.id = d.user_id
        INNER JOIN user_mobile_capabilities umc
          ON umc.user_id = d.user_id
         AND umc.capability_id = ${responsibilityId}
        WHERE d.is_active = true
        ORDER BY d.last_seen_at DESC
        LIMIT 200
      `);

      const publishedVersion = extension?.publishedVersion ?? 0;
      const now = Date.now();

      devices = deviceRows.rows.map((row: Record<string, unknown>) => {
        const value = row;
        const metadata = asObject(value.metadata);
        const versions = asObject(
          metadata.responsibilityVersions ??
            metadata.responsibility_versions,
        );
        const reportedVersion = numeric(
          versions[responsibility.key] ??
            versions[String(responsibilityId)],
        );
        const supportedManifestVersion = numeric(
          metadata.supportedManifestVersion ??
            metadata.supported_manifest_version ??
            1,
        );
        const lastSeen = value.last_seen_at
          ? new Date(String(value.last_seen_at)).getTime()
          : 0;
        const online = lastSeen > 0 && now - lastSeen <= 2 * 60 * 1000;

        return {
          id: value.id,
          userId: value.user_id,
          userName:
            value.display_name ??
            value.username ??
            value.email ??
            `User ${value.user_id}`,
          deviceId: value.device_id,
          platform: value.platform,
          appVersion: value.app_version ?? null,
          model:
            metadata.model ??
            metadata.deviceModel ??
            metadata.device_model ??
            null,
          osVersion:
            metadata.osVersion ??
            metadata.os_version ??
            null,
          lastSeenAt: value.last_seen_at ?? null,
          lastSyncAt: value.last_sync_at ?? null,
          online,
          reportedVersion,
          supportedManifestVersion,
          compatible: supportedManifestVersion >= 2,
          updated:
            publishedVersion === 0 ||
            reportedVersion >= publishedVersion,
        };
      });
    }

    const onlineDevices = devices.filter((device) => device.online === true).length;
    const compatibleDevices = devices.filter((device) => device.compatible === true).length;
    const updatedDevices = devices.filter((device) => device.updated === true).length;

    return NextResponse.json({
      success: true,
      responsibility: {
        id: responsibility.id,
        key: responsibility.key,
        title: responsibility.title,
        publishedVersion: extension?.publishedVersion ?? 0,
      },
      assignment: {
        directAssignedUsers: numeric(countRow.direct_assigned_users),
        assignmentRules: numeric(countRow.assignment_rules),
      },
      deviceSummary: {
        registered: devices.length,
        online: onlineDevices,
        offline: devices.length - onlineDevices,
        compatible: compatibleDevices,
        updated: updatedDevices,
        pending: Math.max(devices.length - updatedDevices, 0),
      },
      devices,
      note:
        "Device delivery status becomes exact once the mobile app reports manifest versions in device metadata. Until then, unknown/legacy devices appear as pending or incompatible.",
    });
  },
);
