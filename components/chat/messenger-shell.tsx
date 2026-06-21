"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCheck,
  FileText,
  Gift,
  Image as ImageIcon,
  Inbox,
  Loader2,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Paperclip,
  Phone,
  PhoneOff,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  ShieldCheck,
  Smile,
  Sticker,
  UserCircle,
  Users,
  Video,
  X
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { CallOverlay } from "@/components/calls/call-overlay";
import { GroupDetailsPanel } from "@/components/groups/group-details-panel";
import { AccountMenu, AppRail, MobileBottomNavigation } from "@/components/navigation/app-navigation";
import { useRealtimeMessaging, type RealtimeChat, type RealtimeMessage } from "@/hooks/use-realtime-messaging";
import { useSoundSystem } from "@/hooks/use-sound-system";
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
  searchText: string;
  safetyStatus: "SAFE" | "UNSURE" | "UNSAFE";
  anonymous: {
    status: "PENDING" | "ACCEPTED" | "REJECTED" | "REPORTED" | "BLOCKED" | "EXPIRED" | "REVEALED";
    isSender: boolean;
    isReceiver: boolean;
    expiresAt: string | Date;
    approvedAt?: string | Date | null;
    revealedAt?: string | Date | null;
    senderAlias: string;
    receiverAlias: string;
  } | null;
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
  status?: "sent" | "read" | "failed" | "sending";
  failed?: boolean;
  error?: string;
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

export function MessengerShell() {
  const realtime = useRealtimeMessaging();
  const calls = useWebRtcCalls();
  const { toast } = useToast();
  const sounds = useSoundSystem();
  const previousCallStateRef = useRef(calls.callState);
  const [activeChatId, setActiveChatId] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [groupDetailsOpen, setGroupDetailsOpen] = useState(false);
  const [callModal, setCallModal] = useState<{ title: string; description: string } | null>(null);
  const [safeModeOpen, setSafeModeOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [anonymousStartOpen, setAnonymousStartOpen] = useState(false);
  const [anonymousByChat, setAnonymousByChat] = useState<Record<string, NonNullable<Chat["anonymous"]>>>({});
  const [safetyByChat, setSafetyByChat] = useState<Record<string, Chat["safetyStatus"]>>({});
  const [query, setQuery] = useState("");

  const chats = useMemo(() => {
    return realtime.chats.map((chat, index) => {
      const online = chat.members.some((member) =>
        member.userId !== realtime.currentUser?.id &&
        (member.online ||
          realtime.onlineUserIds.has(member.userId) ||
          isRecentlyOnline(member.lastSeenAt))
      );
      const typingUsers = realtime.typingByChat[chat.id] ?? [];

      return {
        id: chat.id,
        name: chat.title,
        initials: chat.initials,
        lastMessage: typingUsers.length > 0 ? "Typing..." : chat.lastMessage || "No messages yet",
        time: chat.lastMessageAt ? formatRelativeTime(chat.lastMessageAt) : "",
        unread: chat.unreadCount,
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
        searchText: chat.searchText,
        safetyStatus: safetyByChat[chat.id] ?? chat.safetyStatus,
        anonymous: anonymousByChat[chat.id] ?? chat.anonymous,
        accent: ["bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-amber-500"][index % 4]
      };
    });
  }, [anonymousByChat, realtime.chats, realtime.currentUser?.id, realtime.onlineUserIds, realtime.typingByChat, safetyByChat]);

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? chats[0];
  const activeMessages = activeChat
    ? (realtime.messagesByChat[activeChat.id] ?? []).map((message) =>
        presentRealtimeMessage(message, realtime.currentUser?.id)
      )
    : [];
  const activeMessagesLoading = activeChat
    ? Boolean(realtime.loadingMessagesByChat[activeChat.id])
    : false;
  const activeMessagesError = activeChat
    ? realtime.messageErrorsByChat[activeChat.id]
    : "";

  useEffect(() => {
    if (chats.length > 0 && !chats.some((chat) => chat.id === activeChatId)) {
      setActiveChatId(chats[0].id);
    }
  }, [activeChatId, chats]);

  useEffect(() => {
    if (calls.incomingCall) sounds.play("incomingCall");
  }, [calls.incomingCall, sounds.play]);

  useEffect(() => {
    if (previousCallStateRef.current !== "idle" && calls.callState === "idle") {
      sounds.play("callEnded");
    }
    previousCallStateRef.current = calls.callState;
  }, [calls.callState, sounds.play]);

  useEffect(() => {
    if (!activeChat?.id) return;
    void realtime.loadMessages(activeChat.id);
  }, [activeChat?.id, realtime.loadMessages]);

  useEffect(() => {
    if (!activeChat?.id || realtime.connected) return;

    const timer = window.setInterval(() => {
      void realtime.loadMessages(activeChat.id);
      void realtime.refreshChats();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [activeChat?.id, realtime.connected, realtime.loadMessages, realtime.refreshChats]);

  useEffect(() => {
    if (!activeChat?.id) return;
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
      sounds.play("messageReceived");
      toast({
        kind: "info",
        title: `New message in ${activeChat.name}`,
        description: lastUnread.body ?? "New message"
      });
    }
  }, [
    activeChat?.id,
    realtime.currentUser?.id,
    realtime.markRead,
    realtime.messagesByChat,
    sounds.play,
    toast
  ]);

  const filteredChats = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return chats;

    return chats.filter((chat) =>
      [chat.name, chat.lastMessage, chat.members, chat.searchText].some((field) =>
        field?.toLowerCase().includes(value)
      )
    );
  }, [chats, query]);

  function openChat(chatId: string) {
    setActiveChatId(chatId);
    setMobileChatOpen(true);
  }

  async function startCall(type: "AUDIO" | "VIDEO") {
    if (!activeChat) return;
    const participantIds = activeChat.memberIds ?? [];

    if (activeChat.anonymous && activeChat.anonymous.status !== "REVEALED") {
      setCallModal({
        title: "Calls unlock after reveal",
        description: "Anonymous Safe Requests keep both identities protected. Voice and video calls are available after the receiver approves and both people mark the conversation Safe."
      });
      return;
    }

    if (participantIds.length !== 1) {
      setCallModal({
        title: "Group calls are coming soon",
        description: "PureChat can save group call history now. Live group audio and video needs an SFU media server, so this button will be enabled after that server is connected."
      });
      return;
    }

    try {
      await calls.startCall({
        chatId: activeChat.id,
        type,
        participantIds,
        isGroupCall: false
      });
    } catch (error) {
      setCallModal({
        title: `${type === "VIDEO" ? "Video" : "Voice"} call is not available`,
        description: getErrorMessage(error)
      });
    }
  }

  return (
    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_32%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.14),transparent_34%),hsl(var(--background))] text-foreground">
      <div className="flex h-full p-0 md:p-3">
        <AppRail />

        <section
          className={cn(
            "flex h-full w-full flex-col border-r border-white/20 bg-card/78 shadow-2xl shadow-black/5 backdrop-blur-2xl md:w-[392px] md:shrink-0 md:rounded-l-2xl md:border",
            mobileChatOpen && "hidden md:flex"
          )}
        >
          <ChatListHeader onStartChat={() => setNewChatOpen(true)} />
          <SearchBox value={query} onChange={setQuery} />

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
            <div className="space-y-2">
              {realtime.loadingChats ? (
                <ChatListSkeleton />
              ) : realtime.error ? (
                <SidebarState
                  icon={<AlertCircle className="size-6" />}
                  title="Could not load chats"
                  description={realtime.error}
                />
              ) : chats.length === 0 ? (
                <SidebarState
                  icon={<Inbox className="size-6" />}
                  title="No chats yet"
                  description="Start a direct chat or create a group to begin messaging."
                />
              ) : filteredChats.length === 0 ? (
                <SidebarState
                  icon={<Search className="size-6" />}
                  title="No matching chats"
                  description="Try another search term."
                />
              ) : (
                filteredChats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  active={chat.id === activeChat?.id}
                  onClick={() => openChat(chat.id)}
                />
                ))
              )}
            </div>
          </div>
        </section>

        <section
          className={cn(
            "hidden h-full min-w-0 flex-1 flex-col overflow-hidden bg-background/58 shadow-2xl shadow-black/5 backdrop-blur md:flex md:rounded-r-2xl md:border-y md:border-r md:border-white/20",
            mobileChatOpen && "flex"
          )}
        >
          {activeChat ? (
            <>
              <ChatHeader
                chat={activeChat}
                connected={realtime.connected}
                onStartCall={startCall}
                onOpenGallery={() => setGalleryOpen((value) => !value)}
                onOpenGroupDetails={() => setGroupDetailsOpen((value) => !value)}
                onSafeInfo={() => setSafeModeOpen(true)}
                onBack={() => setMobileChatOpen(false)}
              />

              <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[linear-gradient(135deg,hsl(var(--muted)/0.54),hsl(var(--background)/0.32)),radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.09),transparent_25%),radial-gradient(circle_at_80%_0%,hsl(var(--accent)/0.1),transparent_28%)]">
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:thin] sm:px-6 sm:py-6 lg:px-8">
                  <div className="mx-auto flex max-w-4xl flex-col gap-4 pb-2">
                    {activeMessagesLoading ? (
                      <MessageSkeleton />
                    ) : activeMessagesError ? (
                      <MessageState
                        icon={<AlertCircle className="size-6" />}
                        title="Could not load messages"
                        description={activeMessagesError}
                        actionLabel="Try again"
                        onAction={() => void realtime.loadMessages(activeChat.id)}
                      />
                    ) : activeMessages.length === 0 ? (
                      <MessageState
                        icon={<MessageCircle className="size-6" />}
                        title="No messages yet"
                        description="Send the first message in this chat."
                      />
                    ) : (
                      <>
                        <AnonymousRequestBanner
                          chat={activeChat}
                          onAction={async (action, note) => {
                            const updated = await updateAnonymousRequest(activeChat.id, action, note);
                            await realtime.refreshChats();
                            if (action === "REJECT" || action === "BLOCK") {
                              realtime.hideChat(activeChat.id);
                              setMobileChatOpen(false);
                              return;
                            }
                            if (updated) {
                              setAnonymousByChat((current) => ({
                                ...current,
                                [activeChat.id]: {
                                  ...activeChat.anonymous!,
                                  status: updated.status,
                                  approvedAt: updated.approvedAt,
                                  revealedAt: updated.revealedAt
                                }
                              }));
                            }
                          }}
                        />
                        <DateDivider label="Today" />
                        {activeMessages.map((message) => (
                          <MessageBubble
                            key={message.id}
                            message={message}
                            anonymousRestricted={Boolean(activeChat.anonymous && activeChat.anonymous.status !== "REVEALED")}
                            onReact={async (emoji) => {
                              if (!message.originalId) return;
                              await realtime.addReaction(activeChat.id, message.originalId, emoji);
                            }}
                            onEdit={async (body) => {
                              if (!message.originalId) return;
                              await realtime.editMessage(activeChat.id, message.originalId, body);
                            }}
                            onDelete={async () => {
                              if (!message.originalId) return;
                              await realtime.deleteMessage(activeChat.id, message.originalId);
                            }}
                            onReport={async (reason, details) => {
                              if (!message.originalId) return;
                              await reportMessage(activeChat.id, message, reason, details);
                            }}
                            onApprove={async (approved) => {
                              if (!message.originalId) return;
                              try {
                                await reviewPendingMessage(activeChat.id, message.originalId, approved);
                                await realtime.loadMessages(activeChat.id);
                                toast({
                                  kind: "success",
                                  title: approved ? "Message approved" : "Message rejected"
                                });
                              } catch (error) {
                                toast({
                                  kind: "error",
                                  title: "Review failed",
                                  description: getErrorMessage(error)
                                });
                              }
                            }}
                            onRetry={async () => {
                              if (!message.originalId) return;
                              await realtime.retryMessage(activeChat.id, message.originalId);
                            }}
                          />
                        ))}
                        <TypingIndicator chat={activeChat} />
                      </>
                    )}
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
                textOnly={Boolean(activeChat.anonymous && activeChat.anonymous.status !== "REVEALED")}
              />
            </>
          ) : (
            <EmptyChatPane loading={realtime.loadingChats} error={realtime.error} />
          )}
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
      <MissedCallNotifications
        calls={calls.missedCalls}
        onDismiss={calls.dismissMissedCall}
      />
      {callModal ? (
        <CallUnavailableModal
          title={callModal.title}
          description={callModal.description}
          onClose={() => setCallModal(null)}
        />
      ) : null}
      {activeChat && safeModeOpen ? (
        <SafeModeModal
          chat={activeChat}
          onClose={() => setSafeModeOpen(false)}
          onUpdate={(status) => {
            setSafetyByChat((current) => ({ ...current, [activeChat.id]: status }));
            void realtime.refreshChats();
          }}
          onReveal={async () => {
            await realtime.refreshChats();
            setSafeModeOpen(false);
          }}
          onEndConversation={() => {
            realtime.hideChat(activeChat.id);
            setSafeModeOpen(false);
            setMobileChatOpen(false);
          }}
        />
      ) : null}
      {anonymousStartOpen ? (
        <AnonymousStartModal
          onClose={() => setAnonymousStartOpen(false)}
          onCreated={async () => {
            await realtime.refreshChats();
            setAnonymousStartOpen(false);
            toast({ kind: "success", title: "Anonymous request sent" });
          }}
        />
      ) : null}
      {newChatOpen ? (
        <NewChatModal
          onClose={() => setNewChatOpen(false)}
          onStartAnonymous={() => {
            setNewChatOpen(false);
            setAnonymousStartOpen(true);
          }}
          onCreated={async (chat) => {
            realtime.upsertChat(chat);
            setActiveChatId(chat.id);
            setMobileChatOpen(true);
            setNewChatOpen(false);
            await realtime.loadMessages(chat.id);
            void realtime.refreshChats();
            toast({ kind: "success", title: "Chat started" });
          }}
        />
      ) : null}
      <div className={mobileChatOpen ? "hidden md:block" : undefined}>
        <MobileBottomNavigation />
      </div>
    </main>
  );
}

function ChatListSkeleton() {
  return (
    <div className="space-y-3 px-2 py-1">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="flex items-center gap-3 rounded-2xl px-2 py-3" key={index}>
          <Skeleton className="size-12 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

function SidebarState({
  icon,
  title,
  description
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-2 mt-8 rounded-2xl border border-dashed border-white/30 bg-background/64 p-6 text-center shadow-lg shadow-black/5 backdrop-blur">
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted/70 text-muted-foreground">
        {icon}
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function EmptyChatPane({ loading, error }: { loading: boolean; error?: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.1),transparent_36%)] p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl border border-white/30 bg-card/78 text-primary shadow-xl shadow-primary/10 backdrop-blur">
          {loading ? <Loader2 className="size-6 animate-spin" /> : <MessageCircle className="size-6" />}
        </div>
        <h2 className="text-lg font-semibold">
          {loading ? "Loading chats" : error ? "Chat is unavailable" : "Select a chat"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {loading
            ? "PureChat is loading your conversations."
            : error
              ? error
              : "Choose a conversation from the list to start messaging."}
        </p>
      </div>
    </div>
  );
}

function MissedCallNotifications({
  calls,
  onDismiss
}: {
  calls: Array<{
    id: string;
    type: "AUDIO" | "VIDEO";
    startedBy?: { displayName: string } | null;
    chat?: { title: string | null } | null;
  }>;
  onDismiss: (callId: string) => void;
}) {
  if (calls.length === 0) return null;

  return (
    <div className="fixed left-4 top-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
      {calls.map((call) => (
        <div className="rounded-2xl border border-destructive/30 bg-card/82 p-4 shadow-xl backdrop-blur-2xl" key={call.id}>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <PhoneOff className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Missed {call.type === "VIDEO" ? "video" : "voice"} call</p>
              <p className="truncate text-sm text-muted-foreground">
                {call.startedBy?.displayName ?? call.chat?.title ?? "Unknown caller"}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Dismiss missed call" onClick={() => onDismiss(call.id)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CallUnavailableModal({
  title,
  description,
  onClose
}: {
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/76 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl border border-white/25 bg-card/86 p-5 shadow-2xl backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Calls</p>
            <h2 className="mt-1 text-xl font-semibold">{title}</h2>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button asChild variant="secondary">
            <Link href="/calls">View call history</Link>
          </Button>
          <Button onClick={onClose}>Got it</Button>
        </div>
      </div>
    </div>
  );
}

function AnonymousStartModal({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [receiverUsername, setReceiverUsername] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "anonymous",
          receiverUsername,
          message: message.trim() || undefined
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Could not send anonymous request.");
      }
      await onCreated();
    } catch (error) {
      toast({
        kind: "error",
        title: "Request failed",
        description: getErrorMessage(error)
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/76 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <div className="w-full rounded-t-3xl border border-white/25 bg-card/86 p-5 shadow-2xl backdrop-blur-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Anonymous Safe Request</p>
            <h2 className="mt-1 text-xl font-semibold">Start safely</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Both identities stay hidden as guest names until the request is accepted and both people mark the chat safe.
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-medium">Receiver username</span>
          <input
            className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="username"
            value={receiverUsername}
            onChange={(event) => setReceiverUsername(event.target.value)}
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium">Opening note</span>
          <span className="ml-2 text-xs text-muted-foreground">Shown with the request before acceptance</span>
          <textarea
            className="mt-2 min-h-28 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Optional: write a respectful reason for starting this anonymous chat."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={saving || receiverUsername.trim().length < 3} onClick={() => void submit()}>
            {saving ? "Sending" : "Send Request"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AnonymousRequestBanner({
  chat,
  onAction
}: {
  chat: Chat;
  onAction: (
    action: "ACCEPT" | "REJECT" | "REPORT" | "BLOCK",
    note?: string
  ) => Promise<void>;
}) {
  const { toast } = useToast();
  const sounds = useSoundSystem();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const anonymous = chat.anonymous;

  if (!anonymous || anonymous.status === "REVEALED") return null;

  async function run(action: "ACCEPT" | "REJECT" | "REPORT" | "BLOCK") {
    setBusy(action);
    try {
      await onAction(action, note.trim() || undefined);
      toast({
        kind: "success",
        title:
          action === "ACCEPT"
            ? "Request accepted"
            : action === "REJECT"
              ? "Request rejected"
              : action === "BLOCK"
                ? "Guest blocked"
                : "Report sent"
      });
      sounds.play(action === "ACCEPT" ? "safe" : action === "REPORT" || action === "BLOCK" ? "report" : "notification");
    } catch (error) {
      toast({
        kind: "error",
        title: "Action failed",
        description: getErrorMessage(error)
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-white/30 bg-card/78 p-4 shadow-xl shadow-black/5 backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Anonymous Safe Request</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {anonymous.status === "PENDING"
              ? anonymous.isReceiver
                ? "This guest wants to start a safe anonymous conversation."
                : "Waiting for the receiver to accept this anonymous request."
              : anonymous.status === "ACCEPTED"
                ? "Accepted. Real identities reveal only after both people mark this chat Safe."
                : `Status: ${anonymous.status.toLowerCase()}`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Expires {new Date(anonymous.expiresAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {anonymous.isReceiver && anonymous.status === "PENDING" ? (
        <textarea
          className="mt-3 min-h-20 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Optional note for Report or Block only. It is not sent when you accept."
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      ) : null}

      {anonymous.isReceiver && anonymous.status === "PENDING" ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Button disabled={Boolean(busy)} onClick={() => void run("ACCEPT")}>
            {busy === "ACCEPT" ? "Accepting" : "Accept"}
          </Button>
          <Button disabled={Boolean(busy)} variant="secondary" onClick={() => void run("REJECT")}>
            {busy === "REJECT" ? "Rejecting" : "Reject"}
          </Button>
          <Button disabled={Boolean(busy)} variant="secondary" onClick={() => void run("REPORT")}>
            {busy === "REPORT" ? "Reporting" : "Report"}
          </Button>
          <Button disabled={Boolean(busy)} variant="destructive" onClick={() => void run("BLOCK")}>
            {busy === "BLOCK" ? "Blocking" : "Block"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SafeModeModal({
  chat,
  onClose,
  onUpdate,
  onReveal,
  onEndConversation
}: {
  chat: Chat;
  onClose: () => void;
  onUpdate: (status: Chat["safetyStatus"]) => void;
  onReveal: () => Promise<void>;
  onEndConversation: () => void;
}) {
  const { toast } = useToast();
  const sounds = useSoundSystem();
  const [status, setStatus] = useState<Chat["safetyStatus"]>(chat.safetyStatus);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [revealEligible, setRevealEligible] = useState(false);
  const [bothSafe, setBothSafe] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; status: Chat["safetyStatus"]; action?: string | null; createdAt: string | Date }>>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadSafety() {
      try {
        const response = await fetch(`/api/chats/${chat.id}/safety`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;
        if (cancelled) return;
        setStatus(data.safety?.status ?? chat.safetyStatus);
        setHistory(data.safety?.history ?? []);
        setRevealEligible(Boolean(data.safety?.anonymousReveal?.eligible));
        setBothSafe(Boolean(data.safety?.anonymousReveal?.bothSafe));
      } catch {
        // The menu still works without history.
      }
    }

    void loadSafety();

    return () => {
      cancelled = true;
    };
  }, [chat.id, chat.safetyStatus]);

  async function saveSafety(nextStatus: Chat["safetyStatus"], action?: "REPORT" | "BLOCK" | "END_CONVERSATION") {
    setSaving(action ?? nextStatus);
    try {
      const response = await fetch(`/api/chats/${chat.id}/safety`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          action,
          note: note.trim() || undefined
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Could not update Safe Mode.");
      }

      setStatus(nextStatus);
      onUpdate(nextStatus);
      setRevealEligible(Boolean(data.anonymousReveal?.eligible));
      setBothSafe(Boolean(data.anonymousReveal?.bothSafe));
      if (data.event) {
        setHistory((current) => [data.event, ...current].slice(0, 5));
      }

      if (action === "END_CONVERSATION") {
        toast({ kind: "success", title: "Conversation ended" });
        onEndConversation();
        return;
      }

      toast({
        kind: "success",
        title: action === "BLOCK" ? "User blocked" : action === "REPORT" ? "Report sent" : "Safe Mode updated"
      });
      sounds.play(
        nextStatus === "UNSAFE"
          ? "warning"
          : action === "BLOCK" || action === "REPORT"
            ? "report"
            : nextStatus === "SAFE"
              ? "safe"
              : "notification"
      );
    } catch (error) {
      toast({
        kind: "error",
        title: "Safe Mode failed",
        description: getErrorMessage(error)
      });
    } finally {
      setSaving(null);
    }
  }

  async function revealIdentity() {
    setSaving("REVEAL");
    try {
      const updated = await updateAnonymousRequest(chat.id, "REVEAL");
      if (!updated || updated.status !== "REVEALED") {
        throw new Error("Could not reveal identities.");
      }
      toast({ kind: "success", title: "Identity revealed" });
      sounds.play("safe");
      await onReveal();
    } catch (error) {
      toast({
        kind: "error",
        title: "Reveal failed",
        description: getErrorMessage(error)
      });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/76 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/25 bg-card/86 p-5 shadow-2xl backdrop-blur-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Safe Mode</p>
            <h2 className="mt-1 text-xl font-semibold">How do you feel in this chat?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your choice is private unless you report unsafe behavior.
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close Safe Mode" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <SafetyChoice
            active={status === "SAFE"}
            title="I feel safe"
            description="This conversation feels okay."
            onClick={() => void saveSafety("SAFE")}
            disabled={Boolean(saving)}
          />
          <SafetyChoice
            active={status === "UNSURE"}
            title="I am unsure"
            description="Something feels unclear."
            onClick={() => void saveSafety("UNSURE")}
            disabled={Boolean(saving)}
          />
          <SafetyChoice
            active={status === "UNSAFE"}
            title="I feel unsafe"
            description="I need help or distance."
            onClick={() => void saveSafety("UNSAFE")}
            disabled={Boolean(saving)}
          />
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-medium">Optional note</span>
          <textarea
            className="mt-2 min-h-24 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Add context for yourself or moderators if you report."
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        {status === "UNSAFE" ? (
          <div className="mt-5 rounded-lg border border-destructive/25 bg-destructive/5 p-4">
            <p className="font-medium">Unsafe options</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Reporting sends this conversation to admin review. Blocking prevents further direct contact.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Button disabled={Boolean(saving)} variant="secondary" onClick={() => void saveSafety("UNSAFE", "REPORT")}>
                {saving === "REPORT" ? "Reporting" : "Report"}
              </Button>
              <Button disabled={Boolean(saving)} variant="secondary" onClick={() => void saveSafety("UNSAFE", "BLOCK")}>
                {saving === "BLOCK" ? "Blocking" : "Block"}
              </Button>
              <Button disabled={Boolean(saving)} variant="destructive" onClick={() => void saveSafety("UNSAFE", "END_CONVERSATION")}>
                {saving === "END_CONVERSATION" ? "Ending" : "End Conversation"}
              </Button>
            </div>
          </div>
        ) : null}

        {chat.anonymous && chat.anonymous.status === "ACCEPTED" ? (
          <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="font-medium">Anonymous identity reveal</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {revealEligible
                ? "Both people marked this chat Safe. You can now choose to reveal identities."
                : bothSafe
                  ? "Reveal is almost ready."
                  : "Identity reveal unlocks only after both people mark this chat Safe."}
            </p>
            <Button className="mt-4" disabled={!revealEligible || Boolean(saving)} onClick={() => void revealIdentity()}>
              {saving === "REVEAL" ? "Revealing" : "Reveal identity"}
            </Button>
          </div>
        ) : null}

        {history.length > 0 ? (
          <div className="mt-5 rounded-lg border border-white/20 bg-background/60 p-4">
            <p className="font-medium">Safety history</p>
            <div className="mt-3 space-y-2">
              {history.slice(0, 5).map((event) => (
                <div className="flex items-center justify-between gap-3 text-sm" key={event.id}>
                  <span>{formatSafetyStatus(event.status)}{event.action ? ` - ${formatSafetyAction(event.action)}` : ""}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(event.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function SafetyChoice({
  active,
  title,
  description,
  disabled,
  onClick
}: {
  active: boolean;
  title: string;
  description: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-lg border bg-background p-3 text-left transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60",
        active && "border-primary bg-primary/10"
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="font-medium">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
    </button>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          className={cn("flex", index % 2 === 0 ? "justify-start" : "justify-end")}
          key={index}
        >
          <div className="w-[min(78%,620px)] space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageState({
  icon,
  title,
  description,
  actionLabel,
  onAction
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-sm rounded-2xl border border-dashed border-white/30 bg-card/78 p-6 text-center shadow-xl shadow-black/5 backdrop-blur">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted/70 text-muted-foreground">
          {icon}
        </div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {actionLabel && onAction ? (
          <Button className="mt-4" variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ChatListHeader({ onStartChat }: { onStartChat: () => void }) {
  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/20 px-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">PureChat</h1>
        <p className="text-sm text-muted-foreground">Private, safe, and fast</p>
      </div>
      <div className="flex items-center gap-1">
        <div className="md:hidden">
          <ThemeToggle />
        </div>
        <Button variant="secondary" size="icon" aria-label="Start new chat" onClick={onStartChat}>
          <Plus className="size-5" />
        </Button>
        <AccountMenu />
      </div>
    </header>
  );
}

type UserSearchResult = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
};

function NewChatModal({
  onClose,
  onCreated,
  onStartAnonymous
}: {
  onClose: () => void;
  onCreated: (chat: RealtimeChat) => Promise<void>;
  onStartAnonymous: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingUserId, setStartingUserId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const trimmed = query.trim();
    setError("");

    if (trimmed.length < 2) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.error ?? "Could not search users.");

        setUsers(data.users ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : "Could not search users.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function startChat(userId: string) {
    setStartingUserId(userId);
    setError("");

    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "direct", userId })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error ?? "Could not start chat.");

      await onCreated(data.chat);
    } catch (error) {
      const description = error instanceof Error ? error.message : "Could not start chat.";
      setError(description);
      toast({ kind: "error", title: "Chat not started", description });
    } finally {
      setStartingUserId("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md">
      <div
        className="w-full max-w-lg rounded-2xl border border-white/25 bg-card/95 p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-chat-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold" id="new-chat-title">New chat</h2>
            <p className="text-sm text-muted-foreground">Search by username, email, or phone.</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close new chat" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>

        <label className="mt-4 flex h-12 items-center gap-2 rounded-2xl border bg-background px-4 text-sm">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            className="w-full bg-transparent outline-none"
            placeholder="Search people"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="mt-4">
          <Button className="w-full justify-start gap-2" variant="secondary" onClick={onStartAnonymous}>
            <ShieldCheck className="size-4" />
            Start Anonymous Safe Request
          </Button>
        </div>

        <div className="mt-4 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="flex items-center gap-3 rounded-lg border bg-background p-3" key={index}>
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="rounded-lg border border-destructive/30 bg-background p-4 text-sm text-destructive">{error}</p>
          ) : query.trim().length < 2 ? (
            <p className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
              Type at least 2 characters to search.
            </p>
          ) : users.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
              No matching user found.
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <button
                  className="flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                  key={user.id}
                  type="button"
                  disabled={Boolean(startingUserId)}
                  onClick={() => void startChat(user.id)}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {user.avatarUrl ? <img className="size-full object-cover" src={user.avatarUrl} alt="" /> : user.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{user.displayName}</p>
                    <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                  <span className="text-sm text-primary">
                    {startingUserId === user.id ? "Starting..." : "Start"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
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
    <div className="shrink-0 border-b border-white/20 p-4">
      <label className="flex h-12 items-center gap-2 rounded-2xl border border-white/30 bg-background/72 px-4 text-sm text-muted-foreground shadow-inner shadow-black/5 backdrop-blur focus-within:ring-2 focus-within:ring-ring">
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
        "grid w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:bg-background/58 hover:shadow-lg hover:shadow-black/5",
        active && "border-primary/25 bg-primary/10 shadow-lg shadow-primary/10"
      )}
      onClick={onClick}
    >
      <Avatar initials={chat.initials} accent={chat.accent} online={chat.online} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{chat.name}</p>
          {chat.typing ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary animate-pulse">
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
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20">
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
  onSafeInfo,
  onBack
}: {
  chat: Chat;
  connected: boolean;
  onStartCall: (type: "AUDIO" | "VIDEO") => void;
  onOpenGallery: () => void;
  onOpenGroupDetails: () => void;
  onSafeInfo: () => void;
  onBack: () => void;
}) {
  const anonymousRestricted = Boolean(chat.anonymous && chat.anonymous.status !== "REVEALED");

  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/20 bg-card/78 px-3 shadow-sm backdrop-blur-2xl sm:px-5">
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
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate font-semibold tracking-tight">{chat.name}</h2>
            {anonymousRestricted ? (
              <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                Anonymous Safe Chat
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {chat.online ? (
              <span className="size-2 rounded-full bg-emerald-500" />
            ) : null}
            <p className="truncate">
              {chat.anonymous && chat.anonymous.status !== "REVEALED"
                ? "Anonymous Safe Chat"
                : chat.typing
                  ? "Typing now"
                  : connected
                    ? chat.members
                    : "Connecting"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-2xl border border-white/20 bg-background/46 p-1 shadow-inner shadow-black/5">
        <span title={anonymousRestricted ? "Calls are disabled in anonymous mode for safety." : undefined}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Start audio call"
            disabled={anonymousRestricted}
            onClick={() => onStartCall("AUDIO")}
          >
            <Phone className="size-5" />
          </Button>
        </span>
        <span title={anonymousRestricted ? "Calls are disabled in anonymous mode for safety." : undefined}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Start video call"
            disabled={anonymousRestricted}
            onClick={() => onStartCall("VIDEO")}
          >
            <Video className="size-5" />
          </Button>
        </span>
        <Button className="gap-2 px-3" variant="secondary" aria-label="Open Safe Mode" onClick={onSafeInfo}>
          <ShieldCheck className="size-4" />
          <span className="hidden sm:inline">{formatSafetyStatus(chat.safetyStatus)}</span>
        </Button>
        <span title={anonymousRestricted ? "Media sharing is disabled in anonymous mode for safety." : undefined}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open media gallery"
            disabled={anonymousRestricted}
            onClick={onOpenGallery}
          >
            <ImageIcon className="size-5" />
          </Button>
        </span>
        <span title={anonymousRestricted ? "Profile viewing is disabled in anonymous mode for safety." : undefined}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Group details"
            disabled={anonymousRestricted}
            onClick={onOpenGroupDetails}
          >
            <MoreHorizontal className="size-5" />
          </Button>
        </span>
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
          "flex size-12 items-center justify-center rounded-2xl text-sm font-semibold text-white shadow-lg shadow-black/10 ring-1 ring-white/25",
          accent
        )}
      >
        {initials}
      </div>
      {online ? (
        <span className="absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-card bg-emerald-500 shadow-sm shadow-emerald-500/40" />
      ) : null}
    </div>
  );
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 text-xs text-muted-foreground">
      <div className="h-px flex-1 bg-border/70" />
      <span className="rounded-full border border-white/30 bg-background/70 px-3 py-1 shadow-sm backdrop-blur">{label}</span>
      <div className="h-px flex-1 bg-border/70" />
    </div>
  );
}

function MessageBubble({
  message,
  anonymousRestricted,
  onReact,
  onEdit,
  onDelete,
  onReport,
  onApprove,
  onRetry
}: {
  message: Message;
  anonymousRestricted?: boolean;
  onReact: (emoji: string) => Promise<void>;
  onEdit: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onReport: (reason: string, details?: string) => Promise<void>;
  onApprove: (approved: boolean) => Promise<void>;
  onRetry: () => Promise<unknown>;
}) {
  const isMine = message.sender === "me";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);
  const [busy, setBusy] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [reactionOpen, setReactionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const { toast } = useToast();
  const canManage = isMine && !message.deleted && !message.failed;
  const canReport = !isMine && !message.deleted && !message.failed;
  const canReact = !anonymousRestricted && !message.deleted && !message.failed;

  function clearLongPressTimer() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function openActions() {
    if (message.deleted || message.failed) return;
    setActionsOpen(true);
    setReactionOpen(false);
    setDeleteOpen(false);
  }

  async function react(emoji: string) {
    setBusy(true);
    try {
      await onReact(emoji);
      setReactionOpen(false);
      setActionsOpen(false);
      toast({ kind: "success", title: "Reaction added" });
    } catch (error) {
      toast({
        kind: "error",
        title: "Reaction failed",
        description: getErrorMessage(error)
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteForEveryone() {
    setBusy(true);
    try {
      await onDelete();
      setDeleteOpen(false);
      setActionsOpen(false);
      toast({ kind: "success", title: "Message deleted" });
    } catch (error) {
      toast({
        kind: "error",
        title: "Delete failed",
        description: getErrorMessage(error)
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn("flex animate-in fade-in slide-in-from-bottom-1 duration-200", isMine ? "justify-end" : "justify-start")}
      onContextMenu={(event) => {
        event.preventDefault();
        openActions();
      }}
      onPointerCancel={clearLongPressTimer}
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") return;
        clearLongPressTimer();
        longPressTimer.current = window.setTimeout(openActions, 520);
      }}
      onPointerLeave={clearLongPressTimer}
      onPointerUp={clearLongPressTimer}
    >
      <div
        className={cn(
          "relative max-w-[min(84%,620px)] space-y-1 sm:max-w-[min(76%,620px)]",
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
            "rounded-[1.35rem] px-4 py-3 text-sm leading-6 shadow-lg shadow-black/5 ring-1 ring-white/20 backdrop-blur",
            message.deleted && "italic opacity-70",
            isMine
              ? "rounded-br-md bg-primary text-primary-foreground shadow-primary/10"
              : "rounded-bl-md border border-white/30 bg-card/78"
          )}
        >
          {editing ? (
            <form
              className="flex gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!draft.trim()) {
                  toast({ kind: "error", title: "Message cannot be empty" });
                  return;
                }
                setBusy(true);
                try {
                  await onEdit(draft);
                  setEditing(false);
                  toast({ kind: "success", title: "Message updated" });
                } catch (error) {
                  toast({
                    kind: "error",
                    title: "Edit failed",
                    description: getErrorMessage(error)
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <input
                className="min-w-0 flex-1 rounded-md border bg-background px-2 text-foreground outline-none"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button className="font-medium disabled:opacity-60" disabled={busy} type="submit">
                {busy ? "Saving" : "Save"}
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
            {message.reactions.map((reaction, index) => (
              <span key={`${reaction}-${index}`} className="rounded-full border border-white/30 bg-background/80 px-2 py-0.5 text-xs shadow-sm backdrop-blur">
                {reaction}
              </span>
            ))}
          </div>
        ) : null}
        {message.pendingApproval ? (
          <div className="rounded-xl border border-white/30 bg-background/70 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
            Waiting for admin approval
          </div>
        ) : null}
        {message.failed ? (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive shadow-sm">
            <span>{message.error ?? "Message failed to send."}</span>
            <button
              className="font-semibold underline-offset-2 hover:underline disabled:opacity-60"
              disabled={busy}
              type="button"
              onClick={async () => {
                setBusy(true);
                try {
                  await onRetry();
                  toast({ kind: "success", title: "Message sent" });
                } catch (error) {
                  toast({
                    kind: "error",
                    title: "Retry failed",
                    description: getErrorMessage(error)
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Retry
            </button>
          </div>
        ) : null}
        {reactionOpen ? (
          <ReactionPicker
            busy={busy}
            onPick={(emoji) => void react(emoji)}
          />
        ) : null}
        {actionsOpen ? (
          <MessageActionMenu
            busy={busy}
            canReact={canReact}
            canManage={canManage}
            canReport={canReport}
            onClose={() => setActionsOpen(false)}
            onReact={() => {
              setReactionOpen(true);
              setActionsOpen(false);
            }}
            onEdit={() => {
              setEditing(true);
              setActionsOpen(false);
            }}
            onDelete={() => {
              setDeleteOpen(true);
              setActionsOpen(false);
            }}
            onReport={() => {
              setReportOpen(true);
              setActionsOpen(false);
            }}
          />
        ) : null}
        {deleteOpen ? (
          <DeleteMessageMenu
            busy={busy}
            onDeleteForEveryone={() => void deleteForEveryone()}
            onDeleteForMe={() => {
              toast({
                kind: "info",
                title: "Coming soon",
                description: "Delete for me needs per-user message hiding and will be added with a database migration."
              });
              setDeleteOpen(false);
            }}
            onClose={() => setDeleteOpen(false)}
          />
        ) : null}
        {reportOpen ? (
          <ReportMessageModal
            busy={busy}
            onClose={() => setReportOpen(false)}
            onSubmit={async (reason, details) => {
              setBusy(true);
              try {
                await onReport(reason, details);
                setReportOpen(false);
                toast({ kind: "success", title: "Report sent" });
              } catch (error) {
                toast({
                  kind: "error",
                  title: "Report failed",
                  description: getErrorMessage(error)
                });
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground",
            isMine ? "justify-end" : "justify-start"
          )}
        >
          <span>{message.time}</span>
          {message.edited ? <span>edited</span> : null}
          {isMine && message.status ? (
            <CheckCheck
              className={cn(
                "size-3.5",
                message.status === "read" ? "text-primary" : message.status === "failed" ? "text-destructive" : "text-muted-foreground"
              )}
            />
          ) : null}
          {!message.deleted && !message.failed ? (
            <>
              {canReact ? (
                <button className="transition hover:text-primary disabled:opacity-60" disabled={busy} onClick={() => setReactionOpen((value) => !value)} type="button">
                  {busy ? "Working" : "React"}
                </button>
              ) : null}
              {canManage ? (
                <>
                  <button className="transition hover:text-primary" disabled={busy} onClick={() => setEditing(true)} type="button">
                    Edit
                  </button>
                  <button className="transition hover:text-destructive" disabled={busy} onClick={() => setDeleteOpen(true)} type="button">
                    Delete
                  </button>
                </>
              ) : null}
              {canReport ? (
                <button className="transition hover:text-destructive" disabled={busy} onClick={() => setReportOpen(true)} type="button">
                  Report
                </button>
              ) : null}
              {message.pendingApproval ? (
                <>
                  <button disabled={busy} onClick={() => void onApprove(true)} type="button">
                    Approve
                  </button>
                  <button disabled={busy} onClick={() => void onApprove(false)} type="button">
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

const QUICK_REACTIONS = ["\uD83D\uDC9A", "\uD83D\uDC4D", "\uD83D\uDE02", "\uD83D\uDE2E", "\uD83D\uDE22", "\uD83D\uDE4F"];

function ReactionPicker({
  busy,
  onPick
}: {
  busy: boolean;
  onPick: (emoji: string) => void;
}) {
  return (
    <div className="flex w-fit gap-1 rounded-full border border-white/30 bg-background/95 p-1 shadow-xl shadow-black/10 backdrop-blur">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          className="flex size-9 items-center justify-center rounded-full text-lg transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          disabled={busy}
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

function MessageActionMenu({
  busy,
  canReact,
  canManage,
  canReport,
  onClose,
  onReact,
  onEdit,
  onDelete,
  onReport
}: {
  busy: boolean;
  canReact: boolean;
  canManage: boolean;
  canReport: boolean;
  onClose: () => void;
  onReact: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  return (
    <div className="absolute bottom-full z-20 mb-2 min-w-48 rounded-2xl border border-white/30 bg-background/95 p-1 text-sm shadow-2xl shadow-black/15 backdrop-blur">
      {canReact ? (
        <button className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-muted" disabled={busy} type="button" onClick={onReact}>
          React
        </button>
      ) : null}
      {canManage ? (
        <>
          <button className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-muted" disabled={busy} type="button" onClick={onEdit}>
            Edit
          </button>
          <button className="w-full rounded-xl px-3 py-2 text-left text-destructive transition hover:bg-destructive/10" disabled={busy} type="button" onClick={onDelete}>
            Delete
          </button>
        </>
      ) : null}
      {canReport ? (
        <button className="w-full rounded-xl px-3 py-2 text-left text-destructive transition hover:bg-destructive/10" disabled={busy} type="button" onClick={onReport}>
          Report
        </button>
      ) : null}
      <button className="w-full rounded-xl px-3 py-2 text-left text-muted-foreground transition hover:bg-muted" type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

function DeleteMessageMenu({
  busy,
  onDeleteForEveryone,
  onDeleteForMe,
  onClose
}: {
  busy: boolean;
  onDeleteForEveryone: () => void;
  onDeleteForMe: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-full z-20 mb-2 w-64 rounded-2xl border border-white/30 bg-background/95 p-3 text-sm shadow-2xl shadow-black/15 backdrop-blur">
      <p className="mb-2 font-medium">Delete message</p>
      <div className="space-y-1">
        <button
          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-muted"
          disabled={busy}
          type="button"
          onClick={onDeleteForMe}
        >
          <span>Delete for me</span>
          <span className="text-xs text-muted-foreground">Soon</span>
        </button>
        <button
          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
          disabled={busy}
          type="button"
          onClick={onDeleteForEveryone}
        >
          <span>Delete for everyone</span>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        </button>
      </div>
      <Button className="mt-2 w-full" variant="ghost" size="sm" onClick={onClose}>
        Cancel
      </Button>
    </div>
  );
}

function ReportMessageModal({
  busy,
  onClose,
  onSubmit
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details?: string) => Promise<void>;
}) {
  const reasons = [
    "Harassment or bullying",
    "Scam or spam",
    "Adult or unsafe content",
    "Hate or abusive language",
    "Other safety concern"
  ];
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-background/70 p-3 backdrop-blur sm:items-center sm:justify-center">
      <form
        className="w-full rounded-2xl border border-white/30 bg-card p-4 shadow-2xl shadow-black/20 sm:max-w-md"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(reason, details.trim() || undefined);
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Report message</h2>
            <p className="mt-1 text-sm text-muted-foreground">Reports go to PureChat admins for review.</p>
          </div>
          <Button variant="ghost" size="icon" type="button" aria-label="Close report" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {reasons.map((item) => (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/20 bg-background/60 px-3 py-2 text-sm" key={item}>
              <input
                className="accent-primary"
                type="radio"
                name="report-reason"
                checked={reason === item}
                onChange={() => setReason(item)}
              />
              <span>{item}</span>
            </label>
          ))}
        </div>

        <label className="mt-4 block text-sm">
          <span className="font-medium">Details</span>
          <textarea
            className="mt-2 min-h-24 w-full resize-none rounded-xl border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            maxLength={1000}
            placeholder="Add a short note for the moderation team."
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
        </label>

        <div className="mt-4 flex gap-2">
          <Button className="flex-1" variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" type="submit" disabled={busy}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Send report
          </Button>
        </div>
      </form>
    </div>
  );
}

function TypingIndicator({ chat }: { chat: Chat }) {
  if (!chat.typing) return null;

  return (
    <div className="flex items-center gap-3">
      <Avatar initials={chat.initials} accent={chat.accent} online={chat.online} />
      <div className="rounded-2xl rounded-bl-md border border-white/30 bg-card/80 px-4 py-3 shadow-lg shadow-black/5 backdrop-blur">
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
  onSendSticker,
  textOnly = false
}: {
  chatName: string;
  onSend: (body: string) => Promise<unknown>;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onSendAttachment: (
    file: File,
    kind: "image" | "video" | "document" | "audio" | "voice",
    caption?: string
  ) => Promise<void>;
  onSendGif: (gifUrl: string, title?: string) => Promise<void>;
  onSendSticker: (stickerId: string) => Promise<void>;
  textOnly?: boolean;
}) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKindOverride, setFileKindOverride] = useState<"voice" | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [panel, setPanel] = useState<"emoji" | "gif" | "sticker" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [gifSending, setGifSending] = useState(false);
  const [stickerSending, setStickerSending] = useState(false);
  const { toast } = useToast();
  const sounds = useSoundSystem();

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
    if (uploading || sending) return;
    if (!file && !body.trim()) {
      toast({
        kind: "info",
        title: "Message is empty",
        description: "Write a message before sending."
      });
      return;
    }

    if (file) {
      setUploading(true);
      try {
        await onSendAttachment(file, fileKindOverride ?? detectAttachmentKind(file), body);
        sounds.play("messageSent");
        setFile(null);
        setFileKindOverride(null);
        toast({ kind: "success", title: "File sent" });
      } catch (error) {
        toast({
          kind: "error",
          title: "Upload failed",
          description: error instanceof Error ? error.message : "Please try again."
        });
        return;
      } finally {
        setUploading(false);
      }
    } else {
      const nextBody = body;
      setBody("");
      onTypingStop();
      setSending(true);
      try {
        await onSend(nextBody);
        sounds.play("messageSent");
      } catch (error) {
        toast({
          kind: "error",
          title: "Message failed",
          description: `${getErrorMessage(error)} Use Retry on the message.`
        });
      } finally {
        setSending(false);
      }
      return;
    }
    setBody("");
    onTypingStop();
  }

  function blockedInAnonymous(tool: string) {
    toast({
      kind: "info",
      title: `${tool} disabled`,
      description: "Anonymous Safe Chat allows text only for now."
    });
  }

  function pickFile(nextFile?: File | null) {
    if (textOnly) {
      blockedInAnonymous("Media");
      return;
    }
    if (!nextFile) return;

    const result = validateComposerFile(nextFile);
    if (!result.ok) {
      toast({
        kind: result.comingSoon ? "info" : "error",
        title: result.comingSoon ? "Coming soon" : "File not allowed",
        description: result.error
      });
      return;
    }

    setPanel(null);
    setFile(nextFile);
    setFileKindOverride(null);
  }

  return (
    <footer className="shrink-0 border-t border-white/20 bg-card/78 px-3 py-3 shadow-[0_-12px_40px_rgba(0,0,0,0.06)] backdrop-blur-2xl sm:px-5">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/20 bg-background/48 p-1 shadow-inner shadow-black/5">
          <input
            id="chat-file-input"
            className="hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => {
              pickFile(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
          <input
            id="chat-voice-input"
            className="hidden"
            type="file"
            accept="audio/*"
            onChange={(event) => {
              if (textOnly) {
                blockedInAnonymous("Voice messages");
              } else {
                toast({
                  kind: "info",
                  title: "Coming soon",
                  description: "Voice message upload will be enabled after recording tools are connected."
                });
              }
              event.currentTarget.value = "";
            }}
          />
          <Button asChild variant="ghost" size="icon" aria-label="Attach image" title={textOnly ? "Media sharing is disabled in anonymous mode for safety." : "Attach image"}>
            <label htmlFor="chat-file-input">
            <Paperclip className="size-5" />
            </label>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Add emoji" onClick={() => setPanel(panel === "emoji" ? null : "emoji")}>
            <Smile className="size-5" />
          </Button>
          <span title={textOnly ? "GIFs are disabled in anonymous mode for safety." : undefined}>
            <Button variant="ghost" size="icon" aria-label="Send GIF" onClick={() => textOnly ? blockedInAnonymous("GIFs") : setPanel(panel === "gif" ? null : "gif")}>
              <Gift className="size-5" />
            </Button>
          </span>
          <span title={textOnly ? "Stickers are disabled in anonymous mode for safety." : undefined}>
            <Button variant="ghost" size="icon" aria-label="Send sticker" onClick={() => textOnly ? blockedInAnonymous("Stickers") : setPanel(panel === "sticker" ? null : "sticker")}>
              <Sticker className="size-5" />
            </Button>
          </span>
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
            <EmojiPanel onPick={(emoji) => {
              setBody((value) => `${value}${emoji}`);
              onTypingStart();
            }} />
          ) : null}
          {panel === "gif" ? (
            <GifPanel
              sending={gifSending}
              onSend={(gif) => {
                setGifSending(true);
                void onSendGif(gif.url, gif.title)
                  .then(() => {
                    setPanel(null);
                    toast({ kind: "success", title: "GIF sent" });
                  })
                  .catch((error) => {
                    toast({
                      kind: "error",
                      title: "GIF failed",
                      description: getErrorMessage(error)
                    });
                  })
                  .finally(() => {
                    setGifSending(false);
                  });
              }}
            />
          ) : null}
          {panel === "sticker" ? (
            <StickerPanel
              sending={stickerSending}
              onSend={(stickerId) => {
                setStickerSending(true);
                void onSendSticker(stickerId)
                  .then(() => {
                    setPanel(null);
                    toast({ kind: "success", title: "Sticker sent" });
                  })
                  .catch((error) => {
                    toast({
                      kind: "error",
                      title: "Sticker failed",
                      description: getErrorMessage(error)
                    });
                  })
                  .finally(() => {
                    setStickerSending(false);
                  });
              }}
            />
          ) : null}
          <div className="flex min-w-0 items-end gap-2">
          <div className="flex min-h-12 flex-1 items-center rounded-2xl border border-white/30 bg-background/78 px-4 shadow-inner shadow-black/5 backdrop-blur focus-within:ring-2 focus-within:ring-ring">
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
                  void submit();
                }
              }}
            />
          </div>

          <Button className="rounded-2xl" variant="ghost" size="icon" aria-label="Record voice message" title={textOnly ? "Voice messages are disabled in anonymous mode for safety." : "Voice messages are coming soon"}>
            <label htmlFor="chat-voice-input">
              <Mic className="size-5" />
            </label>
          </Button>
          <Button className="rounded-2xl shadow-lg shadow-primary/20" size="icon" aria-label={uploading || sending ? "Sending" : "Send message"} disabled={uploading || sending} onClick={() => void submit()}>
            {uploading || sending ? <Loader2 className="size-5 animate-spin" /> : <SendHorizontal className="size-5" />}
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
  const metadata = message.metadata && typeof message.metadata === "object"
    ? message.metadata
    : null;
  const failed = message.status === "FAILED" || Boolean(metadata?.failed);
  const optimistic = Boolean(metadata?.optimistic) && !failed;

  return {
    id: message.id,
    originalId: message.id,
    senderId: message.senderId,
    sender: isMine ? "me" : "them",
    author: isMine ? undefined : message.sender?.displayName,
    text: message.deletedAt ? "This message was deleted." : message.body ?? "",
    time: formatMessageTime(message.createdAt),
    status: failed ? "failed" : optimistic ? "sending" : readByOther ? "read" : "sent",
    failed,
    error: typeof metadata?.error === "string" ? metadata.error : undefined,
    edited: Boolean(message.editedAt),
    deleted: Boolean(message.deletedAt),
    pendingApproval: message.status === "PENDING_APPROVAL",
    reactions: message.reactions?.map((reaction) => reaction.emoji)
      .map((emoji) => emoji === ":heart:" ? "heart" : emoji),
    attachments: message.attachments,
    gifUrl: metadata && "gifUrl" in metadata
      ? String(metadata.gifUrl)
      : undefined,
    stickerUrl: metadata && "storageKey" in metadata
      ? String(metadata.storageKey).startsWith("data:")
        ? String(metadata.storageKey)
        : `/api/files/${String(metadata.storageKey)}`
      : undefined
  };
}

async function reportMessage(chatId: string, message: Message, reason: string, details?: string) {
  const response = await fetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "MESSAGE",
      chatId,
      messageId: message.originalId,
      ...(message.senderId ? { reportedUserId: message.senderId } : {}),
      reason,
      details
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? "Could not send report.");
  }
}

async function reviewPendingMessage(chatId: string, messageId: string, approved: boolean) {
  const response = await fetch(`/api/groups/${chatId}/messages/${messageId}/approval`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? "Could not review message.");
  }
}

async function updateAnonymousRequest(
  chatId: string,
  action: "ACCEPT" | "REJECT" | "REPORT" | "BLOCK" | "REVEAL",
  note?: string
) {
  const response = await fetch(`/api/chats/${chatId}/anonymous`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, note })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? "Could not update anonymous request.");
  }
  return data.anonymous as Chat["anonymous"] | undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Please try again.";
}

function detectAttachmentKind(file: File) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

function validateComposerFile(file: File): { ok: true } | { ok: false; error: string; comingSoon?: boolean } {
  const supportedImages = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const maxImageBytes = 12 * 1024 * 1024;

  if (!file.type.startsWith("image/")) {
    return {
      ok: false,
      comingSoon: true,
      error: "Image upload is ready now. Documents, audio, and video are coming soon."
    };
  }

  if (!supportedImages.has(file.type)) {
    return {
      ok: false,
      error: "Use a JPG, PNG, WebP, or GIF image."
    };
  }

  if (file.size > maxImageBytes) {
    return {
      ok: false,
      error: "Image must be 12 MB or smaller."
    };
  }

  return { ok: true };
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
    <div className="flex items-center gap-3 rounded-2xl border border-white/30 bg-background/76 p-2 shadow-lg shadow-black/5 backdrop-blur">
      {previewUrl && file.type.startsWith("image/") ? (
        <img className="size-14 rounded-xl object-cover" src={previewUrl} alt="" />
      ) : (
        <div className="flex size-14 items-center justify-center rounded-xl bg-muted/70">
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
        <img className="max-h-80 rounded-2xl object-cover" src={fileUrl} alt={attachment.fileName} />
        <p className="text-xs opacity-80">{attachment.fileName}</p>
      </div>
    );
  }

  if (attachment.mimeType.startsWith("video/")) {
    return (
      <div className="space-y-2">
        <video className="max-h-80 rounded-2xl" controls src={fileUrl} />
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
    <a className="flex items-center gap-3 rounded-2xl border border-white/30 bg-background/80 p-3 shadow-sm backdrop-blur transition hover:bg-muted" href={fileUrl} target="_blank" rel="noreferrer">
      <div className="flex size-10 items-center justify-center rounded-xl bg-muted/70">
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
  const emojis = [
    "\uD83D\uDE42", "\uD83D\uDE0A", "\uD83D\uDE04", "\uD83D\uDE02", "\uD83E\uDD32", "\uD83C\uDF19", "\u2B50", "\u2728",
    "\u2764\uFE0F", "\uD83D\uDC9A", "\uD83D\uDC4D", "\uD83D\uDC4F", "\uD83D\uDE4F", "\u2705", "\uD83C\uDF89", "\u2615",
    "\uD83D\uDCCC", "\uD83D\uDCCE", "\uD83D\uDCDA", "\uD83D\uDD4C", "\uD83C\uDF3F", "\uD83D\uDCAC", "\uD83D\uDD12", "\uD83D\uDEE1\uFE0F"
  ];

  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-white/30 bg-background/78 p-2 shadow-lg shadow-black/5 backdrop-blur">
      {emojis.map((emoji) => (
        <button className="rounded-xl px-2 py-1 text-lg transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" key={emoji} onClick={() => onPick(emoji)} type="button">
          {emoji}
        </button>
      ))}
    </div>
  );
}

function GifPanel({
  sending,
  onSend
}: {
  sending: boolean;
  onSend: (gif: { url: string; title: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Array<{ title: string; url: string; previewUrl?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadGifs() {
      setLoading(true);
      try {
        const response = await fetch(`/api/gifs/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setGifs(data.gifs);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadGifs();

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="space-y-2 rounded-2xl border border-white/30 bg-background/78 p-2 shadow-lg shadow-black/5 backdrop-blur">
      <input
        className="h-10 w-full rounded-xl border border-white/30 bg-background/80 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        placeholder="Search GIFs"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton className="h-28 rounded-xl" key={index} />
          ))
        ) : gifs.length === 0 ? (
          <p className="col-span-full px-2 py-3 text-sm text-muted-foreground">No GIFs found</p>
        ) : (
          gifs.map((gif) => (
            <button className="overflow-hidden rounded-xl border border-white/30 bg-card/70 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60" disabled={sending} key={gif.url} onClick={() => onSend(gif)} type="button">
              <img className="h-24 w-full object-cover" src={gif.previewUrl ?? gif.url} alt={gif.title} />
              <span className="flex items-center justify-between gap-2 px-2 py-1 text-xs">
                <span className="truncate">{gif.title}</span>
                {sending ? <Loader2 className="size-3 animate-spin" /> : null}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function StickerPanel({
  sending,
  onSend
}: {
  sending: boolean;
  onSend: (stickerId: string) => void;
}) {
  const [stickers, setStickers] = useState<Array<{ id: string; name: string; storageKey: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStickers() {
      setLoading(true);
      try {
        const response = await fetch("/api/stickers");
        if (!response.ok) return;
        const data = await response.json();
        const nextStickers = data.packs.flatMap(
          (pack: { stickers: Array<{ id: string; name: string; storageKey: string }> }) =>
            pack.stickers
        );
        if (!cancelled) setStickers(nextStickers);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadStickers();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/30 bg-background/78 p-2 shadow-lg shadow-black/5 backdrop-blur">
      {loading ? (
        Array.from({ length: 4 }).map((_, index) => (
          <Skeleton className="size-16 rounded-xl" key={index} />
        ))
      ) : stickers.length === 0 ? (
        <p className="px-2 py-1 text-sm text-muted-foreground">No stickers yet</p>
      ) : (
        stickers.map((sticker) => (
          <button className="rounded-xl border border-white/30 bg-card/70 p-2 text-sm transition hover:-translate-y-0.5 hover:bg-muted disabled:opacity-60" disabled={sending} key={sticker.id} onClick={() => onSend(sticker.id)} type="button">
            <img className="size-14 object-contain" src={sticker.storageKey.startsWith("data:") ? sticker.storageKey : `/api/files/${sticker.storageKey}`} alt={sticker.name} />
          </button>
        ))
      )}
    </div>
  );
}
function MediaGallery({ messages }: { messages: Message[] }) {
  const attachments = messages.flatMap((message) => message.attachments ?? []);

  return (
    <aside className="hidden w-80 shrink-0 border-l border-white/20 bg-card/78 p-4 shadow-xl shadow-black/5 backdrop-blur-2xl xl:block">
      <h2 className="font-semibold">Media</h2>
      <p className="mb-4 text-sm text-muted-foreground">Shared files in this chat</p>
      {attachments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/30 bg-background/70 p-5 text-center shadow-sm backdrop-blur">
          <ImageIcon className="mx-auto mb-3 size-6 text-muted-foreground" />
          <p className="text-sm font-medium">No shared media yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Images, documents, audio, and videos will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {attachments.map((attachment) => (
            <a className="rounded-2xl border border-white/30 bg-background/70 p-3 shadow-sm transition hover:-translate-y-0.5 hover:bg-muted" href={`/api/files/${attachment.storageKey}`} key={attachment.id} target="_blank" rel="noreferrer">
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

function formatSafetyStatus(status: Chat["safetyStatus"]) {
  if (status === "UNSAFE") return "Unsafe";
  if (status === "UNSURE") return "Unsure";
  return "Safe";
}

function formatSafetyAction(action: string) {
  if (action === "END_CONVERSATION") return "Ended conversation";
  if (action === "REPORT") return "Reported";
  if (action === "BLOCK") return "Blocked";
  return action.toLowerCase();
}

function isRecentlyOnline(value?: string | Date | null) {
  if (!value) return false;
  return Date.now() - new Date(value).getTime() < 90_000;
}
