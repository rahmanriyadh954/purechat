"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  canUseBrowserNotifications,
  getSoundSettings,
  requestNotificationPermission,
  saveSoundSettings,
  useSoundSystem
} from "@/hooks/use-sound-system";

type MeResponse = {
  user: {
    id: string;
    displayName: string;
    username: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    role: string;
    profile: {
      bio: string | null;
      statusMessage: string | null;
      country: string | null;
      gender: "MALE" | "FEMALE" | "PREFER_NOT_TO_SAY" | null;
      lastSeenVisibility: "EVERYONE" | "CONTACTS" | "NOBODY";
      profilePhotoVisibility: "EVERYONE" | "CONTACTS" | "NOBODY";
      readReceiptsEnabled: boolean;
      onlineStatusEnabled: boolean;
      twoFactorEnabled: boolean;
    } | null;
  };
};

type ProfileForm = {
  displayName: string;
  username: string;
  email: string;
  phone: string;
  gender: string;
  country: string;
  statusMessage: string;
  bio: string;
};

type Visibility = "EVERYONE" | "CONTACTS" | "NOBODY";

const usernamePattern = /^[a-zA-Z0-9._]+$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[1-9]\d{7,14}$/;

export function AccountSettingsPanel() {
  const { toast } = useToast();
  const sounds = useSoundSystem();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingTwoFactor, setSavingTwoFactor] = useState(false);
  const [user, setUser] = useState<MeResponse["user"] | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    displayName: "",
    username: "",
    email: "",
    phone: "",
    gender: "",
    country: "",
    statusMessage: "",
    bio: ""
  });
  const [privacy, setPrivacy] = useState<{
    lastSeenVisibility: Visibility;
    profilePhotoVisibility: Visibility;
    onlineStatusEnabled: boolean;
    readReceiptsEnabled: boolean;
  }>({
    lastSeenVisibility: "CONTACTS",
    profilePhotoVisibility: "CONTACTS",
    onlineStatusEnabled: true,
    readReceiptsEnabled: true
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: ""
  });
  const [soundSettings, setSoundSettings] = useState(getSoundSettings());
  const [notificationPermission, setNotificationPermission] = useState("default");

  const formError = useMemo(() => validateProfileForm(form), [form]);

  useEffect(() => {
    void loadMe();
    setSoundSettings(getSoundSettings());
    setNotificationPermission(canUseBrowserNotifications() ? Notification.permission : "unsupported");
  }, []);

  async function loadMe() {
    setLoading(true);
    try {
      const response = await fetch("/api/users/me");
      const data = await response.json();

      if (!response.ok) throw new Error(cleanError(data.error, "Could not load profile."));

      applyUser(data.user);
    } catch (error) {
      toast({
        kind: "error",
        title: "Profile failed to load",
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setLoading(false);
    }
  }

  function applyUser(nextUser: MeResponse["user"]) {
    setUser(nextUser);
    setForm({
      displayName: nextUser.displayName,
      username: nextUser.username,
      email: nextUser.email ?? "",
      phone: nextUser.phone ?? "",
      gender: nextUser.profile?.gender ?? "",
      country: nextUser.profile?.country ?? "",
      statusMessage: nextUser.profile?.statusMessage ?? "",
      bio: nextUser.profile?.bio ?? ""
    });
    setPrivacy({
      lastSeenVisibility: nextUser.profile?.lastSeenVisibility ?? "CONTACTS",
      profilePhotoVisibility: nextUser.profile?.profilePhotoVisibility ?? "CONTACTS",
      onlineStatusEnabled: nextUser.profile?.onlineStatusEnabled ?? true,
      readReceiptsEnabled: nextUser.profile?.readReceiptsEnabled ?? true
    });
  }

  async function saveProfile() {
    if (formError) {
      toast({ kind: "error", title: "Check profile fields", description: formError });
      return;
    }

    setSavingProfile(true);
    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          username: form.username.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          gender: form.gender || null,
          country: form.country.trim() || null,
          statusMessage: form.statusMessage.trim() || null,
          bio: form.bio.trim() || null
        })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(cleanError(data.error, "Could not save profile."));

      applyUser(data.user);
      toast({ kind: "success", title: "Profile saved" });
    } catch (error) {
      toast({
        kind: "error",
        title: "Profile not saved",
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePrivacy(nextPrivacy: typeof privacy, key: string) {
    setPrivacy(nextPrivacy);
    setSavingPrivacy(key);
    try {
      const response = await fetch("/api/users/me/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPrivacy)
      });
      const data = await response.json();

      if (!response.ok) throw new Error(cleanError(data.error, "Could not save privacy settings."));

      toast({ kind: "success", title: "Privacy updated" });
    } catch (error) {
      toast({
        kind: "error",
        title: "Privacy not saved",
        description: error instanceof Error ? error.message : "Please try again."
      });
      void loadMe();
    } finally {
      setSavingPrivacy(null);
    }
  }

  async function changePassword() {
    setSavingPassword(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm)
      });
      const data = await response.json();

      if (!response.ok) throw new Error(cleanError(data.error, "Could not update password."));

      setPasswordForm({ currentPassword: "", newPassword: "" });
      toast({ kind: "success", title: "Password updated" });
    } catch (error) {
      toast({
        kind: "error",
        title: "Password not updated",
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setSavingPassword(false);
    }
  }

  async function toggleTwoFactor(enabled: boolean) {
    setSavingTwoFactor(true);
    try {
      const response = await fetch(enabled ? "/api/auth/2fa/enable" : "/api/auth/2fa/disable", {
        method: "POST"
      });
      const data = await response.json();

      if (!response.ok) throw new Error(cleanError(data.error, "Could not update two-step verification."));

      await loadMe();
      toast({ kind: "success", title: data.message ?? "Two-step verification updated" });
    } catch (error) {
      toast({
        kind: "error",
        title: "Security not updated",
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setSavingTwoFactor(false);
    }
  }

  function updateSoundSetting(key: keyof typeof soundSettings, value: boolean) {
    const next = { ...soundSettings, [key]: value };
    setSoundSettings(next);
    saveSoundSettings(next);
    if (!next.muted) sounds.play("tap");
    toast({ kind: "success", title: "Notification setting saved" });
  }

  async function askForNotifications() {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      toast({
        kind: "success",
        title: "Notifications enabled",
        description: "PureChat can now show message notifications when your browser allows it."
      });
      sounds.play("notification");
      return;
    }
    if (permission === "denied") {
      toast({
        kind: "info",
        title: "Notifications blocked",
        description: "You can enable notifications later from your browser settings."
      });
      return;
    }
    toast({
      kind: "info",
      title: "Notifications unavailable",
      description: "This browser does not support app notifications here."
    });
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Loading account settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
              {user?.avatarUrl ? (
                <img className="size-full object-cover" src={user.avatarUrl} alt="" />
              ) : (
                (user?.displayName ?? "PC").slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="font-semibold">{user?.displayName}</h2>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
            </div>
          </div>
          <Button
            className="gap-2"
            variant="secondary"
            type="button"
            onClick={() => toast({ kind: "info", title: "Coming soon", description: "Profile photo upload will be available soon." })}
          >
            <Camera className="size-4" />
            Profile photo
          </Button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextField label="Display name" value={form.displayName} onChange={(value) => setForm({ ...form, displayName: value })} />
          <TextField label="Username" value={form.username} onChange={(value) => setForm({ ...form, username: value })} />
          <TextField label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <TextField label="Phone" type="tel" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
          <SelectField
            label="Gender"
            value={form.gender}
            options={[
              ["", "Prefer not to say"],
              ["MALE", "Male"],
              ["FEMALE", "Female"],
              ["PREFER_NOT_TO_SAY", "Prefer not to say"]
            ]}
            onChange={(value) => setForm({ ...form, gender: value })}
          />
          <TextField label="Country/region" value={form.country} onChange={(value) => setForm({ ...form, country: value })} />
        </div>
        <div className="mt-4 grid gap-4">
          <TextField label="About/status" value={form.statusMessage} onChange={(value) => setForm({ ...form, statusMessage: value })} />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">About</span>
            <textarea
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={form.bio}
              onChange={(event) => setForm({ ...form, bio: event.target.value })}
            />
          </label>
        </div>
        {formError ? <p className="mt-3 text-sm text-destructive">{formError}</p> : null}
        <Button className="mt-4" disabled={savingProfile || Boolean(formError)} onClick={saveProfile}>
          {savingProfile ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Save profile
        </Button>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-medium">Privacy</h2>
        <div className="mt-4 grid gap-3">
          <SelectRow
            label="Last seen visibility"
            loading={savingPrivacy === "lastSeenVisibility"}
            value={privacy.lastSeenVisibility}
            options={visibilityOptions}
            onChange={(value) => savePrivacy({ ...privacy, lastSeenVisibility: value }, "lastSeenVisibility")}
          />
          <SelectRow
            label="Profile photo visibility"
            loading={savingPrivacy === "profilePhotoVisibility"}
            value={privacy.profilePhotoVisibility}
            options={visibilityOptions}
            onChange={(value) => savePrivacy({ ...privacy, profilePhotoVisibility: value }, "profilePhotoVisibility")}
          />
          <ToggleRow
            label="Active status"
            checked={privacy.onlineStatusEnabled}
            loading={savingPrivacy === "onlineStatusEnabled"}
            onChange={(checked) => savePrivacy({ ...privacy, onlineStatusEnabled: checked }, "onlineStatusEnabled")}
          />
          <ToggleRow
            label="Read receipts"
            checked={privacy.readReceiptsEnabled}
            loading={savingPrivacy === "readReceiptsEnabled"}
            onChange={(checked) => savePrivacy({ ...privacy, readReceiptsEnabled: checked }, "readReceiptsEnabled")}
          />
        </div>
        <Button asChild className="mt-4" variant="secondary">
          <Link href="/settings/security#blocked-users">View blocked users</Link>
        </Button>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-medium">Security</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField label="Current password" type="password" value={passwordForm.currentPassword} onChange={(value) => setPasswordForm({ ...passwordForm, currentPassword: value })} />
          <TextField label="New password" type="password" value={passwordForm.newPassword} onChange={(value) => setPasswordForm({ ...passwordForm, newPassword: value })} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={savingPassword || !passwordForm.currentPassword || !passwordForm.newPassword} onClick={changePassword}>
            {savingPassword ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Change password
          </Button>
          <Button disabled={savingTwoFactor} variant="secondary" onClick={() => toggleTwoFactor(!user?.profile?.twoFactorEnabled)}>
            {savingTwoFactor ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {user?.profile?.twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/settings/security">Active sessions</Link>
          </Button>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-medium">Notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sounds are generated locally with soft tones. Browser notifications are optional.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <SoundToggle label="Mute all" checked={soundSettings.muted} onChange={(value) => updateSoundSetting("muted", value)} />
          <SoundToggle label="Message sound" checked={soundSettings.messageSounds} onChange={(value) => updateSoundSetting("messageSounds", value)} />
          <SoundToggle label="Call sound" checked={soundSettings.callSounds} onChange={(value) => updateSoundSetting("callSounds", value)} />
          <SoundToggle label="Warning sound" checked={soundSettings.warningSounds} onChange={(value) => updateSoundSetting("warningSounds", value)} />
        </div>
        <div className="mt-4 rounded-md border bg-background p-3">
          <p className="text-sm font-medium">Browser notifications</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Current status: {formatNotificationPermission(notificationPermission)}
          </p>
          <Button className="mt-3" variant="secondary" type="button" onClick={() => void askForNotifications()}>
            Enable notifications
          </Button>
        </div>
      </section>
    </div>
  );
}

function formatNotificationPermission(permission: string) {
  if (permission === "granted") return "Enabled";
  if (permission === "denied") return "Blocked";
  if (permission === "unsupported") return "Not supported";
  return "Not requested";
}

function cleanError(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  if (value.trim().startsWith("[") || value.trim().startsWith("{")) return fallback;
  return value;
}

const visibilityOptions = [
  ["EVERYONE", "Everyone"],
  ["CONTACTS", "Contacts"],
  ["NOBODY", "Nobody"]
] as const;

function validateProfileForm(form: ProfileForm) {
  if (form.displayName.trim().length < 2) return "Display name must be at least 2 characters.";
  if (form.username.trim().length < 3) return "Username must be at least 3 characters.";
  if (!usernamePattern.test(form.username.trim())) return "Username can use letters, numbers, dot, and underscore.";
  if (form.email.trim() && !emailPattern.test(form.email.trim())) return "Enter a valid email address.";
  if (form.phone.trim() && !phonePattern.test(form.phone.trim())) return "Enter a valid phone number.";
  return "";
}

function TextField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <select
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, label]) => (
          <option key={optionValue || label} value={optionValue}>{label}</option>
        ))}
      </select>
    </label>
  );
}

function SelectRow({ label, value, options, loading, onChange }: { label: string; value: Visibility; options: typeof visibilityOptions; loading: boolean; onChange: (value: Visibility) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value as Visibility)}
        >
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>{optionLabel}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, loading, onChange }: { label: string; checked: boolean; loading: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-left text-sm"
      type="button"
      onClick={() => onChange(!checked)}
    >
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-2">
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        <span className={`rounded-full px-2 py-0.5 text-xs ${checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          {checked ? "On" : "Off"}
        </span>
      </span>
    </button>
  );
}

function SoundToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
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
