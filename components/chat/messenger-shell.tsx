"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  FileText,
  Gift,
  Image as ImageIcon,
  Menu,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Paperclip,
  Phone,
  Search,
  SendHorizontal,
  ShieldCheck,
  Smile,
  Sticker,
  Users,
  Video
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CallOverlay } from "@/components/calls/call-overlay";
import { GroupDetailsPanel } from "@/components/groups/group-details-panel";
import { useRealtimeMessaging, type RealtimeMessage } from "@/hooks/use-realtime-messaging";
import { useWebRtcCalls } from "@/hooks/use-webrtc-calls";
import { cn } from "@/lib/utils";

type Chat = {
  id: string;
  name: string;
  initials: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  typing?: boolean;
  members?: string;
  memberIds?: string[];
  accent: string;
};

type Message = {
  id: string;
  originalId?: string;
  senderId?: string | null;
  sender: "me" | "them";
  author?: string;
  text: string;
  time: string;
  status?: "sent" | "read";
  edited?: boolean;
  deleted?: boolean;
  pendingApproval?: boolean;
  reactions?: string[];
  attachments?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    fileType: string;
    sizeBytes: string;
    storageKey: string;
  }>;
  gifUrl?: string;
  stickerUrl?: string;
};

const fallbackChats: Chat[] = [
  {
    id: "family",
    name: "Family Circle",
    initials: "FC",
    lastMessage: "Amina is typing...",
    time: "now",
    unread: 3,
    online: true,
    typing: true,
    members: "8 members, 4 online",
    accent: "bg-emerald-500"
  },
  {
    id: "omar",
    name: "Omar Rahman",
    initials: "OR",
    lastMessage: "Voice message received",
    time: "12m",
    unread: 0,
    online: true,
    members: "Online",
    accent: "bg-sky-500"
  },
  {
    id: "team",
    name: "PureChat Team",
    initials: "PT",
    lastMessage: "The moderation review is ready.",
    time: "1h",
    unread: 1,
    online: false,
    members: "Last seen 18m ago",
    accent: "bg-violet-500"
  },
  {
    id: "study",
    name: "Study Group",
    initials: "SG",
    lastMessage: "Notes are pinned in the group.",
    time: "3h",
    unread: 0,
    online: false,
    members: "14 members",
    accent: "bg-amber-500"
  }
];

const fallbackMessages: Record<string, Message[]> = {
  family: [
    {
      id: "m1",
      sender: "them",
      author: "Amina",
      text: "Assalamu alaikum. Can you review the family group settings?",
      time: "7:42 PM"
    },
    {
      id: "m2",
      sender: "me",
      text: "Wa alaikum assalam. Family mode is enabled and unknown messages are blocked.",
      time: "7:44 PM",
      status: "read"
    },
    {
      id: "m3",
      sender: "them",
      author: "Yusuf",
      text: "Good. Please keep read receipts on for this group.",
      time: "7:46 PM"
    },
    {
      id: "m4",
      sender: "me",
      text: "Done. I also kept GIF and sticker filters on.",
      time: "7:47 PM",
      status: "read"
    }
  ],
  omar: [
    {
      id: "m5",
      sender: "them",
      author: "Omar",
      text: "I sent a voice note. Listen when you are free.",
      time: "6:21 PM"
    },
    {
      id: "m6",
      sender: "me",
      text: "Got it. I will reply after Maghrib.",
      time: "6:25 PM",
      status: "sent"
    }
  ],
  team: [
    {
      id: "m7",
      sender: "them",
      author: "Sara",
      text: "The report queue is clean now.",
      time: "5:10 PM"
    }
  ],
  study: [
    {
      id: "m8",
      sender: "them",
      author: "Nadia",
      text: "I added the notes to saved messages.",
      time: "3:08 PM"
    }
  ]
};

export function MessengerShell() {
  const realtime = useRealtimeMessaging();
  const calls = useWebRtcCalls();
  const [activeChatId, setActiveChatId] = useState(fallbackChats[0].id);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [groupDetailsOpen, setGroupDetailsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const chats = useMemo(() => {
    if (realtime.chats.length === 0) return fallbackChats;

    return realtime.chats.map((chat, index) => {
      const online = chat.members.some((member) =>
        realtime.onlineUserIds.has(member.userId)
      );
      const typingUsers = realtime.typingByChat[chat.id] ?? [];

      return {
        id: chat.id,
        name: chat.title,
        initials: chat.initials,
        lastMessage: typingUsers.length > 0 ? "Typing..." : chat.lastMessage || "No messages yet",
        time: chat.lastMessageAt ? formatRelativeTime(chat.lastMessageAt) : "",
        unread: 0,
        online,
        typing: typingUsers.length > 0,
        members:
          chat.type === "GROUP"
            ? `${chat.members.length} members`
            : online
              ? "Online"
              : "Offline",
        memberIds: chat.members
          .map((member) => member.userId)
          .filter((userId) => userId !== realtime.currentUser?.id),
        accent: ["bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-amber-500"][index % 4]
      };
    });
  }, [realtime.chats, realtime.onlineUserIds, realtime.typingByChat]);

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? chats[0];
  const activeMessages =
    realtime.chats.length > 0
      ? (realtime.messagesByChat[activeChat.id] ?? []).map((message) =>
          presentRealtimeMessage(message, realtime.currentUser?.id)
        )
      : fallbackMessages[activeChat.id] ?? [];

  useEffect(() => {
    if (realtime.chats.length > 0 && !realtime.chats.some((chat) => chat.id === activeChatId)) {
      setActiveChatId(realtime.chats[0].id);
    }
  }, [activeChatId, realtime.chats]);

  useEffect(() => {
    if (realtime.chats.length === 0 || !activeChat?.id) return;
    void realtime.loadMessages(activeChat.id);
  }, [activeChat?.id, realtime.chats.length, realtime.loadMessages]);

  useEffect(() => {
    if (realtime.chats.length === 0 || !activeChat?.id) return;
    const lastUnread = (realtime.messagesByChat[activeChat.id] ?? [])
      .filter((message) => message.senderId !== realtime.currentUser?.id)
      .filter(
        (message) =>
          !message.readReceipts?.some(
            (receipt) => receipt.userId === realtime.currentUser?.id && receipt.readAt
          )
      )
      .at(-1);

    if (lastUnread) {
      realtime.markRead(activeChat.id, lastUnread.id);
    }
  }, [
    activeChat?.id,
    realtime.chats.length,
    realtime.currentUser?.id,
    realtime.markRead,
    realtime.messagesByChat
  ]);

  const filteredChats = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return chats;

    return chats.filter((chat) =>
      [chat.name, chat.lastMessage, chat.members].some((field) =>
        field?.toLowerCase().includes(value)
      )
    );
  }, [query]);

  function openChat(chatId: string) {
    setActiveChatId(chatId);
    setMobileChatOpen(true);
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <div className="flex h-full">
        <Rail />

        <section
          className={cn(
            "flex h-full w-full flex-col border-r bg-card/95 backdrop-blur md:w-[380px] md:shrink-0",
            mobileChatOpen && "hidden md:flex"
          )}
        >
          <ChatListHeader />
          <SearchBox value={query} onChange={setQuery} />

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-1">
              {filteredChats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  active={chat.id === activeChat.id}
                  onClick={() => openChat(chat.id)}
                />
              ))}
            </div>
          </div>
        </section>

        <section
          className={cn(
            "hidden h-full min-w-0 flex-1 flex-col bg-background md:flex",
            mobileChatOpen && "flex"
          )}
        >
          <ChatHeader
            chat={activeChat}
            connected={realtime.connected}
            onStartCall={(type) =>
              calls.startCall({
                chatId: activeChat.id,
                type,
                participantIds: activeChat.memberIds,
                isGroupCall: (activeChat.memberIds?.length ?? 0) > 1
              })
            }
            onOpenGallery={() => setGalleryOpen((value) => !value)}
            onOpenGroupDetails={() => setGroupDetailsOpen((value) => !value)}
            onBack={() => setMobileChatOpen(false)}
          />

          <div className="flex min-h-0 flex-1 bg-muted/30">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-4xl flex-col gap-4">
              <DateDivider label="Today" />
              {activeMessages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onReact={(emoji) => {
                    if (message.originalId && realtime.chats.length > 0) {
                      realtime.addReaction(activeChat.id, message.originalId, emoji);
                    }
                  }}
                  onEdit={(body) => {
                    if (message.originalId && realtime.chats.length > 0) {
                      realtime.editMessage(activeChat.id, message.originalId, body);
                    }
                  }}
                  onDelete={() => {
                    if (message.originalId && realtime.chats.length > 0) {
                      realtime.deleteMessage(activeChat.id, message.originalId);
                    }
                  }}
                  onReport={() => {
                    if (message.originalId) {
                      void reportMessage(activeChat.id, message);
                    }
                  }}
                  onApprove={(approved) => {
                    if (message.originalId) {
                      void reviewPendingMessage(activeChat.id, message.originalId, approved);
                    }
                  }}
                />
              ))}
              <TypingIndicator chat={activeChat} />
            </div>
            </div>
            {groupDetailsOpen ? (
              <GroupDetailsPanel chatId={activeChat.id} />
            ) : galleryOpen ? (
              <MediaGallery messages={activeMessages} />
            ) : null}
          </div>

          <Composer
            chatName={activeChat.name}
            onSend={(body) => realtime.sendMessage(activeChat.id, body)}
            onTypingStart={() => realtime.startTyping(activeChat.id)}
            onTypingStop={() => realtime.stopTyping(activeChat.id)}
            onSendAttachment={(file, kind, caption) =>
              realtime.sendAttachment(activeChat.id, file, kind, caption)
            }
            onSendGif={(gifUrl, title) => realtime.sendGif(activeChat.id, gifUrl, title)}
            onSendSticker={(stickerId) => realtime.sendSticker(activeChat.id, stickerId)}
          />
        </section>
      </div>
      <CallOverlay
        incomingCall={calls.incomingCall}
        activeCall={calls.activeCall}
        localStream={calls.localStream}
        remoteStream={calls.remoteStream}
        onAccept={calls.acceptIncomingCall}
        onReject={calls.rejectIncomingCall}
        onEnd={calls.endActiveCall}
        onScreenShare={calls.startScreenShare}
      />
    </main>
  );
}

function Rail() {
  return (
    <aside className="hidden w-20 shrink-0 border-r bg-card md:flex md:flex-col md:items-center md:gap-3 md:px-3 md:py-4">
      <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <MessageCircle className="size-5" />
      </div>
      <Button variant="secondary" size="icon" aria-label="Chats">
        <MessageCircle className="size-5" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Groups">
        <Users className="size-5" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Calls">
        <Phone className="size-5" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Notifications">
        <Bell className="size-5" />
      </Button>
      <div className="mt-auto">
        <ThemeToggle />
      </div>
    </aside>
  );
}

function ChatListHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
      <div>
        <h1 className="text-xl font-semibold">Chats</h1>
        <p className="text-sm text-muted-foreground">Private and group messages</p>
      </div>
      <div className="flex items-center gap-1">
        <div className="md:hidden">
          <ThemeToggle />
        </div>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </div>
    </header>
  );
}

function SearchBox({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="shrink-0 border-b p-4">
      <label className="flex h-11 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground shadow-sm focus-within:ring-2 focus-within:ring-ring">
        <Search className="size-4 shrink-0" />
        <input
          className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          placeholder="Search chats"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}

function ChatListItem({
  chat,
  active,
  onClick
}: {
  chat: Chat;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "grid w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
        active ? "bg-secondary" : "hover:bg-muted"
      )}
      onClick={onClick}
    >
      <Avatar initials={chat.initials} accent={chat.accent} online={chat.online} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{chat.name}</p>
          {chat.typing ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              typing
            </span>
          ) : null}
        </div>
        <p
          className={cn(
            "truncate text-sm",
            chat.unread > 0 ? "font-medium text-foreground" : "text-muted-foreground"
          )}
        >
          {chat.lastMessage}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="text-xs text-muted-foreground">{chat.time}</span>
        {chat.unread > 0 ? (
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {chat.unread}
          </span>
        ) : (
          <span className="size-6" />
        )}
      </div>
    </button>
  );
}

function ChatHeader({
  chat,
  connected,
  onStartCall,
  onOpenGallery,
  onOpenGroupDetails,
  onBack
}: {
  chat: Chat;
  connected: boolean;
  onStartCall: (type: "AUDIO" | "VIDEO") => void;
  onOpenGallery: () => void;
  onOpenGroupDetails: () => void;
  onBack: () => void;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          className="md:hidden"
          variant="ghost"
          size="icon"
          aria-label="Back to chats"
          onClick={onBack}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <Avatar initials={chat.initials} accent={chat.accent} online={chat.online} />
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{chat.name}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {chat.online ? (
              <span className="size-2 rounded-full bg-emerald-500" />
            ) : null}
            <p className="truncate">
              {chat.typing ? "Typing now" : connected ? chat.members : "Connecting"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Start audio call" onClick={() => onStartCall("AUDIO")}>
          <Phone className="size-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Start video call" onClick={() => onStartCall("VIDEO")}>
          <Video className="size-5" />
        </Button>
        <Button className="hidden gap-2 sm:inline-flex" variant="secondary">
          <ShieldCheck className="size-4" />
          Safe
        </Button>
        <Button variant="ghost" size="icon" aria-label="Open media gallery" onClick={onOpenGallery}>
          <ImageIcon className="size-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Group details" onClick={onOpenGroupDetails}>
          <MoreHorizontal className="size-5" />
        </Button>
      </div>
    </header>
  );
}

function Avatar({
  initials,
  accent,
  online
}: {
  initials: string;
  accent: string;
  online: boolean;
}) {
  return (
    <div className="relative size-12 shrink-0">
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-lg text-sm font-semibold text-white shadow-sm",
          accent
        )}
      >
        {initials}
      </div>
      {online ? (
        <span className="absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-card bg-emerald-500" />
      ) : null}
    </div>
  );
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 text-xs text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      <span className="rounded-full border bg-background px-3 py-1">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function MessageBubble({
  message,
  onReact,
  onEdit,
  onDelete,
  onReport,
  onApprove
}: {
  message: Message;
  onReact: (emoji: string) => void;
  onEdit: (body: string) => void;
  onDelete: () => void;
  onReport: () => void;
  onApprove: (approved: boolean) => void;
}) {
  const isMine = message.sender === "me";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);

  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(78%,620px)] space-y-1",
          isMine ? "items-end" : "items-start"
        )}
      >
        {!isMine && message.author ? (
          <p className="px-1 text-xs font-medium text-muted-foreground">
            {message.author}
          </p>
        ) : null}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
            message.deleted && "italic opacity-70",
            isMine
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md border bg-card"
          )}
        >
          {editing ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                onEdit(draft);
                setEditing(false);
              }}
            >
              <input
                className="min-w-0 flex-1 rounded-md border bg-background px-2 text-foreground outline-none"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button className="font-medium" type="submit">
                Save
              </button>
            </form>
          ) : message.attachments && message.attachments.length > 0 ? (
            <AttachmentPreview attachments={message.attachments} />
          ) : message.gifUrl ? (
            <img className="max-h-72 rounded-lg object-cover" src={message.gifUrl} alt={message.text || "GIF"} />
          ) : message.stickerUrl ? (
            <img className="size-28 object-contain" src={message.stickerUrl} alt="Sticker" />
          ) : (
            message.text
          )}
        </div>
        {message.reactions && message.reactions.length > 0 ? (
          <div className={cn("flex gap-1 px-2", isMine ? "justify-end" : "justify-start")}>
            {message.reactions.map((reaction) => (
              <span key={reaction} className="rounded-full border bg-background px-2 py-0.5 text-xs">
                {reaction}
              </span>
            ))}
          </div>
        ) : null}
        {message.pendingApproval ? (
          <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
            Waiting for admin approval
          </div>
        ) : null}
        <div
          className={cn(
            "flex items-center gap-1 px-1 text-xs text-muted-foreground",
            isMine ? "justify-end" : "justify-start"
          )}
        >
          <span>{message.time}</span>
          {message.edited ? <span>edited</span> : null}
          {isMine && message.status ? (
            <CheckCheck
              className={cn(
                "size-3.5",
                message.status === "read" ? "text-primary" : "text-muted-foreground"
              )}
            />
          ) : null}
          {!message.deleted ? (
            <>
              <button onClick={() => onReact(":heart:")} type="button">
                React
              </button>
              {isMine ? (
                <>
                  <button onClick={() => setEditing(true)} type="button">
                    Edit
                  </button>
                  <button onClick={onDelete} type="button">
                    Delete
                  </button>
                </>
              ) : null}
              <button onClick={onReport} type="button">
                Report
              </button>
              {message.pendingApproval ? (
                <>
                  <button onClick={() => onApprove(true)} type="button">
                    Approve
                  </button>
                  <button onClick={() => onApprove(false)} type="button">
                    Reject
                  </button>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator({ chat }: { chat: Chat }) {
  if (!chat.typing) return null;

  return (
    <div className="flex items-center gap-3">
      <Avatar initials={chat.initials} accent={chat.accent} online={chat.online} />
      <div className="rounded-2xl rounded-bl-md border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="size-2 animate-pulse rounded-full bg-muted-foreground" />
          <span className="size-2 animate-pulse rounded-full bg-muted-foreground [animation-delay:120ms]" />
          <span className="size-2 animate-pulse rounded-full bg-muted-foreground [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
}

function Composer({
  chatName,
  onSend,
  onTypingStart,
  onTypingStop,
  onSendAttachment,
  onSendGif,
  onSendSticker
}: {
  chatName: string;
  onSend: (body: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onSendAttachment: (
    file: File,
    kind: "image" | "video" | "document" | "audio" | "voice",
    caption?: string
  ) => Promise<void>;
  onSendGif: (gifUrl: string, title?: string) => void;
  onSendSticker: (stickerId: string) => void;
}) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKindOverride, setFileKindOverride] = useState<"voice" | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [panel, setPanel] = useState<"emoji" | "gif" | "sticker" | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function submit() {
    if (!file && !body.trim()) return;

    if (file) {
      setUploading(true);
      try {
        await onSendAttachment(file, fileKindOverride ?? detectAttachmentKind(file), body);
        setFile(null);
        setFileKindOverride(null);
        toast({ kind: "success", title: "File sent" });
      } catch (error) {
        toast({
          kind: "error",
          title: "Upload failed",
          description: error instanceof Error ? error.message : "Please try again."
        });
      } finally {
        setUploading(false);
      }
    } else {
      onSend(body);
    }
    setBody("");
    onTypingStop();
  }

  return (
    <footer className="shrink-0 border-t bg-card px-3 py-3 sm:px-5">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex items-center gap-1 overflow-x-auto">
          <input
            id="chat-file-input"
            className="hidden"
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setFileKindOverride(null);
            }}
          />
          <input
            id="chat-voice-input"
            className="hidden"
            type="file"
            accept="audio/*"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setFileKindOverride("voice");
            }}
          />
          <Button asChild variant="ghost" size="icon" aria-label="Attach file">
            <label htmlFor="chat-file-input">
            <Paperclip className="size-5" />
            </label>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Add emoji" onClick={() => setPanel(panel === "emoji" ? null : "emoji")}>
            <Smile className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Send GIF" onClick={() => setPanel(panel === "gif" ? null : "gif")}>
            <Gift className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Send sticker" onClick={() => setPanel(panel === "sticker" ? null : "sticker")}>
            <Sticker className="size-5" />
          </Button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {file ? (
            <FilePreview
              file={file}
              previewUrl={filePreviewUrl}
              onRemove={() => {
                setFile(null);
                setFileKindOverride(null);
              }}
            />
          ) : null}
          {panel === "emoji" ? (
            <EmojiPanel onPick={(emoji) => setBody((value) => `${value}${emoji}`)} />
          ) : null}
          {panel === "gif" ? (
            <GifPanel
              onSend={(gif) => {
                onSendGif(gif.url, gif.title);
                setPanel(null);
              }}
            />
          ) : null}
          {panel === "sticker" ? (
            <StickerPanel
              onSend={(stickerId) => {
                onSendSticker(stickerId);
                setPanel(null);
              }}
            />
          ) : null}
          <div className="flex min-w-0 items-end gap-2">
          <div className="flex min-h-11 flex-1 items-center rounded-lg border bg-background px-3 shadow-sm focus-within:ring-2 focus-within:ring-ring">
            <textarea
              className="max-h-32 min-h-6 w-full resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              placeholder={`Message ${chatName}`}
              rows={1}
              value={body}
              onBlur={onTypingStop}
              onChange={(event) => {
                setBody(event.target.value);
                if (event.target.value.trim()) onTypingStart();
                else onTypingStop();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          </div>

          <Button variant="ghost" size="icon" aria-label="Record voice message">
            <label htmlFor="chat-voice-input">
              <Mic className="size-5" />
            </label>
          </Button>
          <Button size="icon" aria-label={uploading ? "Sending file" : "Send message"} disabled={uploading} onClick={submit}>
            <SendHorizontal className="size-5" />
          </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}

function presentRealtimeMessage(
  message: RealtimeMessage,
  currentUserId?: string
): Message {
  const isMine = message.senderId === currentUserId;
  const readByOther = message.readReceipts?.some(
    (receipt) => receipt.userId !== currentUserId && receipt.readAt
  );

  return {
    id: message.id,
    originalId: message.id,
    senderId: message.senderId,
    sender: isMine ? "me" : "them",
    author: isMine ? undefined : message.sender?.displayName,
    text: message.deletedAt ? "This message was deleted." : message.body ?? "",
    time: formatMessageTime(message.createdAt),
    status: readByOther ? "read" : "sent",
    edited: Boolean(message.editedAt),
    deleted: Boolean(message.deletedAt),
    pendingApproval: message.status === "PENDING_APPROVAL",
    reactions: message.reactions?.map((reaction) => reaction.emoji)
      .map((emoji) => emoji === ":heart:" ? "heart" : emoji),
    attachments: message.attachments,
    gifUrl: typeof message.metadata === "object" && message.metadata && "gifUrl" in message.metadata
      ? String(message.metadata.gifUrl)
      : undefined,
    stickerUrl: typeof message.metadata === "object" && message.metadata && "storageKey" in message.metadata
      ? `/api/files/${String(message.metadata.storageKey)}`
      : undefined
  };
}

async function reportMessage(chatId: string, message: Message) {
  await fetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "MESSAGE",
      chatId,
      messageId: message.originalId,
      reportedUserId: message.senderId,
      reason: "Unsafe or unwanted message"
    })
  });
}

async function reviewPendingMessage(chatId: string, messageId: string, approved: boolean) {
  await fetch(`/api/groups/${chatId}/messages/${messageId}/approval`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved })
  });
}

function detectAttachmentKind(file: File) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

function FilePreview({
  file,
  previewUrl,
  onRemove
}: {
  file: File;
  previewUrl: string | null;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background p-2">
      {previewUrl && file.type.startsWith("image/") ? (
        <img className="size-14 rounded-md object-cover" src={previewUrl} alt="" />
      ) : (
        <div className="flex size-14 items-center justify-center rounded-md bg-muted">
          <FileText className="size-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}

function AttachmentPreview({ attachments }: { attachments: NonNullable<Message["attachments"]> }) {
  const attachment = attachments[0];
  const fileUrl = `/api/files/${attachment.storageKey}`;

  if (attachment.mimeType.startsWith("image/")) {
    return (
      <div className="space-y-2">
        <img className="max-h-80 rounded-lg object-cover" src={fileUrl} alt={attachment.fileName} />
        <p className="text-xs opacity-80">{attachment.fileName}</p>
      </div>
    );
  }

  if (attachment.mimeType.startsWith("video/")) {
    return (
      <div className="space-y-2">
        <video className="max-h-80 rounded-lg" controls src={fileUrl} />
        <p className="text-xs opacity-80">{attachment.fileName}</p>
      </div>
    );
  }

  if (attachment.mimeType.startsWith("audio/")) {
    return (
      <div className="space-y-2">
        <p className="font-medium">{attachment.fileType === "voice" ? "Voice message" : attachment.fileName}</p>
        <audio controls src={fileUrl} />
      </div>
    );
  }

  return (
    <a className="flex items-center gap-3 rounded-lg border bg-background/80 p-3 transition hover:bg-muted" href={fileUrl} target="_blank" rel="noreferrer">
      <div className="flex size-10 items-center justify-center rounded-md bg-muted">
        <FileText className="size-5" />
      </div>
      <div>
        <p className="font-medium">{attachment.fileName}</p>
        <p className="text-xs opacity-80">{formatBytes(Number(attachment.sizeBytes))}</p>
      </div>
    </a>
  );
}

function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
  const emojis = [":)", ":D", "<3", "thumbs-up", "smile", "party", "done", "dua"];

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border bg-background p-2">
      {emojis.map((emoji) => (
        <button className="rounded-md px-2 py-1 text-lg hover:bg-muted" key={emoji} onClick={() => onPick(emoji)} type="button">
          {emoji}
        </button>
      ))}
    </div>
  );
}

function GifPanel({ onSend }: { onSend: (gif: { url: string; title: string }) => void }) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Array<{ title: string; url: string; previewUrl?: string }>>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadGifs() {
      const response = await fetch(`/api/gifs/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) return;
      const data = await response.json();
      if (!cancelled) setGifs(data.gifs);
    }

    void loadGifs();

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="space-y-2 rounded-lg border bg-background p-2">
      <input
        className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        placeholder="Search GIFs"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {gifs.map((gif) => (
          <button className="overflow-hidden rounded-md border text-left" key={gif.url} onClick={() => onSend(gif)} type="button">
            <img className="h-24 w-full object-cover" src={gif.previewUrl ?? gif.url} alt={gif.title} />
            <span className="block truncate px-2 py-1 text-xs">{gif.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StickerPanel({ onSend }: { onSend: (stickerId: string) => void }) {
  const [stickers, setStickers] = useState<Array<{ id: string; name: string; storageKey: string }>>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadStickers() {
      const response = await fetch("/api/stickers");
      if (!response.ok) return;
      const data = await response.json();
      const nextStickers = data.packs.flatMap(
        (pack: { stickers: Array<{ id: string; name: string; storageKey: string }> }) =>
          pack.stickers
      );
      if (!cancelled) setStickers(nextStickers);
    }

    void loadStickers();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex gap-2 overflow-x-auto rounded-lg border bg-background p-2">
      {stickers.length === 0 ? (
        <p className="px-2 py-1 text-sm text-muted-foreground">No stickers yet</p>
      ) : (
        stickers.map((sticker) => (
          <button className="rounded-md border p-2 text-sm hover:bg-muted" key={sticker.id} onClick={() => onSend(sticker.id)} type="button">
            <img className="size-14 object-contain" src={`/api/files/${sticker.storageKey}`} alt={sticker.name} />
          </button>
        ))
      )}
    </div>
  );
}

function MediaGallery({ messages }: { messages: Message[] }) {
  const attachments = messages.flatMap((message) => message.attachments ?? []);

  return (
    <aside className="hidden w-80 shrink-0 border-l bg-card p-4 xl:block">
      <h2 className="font-semibold">Media</h2>
      <p className="mb-4 text-sm text-muted-foreground">Shared files in this chat</p>
      {attachments.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background p-5 text-center">
          <ImageIcon className="mx-auto mb-3 size-6 text-muted-foreground" />
          <p className="text-sm font-medium">No shared media yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Images, documents, audio, and videos will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {attachments.map((attachment) => (
            <a className="rounded-lg border bg-background p-3 transition hover:bg-muted" href={`/api/files/${attachment.storageKey}`} key={attachment.id} target="_blank" rel="noreferrer">
              <FileText className="mb-2 size-5 text-primary" />
              <p className="truncate text-sm font-medium">{attachment.fileName}</p>
              <p className="text-xs text-muted-foreground">{attachment.fileType}</p>
            </a>
          ))}
        </div>
      )}
    </aside>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatMessageTime(value: string | Date) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatRelativeTime(value: string | Date) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString();
}
