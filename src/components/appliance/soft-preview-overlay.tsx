"use client";

/*
 * BRIXTA_UI_V2 — floating "Preview app" button and its preview sheet.
 *
 * Styled with plain utilities and new class names, so none of the older
 * preview layers in globals.css can change how it looks. Same props as
 * before.
 */

import { Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type SoftPreviewTab = {
  id: string;
  label: string;
  content: ReactNode;
};

export type SoftPreviewStatus = "live" | "connecting" | "offline";

type Props = {
  title: string;
  subtitle: string;
  badge?: ReactNode;
  status?: SoftPreviewStatus;
  children?: ReactNode;
  tabs?: SoftPreviewTab[];
  defaultTabId?: string;
  /** Text on the button that opens the sheet. */
  launcherLabel?: string;
  /** "floating" = round button with a shadow; "inline" = sits in a toolbar. */
  variant?: "floating" | "inline";
};

const noSubscribe = () => () => {};

const STATUS_STYLES: Record<SoftPreviewStatus, { dot: string; text: string }> = {
  live: { dot: "bg-[#2F8F5B]", text: "text-[#1F4C45]" },
  connecting: { dot: "bg-[#C08A2B] animate-pulse", text: "text-[#7A4F10]" },
  offline: { dot: "bg-[#9AA39E]", text: "text-[#5F6964]" },
};

function StatusBadge({ status, children }: { status?: SoftPreviewStatus; children: ReactNode }) {
  const style = STATUS_STYLES[status ?? "offline"];
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-[#F1F3F0] px-2.5 text-[12px] font-medium ${style.text}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {children}
    </span>
  );
}

export function SoftPreviewOverlay({
  title,
  subtitle,
  badge,
  status,
  children,
  tabs,
  defaultTabId,
  launcherLabel = "Preview app",
  variant = "floating",
}: Props) {
  const firstTabId = defaultTabId ?? tabs?.[0]?.id ?? "preview";
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [everOpened, setEverOpened] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(firstTabId);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const launcher = launcherRef.current;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      launcher?.focus();
    };
  }, [open]);

  function showPreview() {
    setEverOpened(true);
    setOpen(true);
  }

  const hasTabs = Boolean(tabs && tabs.length > 1);

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={showPreview}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={
          variant === "inline"
            ? "inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#D3D8D3] bg-white px-3 text-[13px] font-medium text-[#1D2321] transition-colors hover:bg-[#F6F7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F6B62]/40"
            : "inline-flex h-11 items-center gap-2.5 rounded-full border border-[#D3D8D3] bg-white pl-3 pr-4 text-[14px] font-medium text-[#1D2321] shadow-[0_1px_2px_rgba(29,35,33,0.06),0_8px_24px_rgba(29,35,33,0.12)] transition-colors hover:bg-[#F6F7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F6B62]/40"
        }
      >
        <Smartphone className="h-4 w-4 text-[#2F6B62]" />
        <span>{launcherLabel}</span>
        {badge && <StatusBadge status={status}>{badge}</StatusBadge>}
      </button>

      {mounted && everOpened
        ? createPortal(
            <div
              className={`fixed inset-0 z-[150] flex items-end justify-center bg-[rgba(22,28,26,0.45)] transition-opacity duration-150 sm:items-center sm:p-6 ${
                open ? "visible opacity-100" : "pointer-events-none invisible opacity-0"
              }`}
              aria-hidden={!open}
              role="presentation"
              onMouseDown={(event) => {
                if (open && event.target === event.currentTarget) {
                  setOpen(false);
                }
              }}
            >
              <section
                role="dialog"
                aria-modal={open ? "true" : undefined}
                aria-label={title}
                className={`flex h-[94vh] w-full ${hasTabs ? "max-w-[1100px]" : "max-w-[600px]"} flex-col overflow-hidden rounded-t-[16px] border border-[#E1E4E0] bg-white shadow-[0_24px_64px_rgba(29,35,33,0.22)] transition-transform duration-200 sm:h-[min(880px,92vh)] sm:rounded-[16px] ${
                  open ? "translate-y-0" : "translate-y-3"
                }`}
              >
                <header className="flex min-h-[60px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E1E4E0] px-4 py-2.5 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[16px] font-semibold text-[#1D2321]">{title}</h2>
                      <p className="truncate text-[13px] text-[#5F6964]">{subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasTabs && (
                      <div
                        role="tablist"
                        aria-label="Preview mode"
                        className="inline-flex rounded-[10px] bg-[#EEF0ED] p-[3px]"
                      >
                        {tabs!.map((tab) => {
                          const selected = activeTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              role="tab"
                              aria-selected={selected}
                              onClick={() => setActiveTab(tab.id)}
                              className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium transition-colors ${
                                selected
                                  ? "bg-white text-[#1D2321] shadow-[0_1px_2px_rgba(29,35,33,0.08)]"
                                  : "text-[#5F6964] hover:text-[#1D2321]"
                              }`}
                            >
                              {tab.label}
                              {tab.id === "live" && badge && (
                                <span
                                  aria-hidden
                                  className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[status ?? "offline"].dot}`}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <button
                      ref={closeRef}
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label={`Close ${title}`}
                      className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#5F6964] transition-colors hover:bg-[#F1F3F0] hover:text-[#1D2321] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F6B62]/40"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </header>

                <div className="min-h-0 flex-1 overflow-auto bg-[#F4F5F3] p-3 sm:p-5">
                  {tabs && tabs.length > 0
                    ? tabs.map((tab) => (
                        <div
                          key={tab.id}
                          role="tabpanel"
                          hidden={activeTab !== tab.id}
                          className="min-h-full"
                        >
                          {tab.content}
                        </div>
                      ))
                    : children}
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
