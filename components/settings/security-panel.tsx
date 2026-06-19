"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type SessionItem = {
  id: string;
  ipAddress?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  isCurrent: boolean;
  device?: {
    name?: string | null;
    type: string;
    lastActiveAt?: string | null;
    trusted: boolean;
  } | null;
};

export function SecurityPanel() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSessions() {
    setError("");
    const response = await fetch("/api/auth/sessions");

    if (!response.ok) {
      setError("Please sign in to view your devices.");
      return;
    }

    const data = await response.json();
    setSessions(data.sessions);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
  }

  async function logoutAll() {
    const response = await fetch("/api/auth/logout-all", { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Could not sign out from all devices.");
      return;
    }

    setMessage("You are signed out from all devices.");
    router.push("/auth/login");
  }

  async function revokeSession(sessionId: string) {
    const response = await fetch(`/api/auth/sessions/${sessionId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      setError("Could not remove this device.");
      return;
    }

    await loadSessions();
  }

  async function setTwoFactor(enabled: boolean) {
    setError("");
    setMessage("");
    const response = await fetch(
      enabled ? "/api/auth/2fa/enable" : "/api/auth/2fa/disable",
      { method: "POST" }
    );
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Could not update two-step verification.");
      return;
    }

    setMessage(data.message);
  }

  async function setFamilyMode(enabled: boolean) {
    setError("");
    setMessage("");
    const response = await fetch("/api/users/me/family-mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled,
        blockUnknownContacts: enabled,
        filterGifs: enabled,
        filterStickers: enabled,
        filterMedia: false
      })
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Could not update family mode.");
      return;
    }

    setMessage(enabled ? "Family-safe mode is on." : "Family-safe mode is off.");
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Security</h1>
        <p className="text-sm text-muted-foreground">
          Manage your login sessions and devices.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={logout}>Sign out</Button>
        <Button variant="secondary" onClick={logoutAll}>
          Sign out everywhere
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Two-step verification</h2>
            <p className="text-sm text-muted-foreground">
              Ask for a code after password login.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setTwoFactor(true)}>
              Turn on
            </Button>
            <Button variant="ghost" onClick={() => setTwoFactor(false)}>
              Turn off
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Family-safe mode</h2>
            <p className="text-sm text-muted-foreground">
              Filter unsafe text, GIFs, and stickers before sending.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setFamilyMode(true)}>
              Turn on
            </Button>
            <Button variant="ghost" onClick={() => setFamilyMode(false)}>
              Turn off
            </Button>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="space-y-3">
        {sessions.map((session) => (
          <article key={session.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-medium">
                  {session.device?.name ?? "Device"}{" "}
                  {session.isCurrent ? (
                    <span className="text-sm text-primary">Current</span>
                  ) : null}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {session.device?.type ?? "WEB"} · {session.ipAddress ?? "Unknown IP"}
                </p>
              </div>
              <p className="text-right text-xs text-muted-foreground">
                Expires {new Date(session.expiresAt).toLocaleDateString()}
              </p>
            </div>
            {!session.isCurrent ? (
              <div className="mt-3">
                <Button size="sm" variant="ghost" onClick={() => revokeSession(session.id)}>
                  Remove device
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
