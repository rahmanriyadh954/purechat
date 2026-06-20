import { CallHistory } from "@/components/calls/call-history";
import { getCurrentSession } from "@/features/auth/current-user";
import { redirect } from "next/navigation";

export default async function CallsPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/login?next=/calls");
  }

  return <CallHistory />;
}
