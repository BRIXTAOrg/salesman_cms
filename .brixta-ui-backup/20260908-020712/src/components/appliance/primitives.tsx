"use client";

import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { X } from "lucide-react";

import { cx } from "./client";

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
    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.02em] text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-3xl text-[14px] leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
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
    <section
      className={cx(
        "rounded-lg border border-border bg-card p-6 shadow-none",
        className,
      )}
    >
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
    <div className="rounded-lg border border-border bg-card px-6 py-5 shadow-none">
      <div className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
        {value}
      </div>
      <div className="mt-2 text-[14px] font-medium leading-5 text-foreground">
        {label}
      </div>
      {hint && (
        <div className="mt-2 text-[12px] leading-[18px] text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?:
    | "neutral"
    | "good"
    | "warning"
    | "danger"
    | "info";
}) {
  const classes = {
    neutral:
      "border-border bg-muted text-muted-foreground",
    good:
      "border-emerald-600/20 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
    warning:
      "border-amber-600/20 bg-amber-600/10 text-amber-700 dark:text-amber-300",
    danger:
      "border-red-600/20 bg-red-600/10 text-red-700 dark:text-red-300",
    info:
      "border-blue-600/20 bg-blue-600/10 text-blue-700 dark:text-blue-300",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md border px-2 py-1 text-[12px] font-medium leading-none",
        classes[tone],
      )}
    >
      {children}
    </span>
  );
}

const buttonMotion =
  "transition-[background-color,color,border-color,transform] duration-150 ease-out hover:-translate-y-px active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50";

export function PrimaryButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-[14px] font-medium text-primary-foreground shadow-none hover:bg-primary/90",
        buttonMotion,
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
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-transparent px-4 text-[14px] font-medium text-foreground shadow-none hover:bg-muted",
        buttonMotion,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-[12px] font-medium uppercase tracking-[0.02em] text-foreground">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[12px] leading-[18px] text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}

export const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-[14px] leading-5 text-foreground shadow-none outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background";

export const textareaClass =
  "min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-[14px] leading-6 text-foreground shadow-none outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background";

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4 pt-[6vh]">
      <div
        className={cx(
          "appliance-modal-panel w-full rounded-lg border border-border bg-background shadow-none",
          wide ? "max-w-5xl" : "max-w-xl",
        )}
      >
        <div className="flex items-start justify-between gap-6 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
              {title}
            </h2>
            {description && (
              <p className="mt-2 max-w-3xl text-[14px] leading-6 text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:-translate-y-px hover:bg-muted hover:text-foreground active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-left">
      <div className="text-[14px] font-medium text-foreground">
        {title}
      </div>
      {description && (
        <div className="mt-2 text-[14px] leading-6 text-muted-foreground">
          {description}
        </div>
      )}
    </div>
  );
}