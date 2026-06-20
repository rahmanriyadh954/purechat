import { MessengerShell } from "@/components/chat/messenger-shell";
import { getCurrentSession } from "@/features/auth/current-user";
import { redirect } from "next/navigation";

export default async function ChatsPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/login?next=/chats");
  }

  return <MessengerShell />;
}
