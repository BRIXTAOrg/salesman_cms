"use client";

// BRIXTA_COMPANY_SWITCH_PROOF_V1
// Shared switch flow for the header switcher and the Organization screen.
// The first switch into a company asks for that company's password; after
// that the server remembers this browser and switching is one click again.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Building2,
  Loader2,
  LockKeyhole,
  X,
} from "lucide-react";

type SwitchTarget = {
  id: number;
  name: string;
};

type SwitchResult =
  | { ok: true; redirect: string }
  | { ok: false; needsPassword: boolean; error: string };

async function requestSwitch(
  organizationId: number,
  password?: string,
): Promise<SwitchResult> {
  const response = await fetch("/api/account/switch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      password ? { organizationId, password } : { organizationId },
    ),
  });

  const body = await response.json().catch(() => ({}));

  if (response.ok) {
    return { ok: true, redirect: body.redirect ?? "/dashboard" };
  }

  const needsPassword =
    body.code === "PASSWORD_REQUIRED" || body.code === "PASSWORD_INVALID";

  return {
    ok: false,
    needsPassword,
    error:
      body.code === "PASSWORD_REQUIRED"
        ? ""
        : body.error ?? "Unable to switch company.",
  };
}

export function useCompanySwitch(options: {
  onSwitched: (redirect: string) => void;
}) {
  const { onSwitched } = options;
  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState<SwitchTarget | null>(null);
  const [promptError, setPromptError] = useState("");

  const switchTo = useCallback(
    async (target: SwitchTarget) => {
      setSwitchingId(target.id);
      try {
        const result = await requestSwitch(target.id);
        if (result.ok) {
          onSwitched(result.redirect);
          return;
        }
        if (result.needsPassword) {
          setPromptError(result.error);
          setPrompt(target);
          setSwitchingId(null);
          return;
        }
        window.alert(result.error);
        setSwitchingId(null);
      } catch {
        window.alert("Unable to switch company.");
        setSwitchingId(null);
      }
    },
    [onSwitched],
  );

  const submitPassword = useCallback(
    async (password: string) => {
      if (!prompt) return;
      setSwitchingId(prompt.id);
      setPromptError("");
      try {
        const result = await requestSwitch(prompt.id, password);
        if (result.ok) {
          onSwitched(result.redirect);
          return;
        }
        setPromptError(
          result.error || "That password is not right for this company.",
        );
      } catch {
        setPromptError("Unable to switch company. Check your connection.");
      }
      setSwitchingId(null);
    },
    [onSwitched, prompt],
  );

  const dialog = (
    <CompanyPasswordDialog
      target={prompt}
      error={promptError}
      busy={prompt !== null && switchingId === prompt.id}
      onCancel={() => {
        setPrompt(null);
        setPromptError("");
        setSwitchingId(null);
      }}
      onSubmit={(password) => void submitPassword(password)}
    />
  );

  return { switchTo, switchingId, dialog };
}

function CompanyPasswordDialog({
  target,
  error,
  busy,
  onCancel,
  onSubmit,
}: {
  target: SwitchTarget | null;
  error: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const targetId = target?.id ?? null;

  useEffect(() => {
    if (targetId === null) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [targetId]);

  useEffect(() => {
    if (targetId === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [targetId, onCancel]);

  if (!target) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!password || busy) return;
    onSubmit(password);
  }

  function cancel() {
    setPassword("");
    onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/45 p-4 pt-[14vh] backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <form
        onSubmit={submit}
        className="brixta-soft-card w-full max-w-sm rounded-[20px] border bg-card p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-switch-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <button
            type="button"
            onClick={cancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2
          id="company-switch-title"
          className="mt-4 text-lg font-semibold tracking-[-0.01em]"
        >
          Confirm it&apos;s you
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
          Enter your password for{" "}
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Building2 className="h-3.5 w-3.5" />
            {target.name}
          </span>
          . You&apos;ll only need to do this once on this browser.
        </p>

        <input
          ref={inputRef}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="brixta-input mt-5 h-11 w-full rounded-xl border px-3 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          disabled={busy}
        />

        {error && (
          <div className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-[13px] text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            className="brixta-secondary-button inline-flex h-10 items-center rounded-full border px-4 text-[14px] font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!password || busy}
            className="brixta-primary-button inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-[14px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Switch
          </button>
        </div>
      </form>
    </div>
  );
}
