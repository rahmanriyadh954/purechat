import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyForm } from "@/components/auth/verify-form";

export default function VerifyPage() {
  return (
    <AuthShell title="Verify your account" description="Enter the code we sent.">
      <Suspense>
        <VerifyForm />
      </Suspense>
    </AuthShell>
  );
}
