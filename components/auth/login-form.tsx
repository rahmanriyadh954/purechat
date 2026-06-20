"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Something went wrong.");
  }

  return data;
}

function getSafeNextUrl() {
  if (typeof window === "undefined") return "/chats";

  const next = new URLSearchParams(window.location.search).get("next");

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/chats";
  }

  return next;
}

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitPassword(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await postJson("/api/auth/login", { identifier, password });

      if (result.requiresTwoFactor) {
        router.push(`/auth/two-factor?identifier=${encodeURIComponent(result.identifier)}`);
        return;
      }

      router.replace(getSafeNextUrl() as Route);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in could not be completed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function startOtp() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await postJson("/api/auth/otp/start", { identifier });
      setOtpSent(true);
      setMessage(result.message ?? "If the account exists, we sent a code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await postJson("/api/auth/otp/verify", { identifier, code });
      router.replace(getSafeNextUrl() as Route);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code check failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4 rounded-lg border bg-card p-5" onSubmit={mode === "password" ? submitPassword : undefined}>
      <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-1">
        <button
          className={`rounded-md px-3 py-2 text-sm ${mode === "password" ? "bg-background shadow-sm" : ""}`}
          onClick={() => setMode("password")}
          type="button"
        >
          Password
        </button>
        <button
          className={`rounded-md px-3 py-2 text-sm ${mode === "otp" ? "bg-background shadow-sm" : ""}`}
          onClick={() => setMode("otp")}
          type="button"
        >
          Code
        </button>
      </div>

      <input
        className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        placeholder="Email, phone, or username"
        value={identifier}
        onChange={(event) => setIdentifier(event.target.value)}
      />

      {mode === "password" ? (
        <input
          className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      ) : otpSent ? (
        <input
          className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          inputMode="numeric"
          maxLength={6}
          placeholder="6 digit code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {mode === "password" ? (
        <Button className="w-full" disabled={loading} type="submit">
          Sign in
        </Button>
      ) : otpSent ? (
        <Button className="w-full" disabled={loading} onClick={verifyOtp} type="button">
          Verify code
        </Button>
      ) : (
        <Button className="w-full" disabled={loading} onClick={startOtp} type="button">
          Send code
        </Button>
      )}

      <p className="text-center text-sm text-muted-foreground">
        New to PureChat?{" "}
        <Link className="font-medium text-primary" href="/auth/register">
          Create account
        </Link>
      </p>
    </form>
  );
}
