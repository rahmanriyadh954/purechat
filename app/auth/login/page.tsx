import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in to PureChat"
      description="Use your email, phone, or username."
    >
      <LoginForm />
    </AuthShell>
  );
}
