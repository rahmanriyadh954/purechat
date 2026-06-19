export type ChatListItem = {
  id: string;
  title: string;
  avatarUrl?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: Date | null;
  unreadCount: number;
};
