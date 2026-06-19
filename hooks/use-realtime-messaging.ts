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
  members: Array<{
    userId: string;
    displayName: string;
    username: string;
    avatarUrl?: string | null;
    lastSeenAt?: string | Date | null;
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
  const [typingByChat, setTypingByChat] = useState<Record<string, string[]>>({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  const activeChatIds = useMemo(() => chats.map((chat) => chat.id), [chats]);

  const loadMessages = useCallback(async (chatId: string) => {
    const response = await fetch(`/api/chats/${chatId}/messages`);
    if (!response.ok) return;
    const data = await response.json();
    setMessagesByChat((current) => ({
      ...current,
      [chatId]: data.messages
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      const meResponse = await fetch("/api/auth/me");
      if (!meResponse.ok) {
        setError("Sign in to use real-time chat.");
        return;
      }

      const meData = await meResponse.json();
      if (cancelled) return;
      setCurrentUser(meData.user);

      const chatsResponse = await fetch("/api/chats");
      if (!chatsResponse.ok) {
        setError("Could not load chats.");
        return;
      }

      const chatsData = await chatsResponse.json();
      if (cancelled) return;
      setChats(chatsData.chats);

      await Promise.all(
        chatsData.chats.slice(0, 5).map((chat: RealtimeChat) => loadMessages(chat.id))
      );
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [loadMessages]);

  useEffect(() => {
    if (!currentUser) return;

    const socket = io({
      path: process.env.NEXT_PUBLIC_SOCKET_IO_PATH ?? "/api/socket",
      withCredentials: true
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
      setMessagesByChat((current) => {
        const existing = current[message.chatId] ?? [];
        if (existing.some((item) => item.id === message.id)) return current;

        return {
          ...current,
          [message.chatId]: [...existing, message]
        };
      });

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

  function replaceMessage(message: RealtimeMessage) {
    setMessagesByChat((current) => ({
      ...current,
      [message.chatId]: (current[message.chatId] ?? []).map((item) =>
        item.id === message.id ? message : item
      )
    }));
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

  const sendMessage = useCallback((chatId: string, body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;

    socketRef.current?.emit(socketEvents.messageSend, {
      chatId,
      body: trimmed,
      clientId: crypto.randomUUID()
    });
  }, []);

  const markRead = useCallback((chatId: string, messageId: string) => {
    socketRef.current?.emit(socketEvents.messageRead, { chatId, messageId });
  }, []);

  const startTyping = useCallback((chatId: string) => {
    socketRef.current?.emit(socketEvents.typingStart, { chatId });
  }, []);

  const stopTyping = useCallback((chatId: string) => {
    socketRef.current?.emit(socketEvents.typingStop, { chatId });
  }, []);

  const editMessage = useCallback((chatId: string, messageId: string, body: string) => {
    socketRef.current?.emit(socketEvents.messageEdit, { chatId, messageId, body });
  }, []);

  const deleteMessage = useCallback((chatId: string, messageId: string) => {
    socketRef.current?.emit(socketEvents.messageDelete, { chatId, messageId });
  }, []);

  const addReaction = useCallback((chatId: string, messageId: string, emoji: string) => {
    socketRef.current?.emit(socketEvents.reactionAdd, { chatId, messageId, emoji });
  }, []);

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

      socketRef.current?.emit(socketEvents.attachmentComplete, {
        chatId,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        kind,
        storageKey: presign.storageKey,
        caption
      });
    },
    []
  );

  const sendGif = useCallback((chatId: string, gifUrl: string, title?: string) => {
    socketRef.current?.emit(socketEvents.gifSend, { chatId, gifUrl, title });
  }, []);

  const sendSticker = useCallback((chatId: string, stickerId: string) => {
    socketRef.current?.emit(socketEvents.stickerSend, { chatId, stickerId });
  }, []);

  return {
    currentUser,
    chats,
    messagesByChat,
    typingByChat,
    onlineUserIds,
    connected,
    error,
    loadMessages,
    sendMessage,
    markRead,
    startTyping,
    stopTyping,
    editMessage,
    deleteMessage,
    addReaction,
    sendAttachment,
    sendGif,
    sendSticker
  };
}
