"use client";

import { Eye, Maximize2, Smartphone, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  title: string;
  subtitle: string;
  badge?: ReactNode;
  children: ReactNode;
};

export function SoftPreviewOverlay({
  title,
  subtitle,
  badge,
  children,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="brixta-preview-launcher"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="brixta-preview-launcher-icon">
          <Smartphone className="h-4 w-4" />
        </span>

        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold text-foreground">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        </span>

        {badge && (
          <span className="brixta-preview-launcher-badge">{badge}</span>
        )}

        <span className="brixta-preview-launcher-action">
          <Eye className="h-3.5 w-3.5" />
          <span>Preview</span>
          <Maximize2 className="h-3.5 w-3.5" />
        </span>
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="brixta-preview-overlay"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <section
                className="brixta-preview-sheet brixta-genie-enter"
                role="dialog"
                aria-modal="true"
                aria-label={title}
              >
                <header className="brixta-preview-sheet-header">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="brixta-preview-sheet-icon">
                      <Smartphone className="h-4 w-4" />
                    </span>

                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold tracking-[-0.02em]">
                        {title}
                      </h2>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {subtitle}
                      </p>
                    </div>

                    {badge && (
                      <span className="brixta-preview-launcher-badge hidden sm:inline-flex">
                        {badge}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="brixta-preview-close"
                    onClick={() => setOpen(false)}
                    aria-label={`Close ${title}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </header>

                <div className="brixta-preview-sheet-body">
                  {children}
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
