import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      description="Start with your name, username, and a safe password."
    >
      <RegisterForm />
    </AuthShell>
  );
}
