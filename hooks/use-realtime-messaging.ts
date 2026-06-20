"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { socketEvents } from "@/server/socket/events";

export type RealtimeChat = {
  id: string;
  type: "DIRECT" | "GROUP" | "SAVED";
  title: string;
  initials: string;
  avatarUrl?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string | Date | null;
  unreadCount: number;
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
  members: Array<{
    userId: string;
    displayName: string;
    username: string;
    avatarUrl?: string | null;
    lastSeenAt?: string | Date | null;
    online?: boolean;
  }>;
};

export type RealtimeMessage = {
  id: string;
  chatId: string;
  senderId?: string | null;
  body?: string | null;
  status: "PENDING_APPROVAL" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "DELETED";
  metadata?: Record<string, unknown> | null;
  createdAt: string | Date;
  editedAt?: string | Date | null;
  deletedAt?: string | Date | null;
  sender?: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string | null;
  } | null;
  reactions?: Array<{
    id: string;
    emoji: string;
    userId: string;
  }>;
  attachments?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    fileType: string;
    sizeBytes: string;
    storageKey: string;
    thumbnailKey?: string | null;
    width?: number | null;
    height?: number | null;
    durationSeconds?: number | null;
  }>;
  readReceipts?: Array<{
    userId: string;
    deliveredAt?: string | Date | null;
    readAt?: string | Date | null;
  }>;
};

type CurrentUser = {
  id: string;
  displayName: string;
  username: string;
};

export function useRealtimeMessaging() {
  const socketRef = useRef<Socket | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [chats, setChats] = useState<RealtimeChat[]>([]);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, RealtimeMessage[]>>({});
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessagesByChat, setLoadingMessagesByChat] = useState<Record<string, boolean>>({});
  const [messageErrorsByChat, setMessageErrorsByChat] = useState<Record<string, string>>({});
  const [typingByChat, setTypingByChat] = useState<Record<string, string[]>>({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  const activeChatIds = useMemo(() => chats.map((chat) => chat.id), [chats]);

  const refreshChats = useCallback(async () => {
    const chatsResponse = await fetch("/api/chats");
    const chatsData = await chatsResponse.json();
    if (!chatsResponse.ok) {
      throw new Error(chatsData.error ?? "Could not load chats.");
    }
    setChats(chatsData.chats);
    return chatsData.chats as RealtimeChat[];
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    setLoadingMessagesByChat((current) => ({ ...current, [chatId]: true }));
    setMessageErrorsByChat((current) => ({ ...current, [chatId]: "" }));

    try {
      const response = await fetch(`/api/chats/${chatId}/messages`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not load messages.");
      }
      setMessagesByChat((current) => ({
        ...current,
        [chatId]: data.messages
      }));
    } catch (error) {
      setMessageErrorsByChat((current) => ({
        ...current,
        [chatId]: error instanceof Error ? error.message : "Could not load messages."
      }));
    } finally {
      setLoadingMessagesByChat((current) => ({ ...current, [chatId]: false }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoadingChats(true);
      setError("");

      try {
        const meResponse = await fetch("/api/auth/me");
        const meData = await meResponse.json();
        if (!meResponse.ok) {
          throw new Error(meData.error ?? "Sign in to use chat.");
        }

        if (cancelled) return;
        setCurrentUser(meData.user);

        if (cancelled) return;
        const nextChats = await refreshChats();

        await Promise.all(
          nextChats.slice(0, 5).map((chat: RealtimeChat) => loadMessages(chat.id))
        );
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : "Could not load chats.");
        }
      } finally {
        if (!cancelled) {
          setLoadingChats(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [loadMessages, refreshChats]);

  useEffect(() => {
    if (!currentUser) return;

    const socket = io({
      path: process.env.NEXT_PUBLIC_SOCKET_IO_PATH ?? "/api/socket",
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 8000
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      activeChatIds.forEach((chatId) => {
        socket.emit(socketEvents.conversationJoin, { chatId });
      });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on(socketEvents.messageNew, ({ message }) => {
      appendMessage(message);
      updateChatPreview(message, message.senderId !== currentUser.id);

      if (message.senderId !== currentUser.id) {
        socket.emit(socketEvents.messageDelivered, {
          chatId: message.chatId,
          messageId: message.id
        });
      }
    });

    socket.on(socketEvents.messageUpdated, ({ message }) => {
      replaceMessage(message);
    });

    socket.on(socketEvents.messageDeleted, ({ message }) => {
      replaceMessage(message);
    });

    socket.on(socketEvents.reactionUpdated, ({ message }) => {
      replaceMessage(message);
    });

    socket.on(socketEvents.messageDelivered, ({ chatId, messageId, userId, deliveredAt }) => {
      updateReceipt(chatId, messageId, userId, { deliveredAt });
    });

    socket.on(socketEvents.messageRead, ({ chatId, messageId, userId, readAt }) => {
      updateReceipt(chatId, messageId, userId, { readAt, deliveredAt: readAt });
    });

    socket.on(socketEvents.typingUpdate, ({ chatId, userId, isTyping }) => {
      if (userId === currentUser.id) return;
      setTypingByChat((current) => {
        const users = new Set(current[chatId] ?? []);
        if (isTyping) users.add(userId);
        else users.delete(userId);
        return { ...current, [chatId]: Array.from(users) };
      });
    });

    socket.on(socketEvents.userOnline, ({ userId }) => {
      setOnlineUserIds((current) => new Set(current).add(userId));
    });

    socket.on(socketEvents.userOffline, ({ userId }) => {
      setOnlineUserIds((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeChatIds, currentUser]);

  function appendMessage(message: RealtimeMessage) {
    setMessagesByChat((current) => {
      const existing = current[message.chatId] ?? [];
      const clientId = getClientId(message);
      if (existing.some((item) => item.id === message.id || (clientId && getClientId(item) === clientId))) return current;

      return {
        ...current,
        [message.chatId]: [...existing, message]
      };
    });
  }

  function replaceMessage(message: RealtimeMessage) {
    setMessagesByChat((current) => ({
      ...current,
      [message.chatId]: (current[message.chatId] ?? []).map((item) => {
        const incomingClientId = getClientId(message);
        if (item.id === message.id || (incomingClientId && getClientId(item) === incomingClientId)) {
          return message;
        }
        return item;
      })
    }));
    updateChatPreview(message);
  }

  function markOptimisticFailed(chatId: string, clientId: string, error: string) {
    setMessagesByChat((current) => ({
      ...current,
      [chatId]: (current[chatId] ?? []).map((message) =>
        getClientId(message) === clientId
          ? {
              ...message,
              status: "FAILED",
              metadata: {
                ...(message.metadata ?? {}),
                failed: true,
                error
              }
            }
          : message
      )
    }));
  }

  function createOptimisticMessage(chatId: string, body: string, clientId: string): RealtimeMessage {
    return {
      id: `local-${clientId}`,
      chatId,
      senderId: currentUser?.id,
      body,
      status: "SENT",
      metadata: {
        clientId,
        optimistic: true
      },
      createdAt: new Date().toISOString(),
      sender: currentUser
        ? {
            id: currentUser.id,
            displayName: currentUser.displayName,
            username: currentUser.username
          }
        : null,
      reactions: [],
      attachments: [],
      readReceipts: currentUser
        ? [{
            userId: currentUser.id,
            deliveredAt: new Date().toISOString(),
            readAt: new Date().toISOString()
          }]
        : []
    };
  }

  function updateChatPreview(message: RealtimeMessage, incrementUnread = false) {
    setChats((current) => {
      const nextChats = current.map((chat) =>
        chat.id === message.chatId
          ? {
              ...chat,
              lastMessage: getMessagePreview(message),
              lastMessageAt: message.createdAt,
              unreadCount: incrementUnread ? chat.unreadCount + 1 : chat.unreadCount
            }
          : chat
      );

      return nextChats.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
    });
  }

  function updateReceipt(
    chatId: string,
    messageId: string,
    userId: string,
    receipt: { deliveredAt?: string; readAt?: string }
  ) {
    setMessagesByChat((current) => ({
      ...current,
      [chatId]: (current[chatId] ?? []).map((message) => {
        if (message.id !== messageId) return message;
        const receipts = message.readReceipts ?? [];
        const found = receipts.some((item) => item.userId === userId);
        return {
          ...message,
          readReceipts: found
            ? receipts.map((item) =>
                item.userId === userId ? { ...item, ...receipt } : item
              )
            : [...receipts, { userId, ...receipt }]
        };
      })
    }));
  }

  const emitWithAck = useCallback(<T,>(event: string, payload: unknown) => {
    return new Promise<T>((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        reject(new Error("Chat connection is still reconnecting."));
        return;
      }

      socket.timeout(8000).emit(event, payload, (error: Error | null, result: { ok?: boolean; error?: string } & T) => {
        if (error) {
          reject(new Error("Chat request timed out."));
          return;
        }
        if (!result?.ok) {
          reject(new Error(result?.error ?? "Chat request failed."));
          return;
        }
        resolve(result);
      });
    });
  }, []);

  const sendViaApi = useCallback(async (chatId: string, body: string, clientId: string) => {
    const response = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, clientId })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Could not send message.");
    }

    return data.message as RealtimeMessage;
  }, []);

  const sendMessage = useCallback(async (chatId: string, body: string, options?: { clientId?: string; optimistic?: boolean }) => {
    const trimmed = body.trim();
    if (!trimmed) throw new Error("Message cannot be empty.");
    const clientId = options?.clientId ?? crypto.randomUUID();

    if (options?.optimistic !== false) {
      const optimistic = createOptimisticMessage(chatId, trimmed, clientId);
      appendMessage(optimistic);
      updateChatPreview(optimistic);
    }

    try {
      let message: RealtimeMessage;
      const socketReady = socketRef.current?.connected;

      if (socketReady) {
        const result = await emitWithAck<{ message: RealtimeMessage }>(socketEvents.messageSend, {
          chatId,
          body: trimmed,
          clientId
        });
        message = result.message;
      } else {
        message = await sendViaApi(chatId, trimmed, clientId);
      }

      replaceMessage(message);
      void refreshChats();
      return message;
    } catch (error) {
      try {
        const message = await sendViaApi(chatId, trimmed, clientId);
        replaceMessage(message);
        void refreshChats();
        return message;
      } catch (fallbackError) {
        const message = fallbackError instanceof Error ? fallbackError.message : "Could not send message.";
        markOptimisticFailed(chatId, clientId, message);
        throw fallbackError;
      }
    }
  }, [emitWithAck, currentUser, sendViaApi, refreshChats]);

  const retryMessage = useCallback(async (chatId: string, messageId: string) => {
    const message = messagesByChat[chatId]?.find((item) => item.id === messageId);
    if (!message?.body?.trim()) throw new Error("Message cannot be retried.");
    const clientId = getClientId(message) ?? crypto.randomUUID();
    return sendMessage(chatId, message.body, { clientId, optimistic: false });
  }, [messagesByChat, sendMessage]);

  const markRead = useCallback((chatId: string, messageId: string) => {
    socketRef.current?.emit(socketEvents.messageRead, { chatId, messageId });
    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
      )
    );
  }, []);

  const startTyping = useCallback((chatId: string) => {
    socketRef.current?.emit(socketEvents.typingStart, { chatId });
  }, []);

  const stopTyping = useCallback((chatId: string) => {
    socketRef.current?.emit(socketEvents.typingStop, { chatId });
  }, []);

  const editMessage = useCallback(async (chatId: string, messageId: string, body: string) => {
    const trimmed = body.trim();
    if (!trimmed) throw new Error("Message cannot be empty.");
    try {
      const result = await emitWithAck<{ message: RealtimeMessage }>(socketEvents.messageEdit, { chatId, messageId, body: trimmed });
      replaceMessage(result.message);
      return result.message;
    } catch {
      const response = await fetch(`/api/chats/${chatId}/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not edit message.");
      replaceMessage(data.message);
      return data.message as RealtimeMessage;
    }
  }, [emitWithAck]);

  const deleteMessage = useCallback(async (chatId: string, messageId: string) => {
    try {
      const result = await emitWithAck<{ message: RealtimeMessage }>(socketEvents.messageDelete, { chatId, messageId });
      replaceMessage(result.message);
      return result.message;
    } catch {
      const response = await fetch(`/api/chats/${chatId}/messages/${messageId}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not delete message.");
      replaceMessage(data.message);
      return data.message as RealtimeMessage;
    }
  }, [emitWithAck]);

  const addReaction = useCallback(async (chatId: string, messageId: string, emoji: string) => {
    try {
      const result = await emitWithAck<{ message: RealtimeMessage }>(socketEvents.reactionAdd, { chatId, messageId, emoji });
      replaceMessage(result.message);
      return result.message;
    } catch {
      const response = await fetch(`/api/chats/${chatId}/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not react to message.");
      replaceMessage(data.message);
      return data.message as RealtimeMessage;
    }
  }, [emitWithAck]);

  const removeReaction = useCallback(async (chatId: string, messageId: string, emoji: string) => {
    try {
      const result = await emitWithAck<{ message: RealtimeMessage }>(socketEvents.reactionRemove, { chatId, messageId, emoji });
      replaceMessage(result.message);
      return result.message;
    } catch {
      const response = await fetch(`/api/chats/${chatId}/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not remove reaction.");
      replaceMessage(data.message);
      return data.message as RealtimeMessage;
    }
  }, [emitWithAck]);

  const sendAttachment = useCallback(
    async (
      chatId: string,
      file: File,
      kind: "image" | "video" | "document" | "audio" | "voice",
      caption?: string
    ) => {
      const presignResponse = await fetch("/api/attachments/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          kind
        })
      });
      const presign = await presignResponse.json();

      if (!presignResponse.ok) {
        throw new Error(presign.error ?? "Could not upload file.");
      }

      const uploadResponse = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error("File upload failed.");
      }

      const result = await emitWithAck<{ message: RealtimeMessage }>(socketEvents.attachmentComplete, {
        chatId,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        kind,
        storageKey: presign.storageKey,
        caption
      });

      appendMessage(result.message);
      updateChatPreview(result.message);
    },
    [emitWithAck]
  );

  const sendGif = useCallback(async (chatId: string, gifUrl: string, title?: string) => {
    const result = await emitWithAck<{ message: RealtimeMessage }>(socketEvents.gifSend, { chatId, gifUrl, title });
    appendMessage(result.message);
    updateChatPreview(result.message);
  }, [emitWithAck]);

  const sendSticker = useCallback(async (chatId: string, stickerId: string) => {
    const result = await emitWithAck<{ message: RealtimeMessage }>(socketEvents.stickerSend, { chatId, stickerId });
    appendMessage(result.message);
    updateChatPreview(result.message);
  }, [emitWithAck]);

  const hideChat = useCallback((chatId: string) => {
    setChats((current) => current.filter((chat) => chat.id !== chatId));
  }, []);

  const upsertChat = useCallback((chat: RealtimeChat) => {
    setChats((current) => {
      const exists = current.some((item) => item.id === chat.id);
      const next = exists
        ? current.map((item) => (item.id === chat.id ? chat : item))
        : [chat, ...current];

      return next.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
    });
  }, []);

  return {
    currentUser,
    chats,
    messagesByChat,
    loadingChats,
    loadingMessagesByChat,
    messageErrorsByChat,
    typingByChat,
    onlineUserIds,
    connected,
    error,
    refreshChats,
    loadMessages,
    sendMessage,
    retryMessage,
    markRead,
    startTyping,
    stopTyping,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    sendAttachment,
    sendGif,
    sendSticker,
    hideChat,
    upsertChat
  };
}

function getClientId(message: RealtimeMessage) {
  const metadata = message.metadata && typeof message.metadata === "object"
    ? message.metadata
    : null;
  const clientId = metadata?.clientId;
  return typeof clientId === "string" ? clientId : null;
}

function getMessagePreview(message: RealtimeMessage) {
  if (message.deletedAt) return "Message deleted";
  if (message.body?.trim()) return message.body;

  const metadata = message.metadata && typeof message.metadata === "object"
    ? message.metadata
    : null;
  if (metadata && "gifUrl" in metadata) return "GIF";
  if (metadata && "storageKey" in metadata) return "Sticker";

  const firstAttachment = message.attachments?.[0];
  if (firstAttachment?.fileType === "voice") return "Voice message";
  if (firstAttachment?.mimeType.startsWith("image/")) return "Image";
  if (firstAttachment?.mimeType.startsWith("video/")) return "Video";
  if (firstAttachment?.mimeType.startsWith("audio/")) return "Audio";
  if (firstAttachment) return "Document";

  return "New message";
}
