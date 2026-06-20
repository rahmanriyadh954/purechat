import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyForm } from "@/components/auth/verify-form";

export default function VerifyPage() {
  return (
    <AuthShell title="Verify your account" description="Enter your 6 digit verification code.">
      <Suspense>
        <VerifyForm notice={process.env.OTP_PROVIDER === "console" ? "Your verification code was generated in the server logs." : undefined} />
      </Suspense>
    </AuthShell>
  );
}
