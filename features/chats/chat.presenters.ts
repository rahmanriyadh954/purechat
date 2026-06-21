import type { AnonymousConversation, Chat, ChatMember, Message, User } from "@prisma/client";

type ChatWithMembers = Chat & {
  members: Array<ChatMember & { user: Pick<User, "id" | "displayName" | "username" | "avatarUrl" | "lastSeenAt"> }>;
  messages?: Message[];
  anonymousRequest?: AnonymousConversation | null;
};

export function presentChat(
  chat: ChatWithMembers,
  currentUserId: string,
  options: {
    unreadCount?: number;
    onlineUserIds?: Set<string>;
    safetyStatus?: "SAFE" | "UNSURE" | "UNSAFE";
  } = {}
) {
  const otherMembers = chat.members.filter((member) => member.userId !== currentUserId);
  const directUser = chat.type === "DIRECT" ? otherMembers[0]?.user : undefined;
  const lastMessage = chat.messages?.[0];
  const anonymous = chat.anonymousRequest;
  const anonymousRevealed = Boolean(anonymous?.revealedAt);
  const title = anonymous && !anonymousRevealed
    ? getAnonymousTitle(anonymous, currentUserId)
    : chat.title ?? directUser?.displayName ?? "Chat";
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
    avatarUrl: anonymous && !anonymousRevealed ? null : chat.avatarUrl ?? directUser?.avatarUrl,
    lastMessage: getLastMessagePreview(lastMessage),
    lastMessageAt: chat.lastMessageAt,
    unreadCount: options.unreadCount ?? 0,
    safetyStatus: options.safetyStatus ?? "SAFE",
    anonymous: anonymous
      ? {
          status: anonymous.status,
          isSender: anonymous.senderId === currentUserId,
          isReceiver: anonymous.receiverId === currentUserId,
          expiresAt: anonymous.expiresAt,
          approvedAt: anonymous.approvedAt,
          revealedAt: anonymous.revealedAt,
          senderAlias: anonymous.senderAlias,
          receiverAlias: anonymous.receiverAlias
        }
      : null,
    searchText: [
      title,
      ...(anonymous && !anonymousRevealed
        ? [anonymous.senderAlias, anonymous.receiverAlias]
        : [
            chat.title,
            ...chat.members.flatMap((member) => [
              member.user.displayName,
              member.user.username
            ])
          ])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    members: chat.members.map((member) => {
      const masked = anonymous && !anonymousRevealed;
      return {
        userId: masked
          ? member.userId === currentUserId
            ? currentUserId
            : "anonymous"
          : member.userId,
        role: member.role,
        status: member.status,
        displayName: masked ? getAnonymousAlias(anonymous, member.userId) : member.user.displayName,
        username: masked ? "" : member.user.username,
        avatarUrl: masked ? null : member.user.avatarUrl,
        lastSeenAt: masked ? null : member.user.lastSeenAt,
        online: masked ? false : options.onlineUserIds?.has(member.userId) ?? false
      };
    })
  };
}

function getAnonymousTitle(anonymous: AnonymousConversation, currentUserId: string) {
  if (anonymous.senderId === currentUserId) return anonymous.receiverAlias;
  if (anonymous.receiverId === currentUserId) return anonymous.senderAlias;
  return "Anonymous Safe Request";
}

function getAnonymousAlias(anonymous: AnonymousConversation, userId: string) {
  if (anonymous.senderId === userId) return anonymous.senderAlias;
  if (anonymous.receiverId === userId) return anonymous.receiverAlias;
  return "Guest";
}

function getLastMessagePreview(message?: Message) {
  if (!message) return "";
  if (message.deletedAt) return "Message deleted";
  if (message.body?.trim()) return message.body;

  const metadata = message.metadata && typeof message.metadata === "object"
    ? message.metadata
    : null;
  if (metadata && "gifUrl" in metadata) return "GIF";
  if (metadata && "storageKey" in metadata) return "Sticker";

  switch (message.type) {
    case "IMAGE":
      return "Image";
    case "VIDEO":
      return "Video";
    case "FILE":
      return "Document";
    case "AUDIO":
      return "Audio";
    case "VOICE":
      return "Voice message";
    default:
      return "New message";
  }
}
