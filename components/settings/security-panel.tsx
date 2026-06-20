"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getSoundSettings, saveSoundSettings, useSoundSystem } from "@/hooks/use-sound-system";

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

type BlockedUserItem = {
  id: string;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string | null;
  };
};

export function SecurityPanel() {
  const router = useRouter();
  const sounds = useSoundSystem();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserItem[]>([]);
  const [soundSettings, setSoundSettings] = useState(getSoundSettings());
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function loadSessions() {
    setError("");
    setLoadingSessions(true);
    try {
      const response = await fetch("/api/auth/sessions");

      if (!response.ok) {
        router.replace("/auth/login");
        router.refresh();
        return;
      }

      const data = await response.json();
      setSessions(data.sessions);
    } finally {
      setLoadingSessions(false);
    }
  }

  async function loadBlockedUsers() {
    const response = await fetch("/api/users/me/blocked");
    if (!response.ok) return;
    const data = await response.json();
    setBlockedUsers(data.blockedUsers ?? []);
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/auth/login");
      router.refresh();
    }
  }

  async function logoutAll() {
    setLoggingOutAll(true);
    const response = await fetch("/api/auth/logout-all", { method: "POST" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "Could not sign out from all devices.");
      setLoggingOutAll(false);
      return;
    }

    setMessage("You are signed out from all devices.");
    router.replace("/auth/login");
    router.refresh();
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
    toast({ kind: "success", title: data.message });
  }

  async function changePassword() {
    setSavingPassword(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not update password.");
      }

      setPasswordForm({ currentPassword: "", newPassword: "" });
      setMessage("Password updated.");
      toast({ kind: "success", title: "Password updated" });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Please try again.";
      setError(description);
      toast({ kind: "error", title: "Password not updated", description });
    } finally {
      setSavingPassword(false);
    }
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
    void loadBlockedUsers();
    setSoundSettings(getSoundSettings());
  }, []);

  function updateSoundSetting(key: keyof typeof soundSettings, value: boolean) {
    const next = { ...soundSettings, [key]: value };
    setSoundSettings(next);
    saveSoundSettings(next);
    if (!next.muted) sounds.play("tap");
    toast({ kind: "success", title: "Sound setting saved" });
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Security</h1>
        <p className="text-sm text-muted-foreground">
          Manage your login sessions and devices.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={loggingOut} onClick={logout}>
          {loggingOut ? "Logging out..." : "Logout"}
        </Button>
        <Button disabled={loggingOutAll} variant="secondary" onClick={logoutAll}>
          {loggingOutAll ? "Logging out..." : "Logout from all devices"}
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-4 font-medium">Change password</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Current password</span>
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">New password</span>
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
            />
          </label>
        </div>
        <Button className="mt-4" disabled={savingPassword || !passwordForm.currentPassword || !passwordForm.newPassword} onClick={changePassword}>
          {savingPassword ? "Updating..." : "Change password"}
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

      <div className="rounded-lg border bg-card p-4" id="blocked-users">
        <h2 className="font-medium">Blocked users</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          People you block cannot contact you directly.
        </p>
        <div className="mt-4 space-y-2">
          {blockedUsers.length === 0 ? (
            <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
              No blocked users.
            </p>
          ) : blockedUsers.map((item) => (
            <div className="flex items-center justify-between rounded-md border bg-background p-3 text-sm" key={item.id}>
              <div>
                <p className="font-medium">{item.user.displayName}</p>
                <p className="text-muted-foreground">@{item.user.username}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4">
          <h2 className="font-medium">Sound settings</h2>
          <p className="text-sm text-muted-foreground">
            Soft generated tones. No copyrighted audio assets are used.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <SoundToggle label="Mute all sounds" checked={soundSettings.muted} onChange={(value) => updateSoundSetting("muted", value)} />
          <SoundToggle label="Message sounds" checked={soundSettings.messageSounds} onChange={(value) => updateSoundSetting("messageSounds", value)} />
          <SoundToggle label="Call sounds" checked={soundSettings.callSounds} onChange={(value) => updateSoundSetting("callSounds", value)} />
          <SoundToggle label="Warning sounds" checked={soundSettings.warningSounds} onChange={(value) => updateSoundSetting("warningSounds", value)} />
          <SoundToggle label="Soft tap sounds" checked={soundSettings.tapSounds} onChange={(value) => updateSoundSetting("tapSounds", value)} />
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
        {loadingSessions ? (
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            Checking your sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            No active sessions found.
          </div>
        ) : sessions.map((session) => (
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
                  {session.device?.type ?? "WEB"} - {session.ipAddress ?? "Unknown IP"}
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

function SoundToggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-left text-sm"
      type="button"
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs ${checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
        {checked ? "On" : "Off"}
      </span>
    </button>
  );
}
