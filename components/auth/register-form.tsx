"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSoundSystem } from "@/hooks/use-sound-system";

type RegisterFormState = {
  displayName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  gender: string;
};

type FieldErrors = Partial<Record<keyof RegisterFormState | "contact" | "form", string>>;

const initialForm: RegisterFormState = {
  displayName: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  gender: ""
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[1-9]\d{7,14}$/;
const usernamePattern = /^[a-zA-Z0-9._]+$/;

const passwordRules = [
  {
    label: "Minimum 10 characters",
    test: (value: string) => value.length >= 10
  },
  {
    label: "One uppercase letter",
    test: (value: string) => /[A-Z]/.test(value)
  },
  {
    label: "One lowercase letter",
    test: (value: string) => /[a-z]/.test(value)
  },
  {
    label: "One number",
    test: (value: string) => /[0-9]/.test(value)
  },
  {
    label: "One symbol",
    test: (value: string) => /[^A-Za-z0-9]/.test(value)
  }
];

function validateForm(form: RegisterFormState) {
  const errors: FieldErrors = {};
  const displayName = form.displayName.trim();
  const username = form.username.trim();
  const email = form.email.trim();
  const phone = form.phone.trim();

  if (!displayName) {
    errors.displayName = "Display name is required.";
  } else if (displayName.length < 2) {
    errors.displayName = "Display name must be at least 2 characters.";
  }

  if (!username) {
    errors.username = "Username is required.";
  } else if (username.length < 3) {
    errors.username = "Username must be at least 3 characters.";
  } else if (!usernamePattern.test(username)) {
    errors.username = "Use only letters, numbers, dot, and underscore.";
  }

  if (!email && !phone) {
    errors.contact = "Enter an email or phone number.";
  }

  if (email && !emailPattern.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (phone && !phonePattern.test(phone)) {
    errors.phone = "Enter a valid phone number, like +15551234567.";
  }

  if (!form.password) {
    errors.password = "Password is required.";
  } else if (!passwordRules.every((rule) => rule.test(form.password))) {
    errors.password = "Password does not meet all rules.";
  }

  if (form.confirmPassword && form.confirmPassword !== form.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

function hasErrors(errors: FieldErrors) {
  return Object.values(errors).some(Boolean);
}

export function RegisterForm() {
  const router = useRouter();
  const sounds = useSoundSystem();
  const [form, setForm] = useState<RegisterFormState>(initialForm);
  const [touched, setTouched] = useState<Partial<Record<keyof RegisterFormState | "contact", boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [duplicateWarning, setDuplicateWarning] = useState("");
  const [loading, setLoading] = useState(false);

  const clientErrors = useMemo(() => validateForm(form), [form]);
  const errors = { ...clientErrors, ...serverErrors };
  const isValid = !hasErrors(clientErrors);

  function updateField(field: keyof RegisterFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setTouched((current) => ({
      ...current,
      [field]: true,
      ...(field === "email" || field === "phone" ? { contact: true } : {})
    }));
    setServerErrors({});
    setDuplicateWarning("");
  }

  function shouldShow(field: keyof RegisterFormState | "contact") {
    if (
      (field === "displayName" || field === "username" || field === "password" || field === "contact") &&
      errors[field]
    ) {
      return true;
    }

    return submitted || touched[field] || Boolean(serverErrors[field]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setServerErrors({});
    setDuplicateWarning("");

    if (!isValid) {
      sounds.play("warning");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          username: form.username.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          password: form.password,
          gender: form.gender || undefined,
          deviceFingerprintHash: await createDeviceFingerprintHash()
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = typeof data.error === "string"
          ? data.error
          : "Account could not be created. Please check the form and try again.";
        const fieldErrors = typeof data.fieldErrors === "object" && data.fieldErrors
          ? data.fieldErrors
          : { form: message };
        setServerErrors(fieldErrors);
        if (data.code === "DUPLICATE_IDENTITY" || data.code === "DUPLICATE_DEVICE") {
          setDuplicateWarning(message);
        }
        sounds.play("warning");
        return;
      }

      const identifier = form.email.trim() || form.phone.trim();
      const notice = typeof data.verification?.message === "string"
        ? data.verification.message
        : "Your verification code was generated in the server logs.";
      router.push(`/auth/verify?identifier=${encodeURIComponent(identifier)}&notice=${encodeURIComponent(notice)}`);
    } catch {
      setServerErrors({
        form: "Account could not be created. Please check the form and try again."
      });
      sounds.play("warning");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4 rounded-lg border bg-card p-5" noValidate onSubmit={submit}>
      <Field
        autoComplete="name"
        error={shouldShow("displayName") ? errors.displayName : undefined}
        label="Display name"
        onBlur={() => setTouched((current) => ({ ...current, displayName: true }))}
        onChange={(value) => updateField("displayName", value)}
        placeholder="Your full name"
        required
        value={form.displayName}
      />

      <Field
        autoComplete="username"
        error={shouldShow("username") ? errors.username : undefined}
        label="Username"
        onBlur={() => setTouched((current) => ({ ...current, username: true }))}
        onChange={(value) => updateField("username", value)}
        placeholder="example.name"
        required
        value={form.username}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          autoComplete="email"
          error={shouldShow("email") ? errors.email : undefined}
          label="Email"
          onBlur={() => setTouched((current) => ({ ...current, email: true, contact: true }))}
          onChange={(value) => updateField("email", value)}
          placeholder="you@example.com"
          type="email"
          value={form.email}
        />
        <Field
          autoComplete="tel"
          error={shouldShow("phone") ? errors.phone : undefined}
          label="Phone"
          onBlur={() => setTouched((current) => ({ ...current, phone: true, contact: true }))}
          onChange={(value) => updateField("phone", value)}
          placeholder="+15551234567"
          type="tel"
          value={form.phone}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Email or phone is required.
      </p>
      {shouldShow("contact") && errors.contact ? (
        <p className="text-sm text-destructive">{errors.contact}</p>
      ) : null}

      <Field
        autoComplete="new-password"
        error={shouldShow("password") ? errors.password : undefined}
        label="Password"
        onBlur={() => setTouched((current) => ({ ...current, password: true }))}
        onChange={(value) => updateField("password", value)}
        placeholder="Create a strong password"
        required
        type="password"
        value={form.password}
      />

      <div className="grid gap-2 rounded-lg border bg-background p-3 text-xs text-muted-foreground">
        {passwordRules.map((rule) => {
          const passed = rule.test(form.password);
          return (
            <p className={passed ? "text-emerald-600 dark:text-emerald-400" : ""} key={rule.label}>
              {passed ? "OK" : "-"} {rule.label}
            </p>
          );
        })}
      </div>

      <Field
        autoComplete="new-password"
        error={shouldShow("confirmPassword") ? errors.confirmPassword : undefined}
        label="Confirm password"
        onBlur={() => setTouched((current) => ({ ...current, confirmPassword: true }))}
        onChange={(value) => updateField("confirmPassword", value)}
        placeholder="Repeat your password"
        type="password"
        value={form.confirmPassword}
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
              onClick={() => updateField("gender", value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {errors.form ? <p className="text-sm text-destructive">{errors.form}</p> : null}
      {duplicateWarning ? (
        <DuplicateWarningModal message={duplicateWarning} onClose={() => setDuplicateWarning("")} />
      ) : null}

      <Button className="w-full" disabled={loading || !isValid} type="submit">
        {loading ? "Creating account..." : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="font-medium text-primary" href="/auth/login">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function DuplicateWarningModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl border border-white/25 bg-card/95 p-5 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">
          Account safety
        </p>
        <h2 className="mt-2 text-lg font-semibold">Account already protected</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          For privacy, PureChat does not show details about any existing account.
        </p>
        <Button className="mt-5 w-full" onClick={onClose} type="button">
          Got it
        </Button>
      </div>
    </div>
  );
}

function Field({
  autoComplete,
  error,
  label,
  onBlur,
  onChange,
  placeholder,
  required,
  type = "text",
  value
}: {
  autoComplete?: string;
  error?: string;
  label: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-sm font-medium">
        <span>{label}</span>
        {required ? <span className="text-xs text-muted-foreground">Required</span> : null}
      </span>
      <input
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        className={`h-11 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring ${
          error ? "border-destructive focus:ring-destructive/30" : ""
        }`}
        placeholder={placeholder}
        type={type}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="block text-sm text-destructive">{error}</span> : null}
    </label>
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
