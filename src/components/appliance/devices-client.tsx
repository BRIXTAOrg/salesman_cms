
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Loader2,
  RefreshCw,
  ShieldOff,
  Smartphone,
  WifiOff,
} from "lucide-react";

import type {
  Device,
  Employee,
} from "@/lib/appliance-types";
import {
  apiJson,
  formatWhen,
} from "./client";
import {
  EmptyState,
  PageIntro,
  Panel,
  Pill,
  SecondaryButton,
  Stat,
} from "./primitives";

export default function DevicesClient() {
  const [devices, setDevices] =
    useState<Device[]>([]);
  const [employees, setEmployees] =
    useState<Employee[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [message, setMessage] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [
        deviceBody,
        employeeBody,
      ] = await Promise.all([
        apiJson<{
          devices: Device[];
        }>("/api/appliance/devices"),
        apiJson<{
          employees: Employee[];
        }>("/api/appliance/employees"),
      ]);

      setDevices(
        deviceBody.devices ?? [],
      );
      setEmployees(
        employeeBody.employees ?? [],
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load devices.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function employeeName(
    userId: number,
  ) {
    const employee = employees.find(
      (item) =>
        item.id === userId,
    );

    return (
      employee?.name ??
      employee?.employeeCode ??
      `Employee ${userId}`
    );
  }

  function isStale(
    value?: string | null,
  ) {
    if (!value) return true;

    return (
      Date.now() -
        new Date(
          value,
        ).getTime() >
      24 * 60 * 60 * 1000
    );
  }

  async function revoke(
    device: Device,
  ) {
    if (
      !window.confirm(
        "Revoke this device? The employee will need to register again.",
      )
    ) {
      return;
    }

    try {
      await apiJson(
        `/api/appliance/devices/${device.id}/revoke`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );

      setMessage(
        "Device revoked.",
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to revoke device.",
      );
    }
  }

  const active = devices.filter(
    (device) => device.isActive,
  ).length;
  const stale = devices.filter(
    (device) =>
      device.isActive &&
      isStale(device.lastSeenAt),
  ).length;

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Workforce"
        title="Devices"
        description="See which phones are connected, when they last checked in, and revoke access without deleting employee history."
        action={
          <SecondaryButton
            type="button"
            onClick={() =>
              void load()
            }
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </SecondaryButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          value={devices.length}
          label="Registered devices"
        />
        <Stat
          value={active}
          label="Active"
        />
        <Stat
          value={stale}
          label="Stale 24h+"
        />
      </div>

      {message && (
        <Panel className="py-3">
          <div className="text-sm">
            {message}
          </div>
        </Panel>
      )}

      <Panel className="overflow-hidden p-0">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : devices.length ===
          0 ? (
          <div className="p-5">
            <EmptyState
              title="No registered devices yet"
              description="Devices appear here after the mobile app registers with the backend."
            />
          </div>
        ) : (
          <div className="divide-y">
            {devices.map((device) => {
              const staleDevice =
                isStale(
                  device.lastSeenAt,
                );

              return (
                <div
                  key={device.id}
                  className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                    {staleDevice ? (
                      <WifiOff className="h-5 w-5" />
                    ) : (
                      <Smartphone className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {employeeName(
                        device.userId,
                      )}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {device.platform}
                      {device.appVersion
                        ? ` · App ${device.appVersion}`
                        : ""}
                      {" · "}
                      {device.deviceId}
                    </div>
                  </div>

                  <div className="min-w-40">
                    <div className="text-sm font-medium">
                      {formatWhen(
                        device.lastSeenAt,
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last seen
                    </div>
                  </div>

                  <div>
                    <Pill
                      tone={
                        !device.isActive
                          ? "neutral"
                          : staleDevice
                            ? "warning"
                            : "good"
                      }
                    >
                      {!device.isActive
                        ? "Revoked"
                        : staleDevice
                          ? "Stale"
                          : "Online recently"}
                    </Pill>
                  </div>

                  {device.isActive && (
                    <SecondaryButton
                      type="button"
                      onClick={() =>
                        void revoke(
                          device,
                        )
                      }
                    >
                      <ShieldOff className="h-4 w-4" />
                      Revoke
                    </SecondaryButton>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
