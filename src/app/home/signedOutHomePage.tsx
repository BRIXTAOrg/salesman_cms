"use client";

/*
 * BRIXTA_CLEAN_UI_V1 — the one sign-in screen (used by "/" and "/login").
 */

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

export default function SignedOutHomePage() {
  const [companyCode, setCompanyCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyCode: companyCode.trim(), email: email.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Sign-in didn't work. Check the details and try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.redirect || "/dashboard";
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  const input =
    "brixta-input h-11 w-full rounded-[10px] border px-3 text-[15px] outline-none placeholder:text-muted-foreground/70";

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-primary text-[13px] font-bold text-primary-foreground">
            B
          </div>
          <span className="brixta-page-title text-[17px] font-semibold">BRIXTA</span>
        </div>

        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-10">
          <h1 className="brixta-page-title text-[30px] font-semibold leading-9">Sign in</h1>
          <p className="mt-2 text-[14.5px] leading-6 text-muted-foreground">
            Use your company code and the email your admin set up for you.
          </p>

          {error && (
            <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-[12px] border border-[#F1C4BF] bg-[#FDF3F1] px-3.5 py-3 text-[13.5px] text-[#8F2A1E]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={signIn} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="companyCode" className="block text-[13px] font-medium">
                Company code
              </label>
              <input
                id="companyCode"
                value={companyCode}
                onChange={(event) => setCompanyCode(event.target.value.toLowerCase())}
                required
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="organization"
                disabled={loading}
                placeholder="e.g. acme"
                className={input}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[13px] font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="username"
                disabled={loading}
                className={input}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[13px] font-medium">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  className={`${input} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="brixta-primary-button flex h-11 w-full items-center justify-center gap-2 text-[15px] font-medium disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-[14px] text-muted-foreground">
            New to BRIXTA?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Set up your company
            </Link>
          </p>
        </div>
      </div>

      <aside
        className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-end"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      >
        <div className="relative max-w-[560px] p-14">
          <p className="brixta-page-title text-[44px] font-semibold leading-[1.08]">
            Every site, visit and order your field team makes, in one place.
          </p>
          <p className="mt-6 max-w-[440px] text-[16px] leading-7 text-white/80">
            Import the sites you found, hand them to your team, and watch them get verified, pitched and
            won from their phones.
          </p>
        </div>
      </aside>
    </div>
  );
}
