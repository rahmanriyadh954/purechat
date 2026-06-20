"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const consoleOtpInstruction = "Your verification code was generated in the server logs.";

export function VerifyForm({ mode = "account", notice }: { mode?: "account" | "two-factor"; notice?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState(searchParams.get("identifier") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    searchParams.get("notice") ?? notice ?? (mode === "account" ? consoleOtpInstruction : "")
  );
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(mode === "account" ? 60 : 0);
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (retryAfter <= 0) return;

    const timer = window.setInterval(() => {
      setRetryAfter((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [retryAfter]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        mode === "two-factor" ? "/api/auth/2fa/verify" : "/api/auth/verify-account",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: identifier.trim(), code: code.trim() })
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (typeof data.retryAfter === "number") {
          setRetryAfter(data.retryAfter);
        }
        throw new Error(cleanOtpError(data.error));
      }

      router.replace("/chats");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code check failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    if (cooldown > 0 || retryAfter > 0 || !identifier.trim()) return;

    setResending(true);
    setError("");

    try {
      const response = await fetch(
        mode === "two-factor" ? "/api/auth/otp/start" : "/api/auth/verify-account/resend",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: identifier.trim() })
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (typeof data.retryAfter === "number") {
          setRetryAfter(data.retryAfter);
        }
        throw new Error(cleanOtpError(data.error));
      }

      setMessage(typeof data.message === "string" ? data.message : consoleOtpInstruction);
      setCooldown(typeof data.cooldownSeconds === "number" ? data.cooldownSeconds : 60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request a new code.");
    } finally {
      setResending(false);
    }
  }

  const resendDisabled = resending || cooldown > 0 || retryAfter > 0 || !identifier.trim();

  return (
    <form className="space-y-4 rounded-lg border bg-card p-5" noValidate onSubmit={submit}>
      {message ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-100">
          <p className="font-medium">
            {mode === "account" ? "Check your verification code" : "Check your security code"}
          </p>
          <p className="mt-1 text-emerald-900/80 dark:text-emerald-100/80">{message}</p>
          {mode === "account" ? (
            <p className="mt-1 text-xs text-emerald-900/70 dark:text-emerald-100/70">
              In local development, look at the terminal running PureChat.
            </p>
          ) : null}
        </div>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Email or phone</span>
        <input
          className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Email or phone"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Verification code</span>
        <input
          aria-invalid={Boolean(error)}
          className={`h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring ${
            error ? "border-destructive focus:ring-destructive/30" : ""
          }`}
          inputMode="numeric"
          maxLength={6}
          placeholder="6 digit code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, ""));
            setError("");
          }}
        />
        {error ? <span className="block text-sm text-destructive">{error}</span> : null}
      </label>

      {retryAfter > 0 ? (
        <p className="text-sm text-muted-foreground">
          Too many code requests. Try again in {retryAfter} seconds.
        </p>
      ) : null}

      <Button className="w-full" disabled={loading || identifier.trim().length < 3 || code.trim().length !== 6} type="submit">
        {loading ? "Checking code..." : "Verify code"}
      </Button>

      <Button className="w-full" disabled={resendDisabled} variant="outline" type="button" onClick={resendCode}>
        {resending
          ? "Requesting code..."
          : retryAfter > 0
            ? `Try again in ${retryAfter}s`
            : cooldown > 0
              ? `Resend code in ${cooldown}s`
              : "Resend code"}
      </Button>
    </form>
  );
}

function cleanOtpError(error: unknown) {
  if (typeof error !== "string") return "Code check failed. Please try again.";
  if (error.includes("incorrect")) return "The code is incorrect.";
  if (error.includes("expired") || error.includes("invalid")) return "The code is expired or invalid.";
  if (error.includes("Too many")) return error;
  return "Code check failed. Please try again.";
}
