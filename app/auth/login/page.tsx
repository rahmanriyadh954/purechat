import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentSession } from "@/features/auth/current-user";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/chats");
  }

  return (
    <AuthShell
      title="Sign in to PureChat"
      description="Use your email, phone, or username."
    >
      <LoginForm />
    </AuthShell>
  );
}
