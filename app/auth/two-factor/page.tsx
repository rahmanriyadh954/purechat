import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyForm } from "@/components/auth/verify-form";

export default function TwoFactorPage() {
  return (
    <AuthShell title="Two-step check" description="Enter your security code.">
      <Suspense>
        <VerifyForm mode="two-factor" />
      </Suspense>
    </AuthShell>
  );
}
