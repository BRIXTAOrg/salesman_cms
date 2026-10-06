"use client";

/*
 * BRIXTA_CLEAN_UI_V1 — the building blocks every CMS screen uses.
 *
 * Same exports and props as before, so existing screens keep working, with:
 *   - dialogs rendered into <body> (they can never be clipped or covered
 *     by the sidebar again), with a scrollable body and a fixed footer
 *   - sentence-case labels, inline field errors
 *   - one calm style for buttons, pills, cards and empty states
 */

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import { cn as cx } from "@/lib/utils";

/** Renders children into document.body (client only). */
const noSubscribe = () => () => {};

export function Portal({ children }: { children: ReactNode }) {
  const onClient = useSyncExternalStore(noSubscribe, () => true, () => false);
  return onClient ? createPortal(children, document.body) : null;
}

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 text-[13px] font-medium text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="brixta-page-title text-[26px] font-semibold leading-8 text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("brixta-card rounded-[14px] border border-[#E1E4E0] bg-white p-5 md:p-6", className)}>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="brixta-card rounded-[14px] border border-[#E1E4E0] bg-white px-5 py-4">
      <div className="text-[13px] font-medium text-muted-foreground">{label}</div>
      <div className="brixta-page-title mt-1 text-[28px] font-semibold leading-9 text-foreground">
        {value}
      </div>
      {hint && <div className="mt-1 text-[12px] leading-[18px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

const PILL_TONES = {
  neutral: "bg-[#EEF0ED] text-[#4A544F]",
  good: "bg-[#E5EFEC] text-[#1F4C45]",
  warning: "bg-[#FBF1DE] text-[#8A5A12]",
  danger: "bg-[#FDECEA] text-[#9A2A1F]",
  info: "bg-[#E8EEF5] text-[#2F4E70]",
} as const;

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof PILL_TONES;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium leading-none",
        PILL_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

const buttonBase =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap px-4 text-[14px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function PrimaryButton({
  children,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      {...props}
      className={cx(
        "brixta-btn rounded-[10px] border border-[#2F6B62] bg-[#2F6B62] text-white shadow-[0_1px_1px_rgba(29,35,33,0.08)] hover:border-[#275A53] hover:bg-[#275A53]",
        buttonBase,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      {...props}
      className={cx(
        "brixta-btn rounded-[10px] border border-[#D3D8D3] bg-white text-[#1D2321] shadow-[0_1px_1px_rgba(29,35,33,0.04)] hover:bg-[#F6F7F5]",
        buttonBase,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      {...props}
      className={cx(
        "brixta-btn rounded-[10px] border border-[#F1C4BF] bg-white text-[#B42318] hover:bg-[#FDF1EF]",
        buttonBase,
        className,
      )}
    >
      {children}
    </button>
  );
}

const SIMPLE_CONTROLS = new Set(["input", "select", "textarea"]);

/**
 * A labelled form row. Simple inputs get a proper <label for>; richer
 * controls (pickers, multi-selects) get a plain heading, so clicking the
 * label or hint never toggles a dropdown by accident.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const generated = useId();
  const simple =
    isValidElement(children) &&
    typeof children.type === "string" &&
    SIMPLE_CONTROLS.has(children.type);
  const element = simple ? (children as ReactElement<Record<string, unknown>>) : null;
  const id = (element?.props.id as string | undefined) ?? generated;
  const control = element
    ? cloneElement(element, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": hint || error ? `${id}-note` : undefined,
      })
    : children;

  const heading = (
    <>
      {label}
      {required && <span className="ml-0.5 text-[#B42318]">*</span>}
    </>
  );

  return (
    <div className={cx("block space-y-1.5", className)}>
      {simple ? (
        <label htmlFor={id} className="block text-[13px] font-medium text-foreground">
          {heading}
        </label>
      ) : (
        <div className="block text-[13px] font-medium text-foreground">{heading}</div>
      )}
      {control}
      {error ? (
        <p id={`${id}-note`} className="text-[12.5px] leading-[18px] text-[#B42318]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-note`} className="text-[12.5px] leading-[18px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "brixta-field h-10 w-full rounded-[10px] border border-[#D3D8D3] bg-white px-3 text-[14px] leading-5 text-[#1D2321] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#8A938E] hover:border-[#BFC6C0] focus:border-[#2F6B62] focus:shadow-[0_0_0_3px_rgba(47,107,98,0.15)] aria-[invalid=true]:border-[#B42318] disabled:cursor-not-allowed disabled:opacity-60";

export const textareaClass =
  "brixta-field min-h-24 w-full rounded-[10px] border border-[#D3D8D3] bg-white px-3 py-2 text-[14px] leading-6 text-[#1D2321] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#8A938E] hover:border-[#BFC6C0] focus:border-[#2F6B62] focus:shadow-[0_0_0_3px_rgba(47,107,98,0.15)]";

const MODAL_SIZES = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
} as const;

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  wide = false,
  size,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  size?: keyof typeof MODAL_SIZES;
  /** Actions pinned to the bottom of the dialog. */
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  if (!open) return null;
  const width = MODAL_SIZES[size ?? (wide ? "xl" : "md")];

  return (
    <Portal>
      {/* Inline position/colour on purpose: the dialog keeps its backdrop and
          surface even if a stale stylesheet is still cached in the browser. */}
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center sm:items-start sm:p-6 sm:pt-[7vh]"
        style={{ position: "fixed", inset: 0, zIndex: 100 }}
      >
        <div
          className="absolute inset-0 bg-[rgba(22,28,26,0.45)]"
          style={{ position: "absolute", inset: 0, background: "rgba(22,28,26,0.45)" }}
          onMouseDown={() => closeRef.current()}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          style={{ background: "#FFFFFF" }}
          className={cx(
            "appliance-modal-panel relative flex max-h-[92vh] w-full flex-col rounded-t-[16px] border border-[#E1E4E0] bg-white shadow-[0_1px_2px_rgba(29,35,33,0.05),0_24px_48px_rgba(29,35,33,0.16)] outline-none sm:max-h-[86vh]",
            "rounded-b-none sm:rounded-[16px]",
            width,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-6 border-b border-border px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="brixta-page-title text-[18px] font-semibold leading-7 text-foreground">{title}</h2>
              {description && (
                <p className="mt-0.5 text-[13.5px] leading-5 text-muted-foreground">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => closeRef.current()}
              className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-[#FAFBFA] px-5 py-3 sm:rounded-b-[16px] sm:px-6">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-dashed border-border bg-white/60 px-6 py-10 text-center">
      <div className="text-[15px] font-medium text-foreground">{title}</div>
      {description && (
        <div className="mx-auto mt-1.5 max-w-md text-[14px] leading-6 text-muted-foreground">{description}</div>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** An inline message inside a page or dialog (never hidden behind one). */
export function Notice({
  tone = "info",
  children,
  onDismiss,
}: {
  tone?: "info" | "good" | "warning" | "danger";
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const styles = {
    info: "border-[#D6E0EA] bg-[#F3F6FA] text-[#2F4E70]",
    good: "border-[#CFE2DC] bg-[#F0F7F4] text-[#1F4C45]",
    warning: "border-[#EFDDB7] bg-[#FDF8EE] text-[#7A4F10]",
    danger: "border-[#F1C4BF] bg-[#FDF3F1] text-[#8F2A1E]",
  }[tone];
  const Icon = tone === "good" ? CheckCircle2 : tone === "info" ? Info : AlertTriangle;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex items-start gap-2.5 rounded-[12px] border px-3.5 py-3 text-[13.5px] leading-5", styles)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="-m-1 rounded-md p-1 opacity-70 hover:opacity-100">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
