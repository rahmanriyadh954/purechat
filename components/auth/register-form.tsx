"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSoundSystem } from "@/hooks/use-sound-system";

export function RegisterForm() {
  const router = useRouter();
  const sounds = useSoundSystem();
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    gender: ""
  });
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          email: form.email || undefined,
          phone: form.phone || undefined,
          gender: form.gender || undefined,
          deviceFingerprintHash: await createDeviceFingerprintHash()
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not create account.");
      }

      const identifier = form.email || form.phone;
      router.push(`/auth/verify?identifier=${encodeURIComponent(identifier)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create account.";
      setWarning(message);
      setError("");
      sounds.play("warning");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-5">
      <input
        className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        placeholder="Full name"
        value={form.displayName}
        onChange={(event) => setForm({ ...form, displayName: event.target.value })}
      />
      <input
        className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        placeholder="Username"
        value={form.username}
        onChange={(event) => setForm({ ...form, username: event.target.value })}
      />
      <input
        className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        placeholder="Email"
        value={form.email}
        onChange={(event) => setForm({ ...form, email: event.target.value })}
      />
      <input
        className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        placeholder="Phone"
        value={form.phone}
        onChange={(event) => setForm({ ...form, phone: event.target.value })}
      />
      <input
        className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        placeholder="Password"
        type="password"
        value={form.password}
        onChange={(event) => setForm({ ...form, password: event.target.value })}
      />
      <div className="rounded-lg border bg-background p-3">
        <p className="text-sm font-medium">How would you like to describe yourself?</p>
        <p className="mt-1 text-xs text-muted-foreground">Optional. PureChat will not guess this for you.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            ["MALE", "Male"],
            ["FEMALE", "Female"],
            ["PREFER_NOT_TO_SAY", "Prefer not to say"]
          ].map(([value, label]) => (
            <button
              className={`rounded-md border px-3 py-2 text-sm transition hover:bg-muted ${form.gender === value ? "border-primary bg-primary/10" : ""}`}
              key={value}
              type="button"
              onClick={() => setForm({ ...form, gender: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {warning ? (
        <DuplicateWarningModal message={warning} onClose={() => setWarning("")} />
      ) : null}

      <Button className="w-full" disabled={loading} onClick={submit}>
        Create account
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="font-medium text-primary" href="/auth/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function DuplicateWarningModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl border border-white/25 bg-card/90 p-5 shadow-2xl">
        <h2 className="text-lg font-semibold">Account safety check</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          For privacy, PureChat does not show details about any existing account.
        </p>
        <Button className="mt-5 w-full" onClick={onClose}>Got it</Button>
      </div>
    </div>
  );
}

async function createDeviceFingerprintHash() {
  if (!window.crypto?.subtle) return undefined;
  const coarseData = [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${Math.round(window.screen.width / 100) * 100}x${Math.round(window.screen.height / 100) * 100}`,
    String(window.devicePixelRatio)
  ].join("|");
  const bytes = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(coarseData));
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
