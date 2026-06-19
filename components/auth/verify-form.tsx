"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function VerifyForm({ mode = "account" }: { mode?: "account" | "two-factor" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState(searchParams.get("identifier") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        mode === "two-factor" ? "/api/auth/2fa/verify" : "/api/auth/verify-account",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, code })
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Code check failed.");
      }

      router.push(mode === "two-factor" ? "/chats" : "/auth/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code check failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-5">
      <input
        className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        placeholder="Email or phone"
        value={identifier}
        onChange={(event) => setIdentifier(event.target.value)}
      />
      <input
        className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        inputMode="numeric"
        maxLength={6}
        placeholder="6 digit code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button className="w-full" disabled={loading} onClick={submit}>
        Verify code
      </Button>
    </div>
  );
}
