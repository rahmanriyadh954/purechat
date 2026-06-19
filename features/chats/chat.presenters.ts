import type { Chat, ChatMember, Message, User } from "@prisma/client";

type ChatWithMembers = Chat & {
  members: Array<ChatMember & { user: Pick<User, "id" | "displayName" | "username" | "avatarUrl" | "lastSeenAt"> }>;
  messages?: Message[];
};

export function presentChat(chat: ChatWithMembers, currentUserId: string) {
  const otherMembers = chat.members.filter((member) => member.userId !== currentUserId);
  const directUser = chat.type === "DIRECT" ? otherMembers[0]?.user : undefined;
  const lastMessage = chat.messages?.[0];
  const title = chat.title ?? directUser?.displayName ?? "Chat";
  const initials = title
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    id: chat.id,
    type: chat.type,
    title,
    initials,
    avatarUrl: chat.avatarUrl ?? directUser?.avatarUrl,
    lastMessage: lastMessage?.body ?? "",
    lastMessageAt: chat.lastMessageAt,
    members: chat.members.map((member) => ({
      userId: member.userId,
      role: member.role,
      status: member.status,
      displayName: member.user.displayName,
      username: member.user.username,
      avatarUrl: member.user.avatarUrl,
      lastSeenAt: member.user.lastSeenAt
    }))
  };
}
