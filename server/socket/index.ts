import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import {
  addReaction,
  completeAttachmentMessage,
  deleteMessage,
  editMessage,
  markMessageDelivered,
  markMessageRead,
  presentMessage,
  removeReaction,
  sendGifMessage,
  sendStickerMessage,
  sendTextMessage
} from "@/features/messages/message.service";
import { markUserOffline, markUserOnline } from "@/features/presence/presence.service";
import {
  acceptCall,
  endCall,
  rejectCall,
  startCall,
  updateScreenShare
} from "@/features/calls/call.service";
import { assertChatMember } from "@/server/security/permissions";
import { authenticateSocket, type AuthenticatedSocket } from "./auth";
import { socketEvents } from "./events";
import type {
  EditMessagePayload,
  AttachmentCompletePayload,
  GifSendPayload,
  MessageIdPayload,
  ReactionPayload,
  SendMessagePayload,
  StickerSendPayload,
  TypingPayload,
  StartCallPayload,
  CallIdPayload,
  CallSignalPayload,
  ScreenSharePayload
} from "./types";

const socketCounters = new Map<string, { count: number; resetAt: number }>();

function checkSocketRateLimit(userId: string, action: string, limit: number, windowMs: number) {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const current = socketCounters.get(key);

  if (!current || current.resetAt < now) {
    socketCounters.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  current.count += 1;
  return current.count <= limit;
}

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    path: process.env.SOCKET_IO_PATH ?? "/api/socket",
    cors: {
      origin: process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL,
      credentials: true
    },
    allowRequest: (request, callback) => {
      const allowedOrigin = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL;
      const origin = request.headers.origin;

      if (!allowedOrigin || !origin || origin === allowedOrigin) {
        callback(null, true);
        return;
      }

      callback("Invalid socket origin", false);
    }
  });

  io.use(async (socket, next) => {
    try {
      await authenticateSocket(socket as AuthenticatedSocket);
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const authedSocket = socket as AuthenticatedSocket;
    const userId = authedSocket.userId;

    if (!userId) {
      authedSocket.disconnect(true);
      return;
    }

    authedSocket.join(`user:${userId}`);
    void markUserOnline(userId, authedSocket.id);
    authedSocket.broadcast.emit(socketEvents.userOnline, { userId });

    authedSocket.emit(socketEvents.connectionReady, {
      userId
    });

    authedSocket.on(socketEvents.conversationJoin, async ({ chatId }) => {
      try {
        if (typeof chatId !== "string") return;
        await assertChatMember(userId, chatId);
        authedSocket.join(`chat:${chatId}`);
      } catch {
        authedSocket.emit("error", { message: "Cannot join chat." });
      }
    });

    authedSocket.on(socketEvents.conversationLeave, ({ chatId }) => {
      if (typeof chatId === "string") {
        authedSocket.leave(`chat:${chatId}`);
      }
    });

    authedSocket.on(
      socketEvents.messageSend,
      async (payload: SendMessagePayload, ack?: (value: unknown) => void) => {
        try {
          if (!checkSocketRateLimit(userId, "message", 120, 60_000)) {
            throw new Error("You are sending messages too quickly.");
          }
          const message = await sendTextMessage(payload, userId);
          if (message.status === "PENDING_APPROVAL") {
            const admins = await import("@/lib/prisma").then(({ prisma }) =>
              prisma.chatMember.findMany({
                where: {
                  chatId: message.chatId,
                  status: "ACTIVE",
                  role: { in: ["OWNER", "ADMIN"] }
                },
                select: { userId: true }
              })
            );

            io.to(`user:${userId}`).emit(socketEvents.messageNew, {
              message: presentMessage(message),
              clientId: payload.clientId
            });
            admins.forEach((admin) => {
              io.to(`user:${admin.userId}`).emit(socketEvents.messageNew, {
                message: presentMessage(message),
                clientId: payload.clientId
              });
            });
          } else {
            io.to(`chat:${message.chatId}`).emit(socketEvents.messageNew, {
              message: presentMessage(message),
              clientId: payload.clientId
            });
          }
          ack?.({ ok: true, message: presentMessage(message) });
        } catch (error) {
          ack?.({
            ok: false,
            error: error instanceof Error ? error.message : "Could not send message."
          });
        }
      }
    );

    authedSocket.on(
      socketEvents.attachmentComplete,
      async (payload: AttachmentCompletePayload, ack?: (value: unknown) => void) => {
        try {
          if (!checkSocketRateLimit(userId, "attachment", 60, 60_000)) {
            throw new Error("You are sending files too quickly.");
          }
          const message = await completeAttachmentMessage(payload, userId);
          io.to(`chat:${message.chatId}`).emit(socketEvents.messageNew, {
            message: presentMessage(message)
          });
          ack?.({ ok: true, message: presentMessage(message) });
        } catch (error) {
          ack?.({
            ok: false,
            error: error instanceof Error ? error.message : "Could not send file."
          });
        }
      }
    );

    authedSocket.on(
      socketEvents.gifSend,
      async (payload: GifSendPayload, ack?: (value: unknown) => void) => {
        try {
          const message = await sendGifMessage(payload, userId);
          io.to(`chat:${message.chatId}`).emit(socketEvents.messageNew, {
            message: presentMessage(message)
          });
          ack?.({ ok: true, message: presentMessage(message) });
        } catch (error) {
          ack?.({
            ok: false,
            error: error instanceof Error ? error.message : "Could not send GIF."
          });
        }
      }
    );

    authedSocket.on(
      socketEvents.stickerSend,
      async (payload: StickerSendPayload, ack?: (value: unknown) => void) => {
        try {
          const message = await sendStickerMessage(payload, userId);
          io.to(`chat:${message.chatId}`).emit(socketEvents.messageNew, {
            message: presentMessage(message)
          });
          ack?.({ ok: true, message: presentMessage(message) });
        } catch (error) {
          ack?.({
            ok: false,
            error: error instanceof Error ? error.message : "Could not send sticker."
          });
        }
      }
    );

    authedSocket.on(socketEvents.messageDelivered, async (payload: MessageIdPayload) => {
      try {
        const receipt = await markMessageDelivered(payload, userId);
        io.to(`chat:${payload.chatId}`).emit(socketEvents.messageDelivered, {
          ...payload,
          userId,
          deliveredAt: receipt.deliveredAt
        });
      } catch {
        // Ignore stale delivery updates.
      }
    });

    authedSocket.on(socketEvents.messageRead, async (payload: MessageIdPayload) => {
      try {
        const receipt = await markMessageRead(payload, userId);
        io.to(`chat:${payload.chatId}`).emit(socketEvents.messageRead, {
          ...payload,
          userId,
          readAt: receipt.readAt
        });
      } catch {
        // Ignore stale read updates.
      }
    });

    authedSocket.on(
      socketEvents.messageEdit,
      async (payload: EditMessagePayload, ack?: (value: unknown) => void) => {
        try {
          const message = await editMessage(payload, userId);
          io.to(`chat:${message.chatId}`).emit(socketEvents.messageUpdated, { message: presentMessage(message) });
          ack?.({ ok: true, message: presentMessage(message) });
        } catch (error) {
          ack?.({
            ok: false,
            error: error instanceof Error ? error.message : "Could not edit message."
          });
        }
      }
    );

    authedSocket.on(
      socketEvents.messageDelete,
      async (payload: MessageIdPayload, ack?: (value: unknown) => void) => {
        try {
          const message = await deleteMessage(payload, userId);
          io.to(`chat:${message.chatId}`).emit(socketEvents.messageDeleted, { message: presentMessage(message) });
          ack?.({ ok: true, message: presentMessage(message) });
        } catch (error) {
          ack?.({
            ok: false,
            error: error instanceof Error ? error.message : "Could not delete message."
          });
        }
      }
    );

    authedSocket.on(socketEvents.typingStart, async (payload: TypingPayload) => {
      try {
        await assertChatMember(userId, payload.chatId);
        authedSocket.to(`chat:${payload.chatId}`).emit(socketEvents.typingUpdate, {
          chatId: payload.chatId,
          userId,
          isTyping: true
        });
      } catch {
        // Ignore typing updates outside accessible chats.
      }
    });

    authedSocket.on(socketEvents.typingStop, async (payload: TypingPayload) => {
      try {
        await assertChatMember(userId, payload.chatId);
        authedSocket.to(`chat:${payload.chatId}`).emit(socketEvents.typingUpdate, {
          chatId: payload.chatId,
          userId,
          isTyping: false
        });
      } catch {
        // Ignore typing updates outside accessible chats.
      }
    });

    authedSocket.on(socketEvents.reactionAdd, async (payload: ReactionPayload, ack?: (value: unknown) => void) => {
      try {
        const message = await addReaction(payload, userId);
        io.to(`chat:${payload.chatId}`).emit(socketEvents.reactionUpdated, { message: presentMessage(message) });
        ack?.({ ok: true, message: presentMessage(message) });
      } catch (error) {
        ack?.({
          ok: false,
          error: error instanceof Error ? error.message : "Could not react to message."
        });
      }
    });

    authedSocket.on(socketEvents.reactionRemove, async (payload: ReactionPayload, ack?: (value: unknown) => void) => {
      try {
        const message = await removeReaction(payload, userId);
        io.to(`chat:${payload.chatId}`).emit(socketEvents.reactionUpdated, { message: presentMessage(message) });
        ack?.({ ok: true, message: presentMessage(message) });
      } catch (error) {
        ack?.({
          ok: false,
          error: error instanceof Error ? error.message : "Could not remove reaction."
        });
      }
    });

    authedSocket.on(
      socketEvents.callStart,
      async (payload: StartCallPayload, ack?: (value: unknown) => void) => {
        try {
          if (!checkSocketRateLimit(userId, "call", 20, 60_000)) {
            throw new Error("You are starting calls too quickly.");
          }
          const call = await startCall(payload, userId);
          const invitedUserIds = call.participants
            .filter((participant) => participant.userId !== userId)
            .map((participant) => participant.userId);

          invitedUserIds.forEach((targetUserId) => {
            io.to(`user:${targetUserId}`).emit(socketEvents.callIncoming, { call });
          });

          io.to(`chat:${call.chatId}`).emit(socketEvents.callRinging, { call });
          ack?.({ ok: true, call });
        } catch (error) {
          ack?.({
            ok: false,
            error: error instanceof Error ? error.message : "Could not start call."
          });
        }
      }
    );

    authedSocket.on(
      socketEvents.callAccept,
      async (payload: CallIdPayload, ack?: (value: unknown) => void) => {
        try {
          const call = await acceptCall(payload, userId);
          io.to(`chat:${call.chatId}`).emit(socketEvents.callAccepted, { call, userId });
          ack?.({ ok: true, call });
        } catch (error) {
          ack?.({
            ok: false,
            error: error instanceof Error ? error.message : "Could not accept call."
          });
        }
      }
    );

    authedSocket.on(
      socketEvents.callReject,
      async (payload: CallIdPayload, ack?: (value: unknown) => void) => {
        try {
          const call = await rejectCall(payload, userId);
          io.to(`chat:${call.chatId}`).emit(socketEvents.callRejected, { call, userId });
          ack?.({ ok: true, call });
        } catch (error) {
          ack?.({
            ok: false,
            error: error instanceof Error ? error.message : "Could not reject call."
          });
        }
      }
    );

    authedSocket.on(
      socketEvents.callEnd,
      async (payload: CallIdPayload, ack?: (value: unknown) => void) => {
        try {
          const call = await endCall(payload, userId);
          io.to(`chat:${call.chatId}`).emit(socketEvents.callEnded, { call, userId });
          ack?.({ ok: true, call });
        } catch (error) {
          ack?.({
            ok: false,
            error: error instanceof Error ? error.message : "Could not end call."
          });
        }
      }
    );

    authedSocket.on(socketEvents.callOffer, async (payload: CallSignalPayload) => {
      try {
        await assertChatMember(userId, payload.chatId);
        io.to(`user:${payload.targetUserId}`).emit(socketEvents.callOffer, {
          ...payload,
          fromUserId: userId
        });
      } catch {
        // Ignore invalid call signaling.
      }
    });

    authedSocket.on(socketEvents.callAnswer, async (payload: CallSignalPayload) => {
      try {
        await assertChatMember(userId, payload.chatId);
        io.to(`user:${payload.targetUserId}`).emit(socketEvents.callAnswer, {
          ...payload,
          fromUserId: userId
        });
      } catch {
        // Ignore invalid call signaling.
      }
    });

    authedSocket.on(socketEvents.callIceCandidate, async (payload: CallSignalPayload) => {
      try {
        await assertChatMember(userId, payload.chatId);
        io.to(`user:${payload.targetUserId}`).emit(socketEvents.callIceCandidate, {
          ...payload,
          fromUserId: userId
        });
      } catch {
        // Ignore invalid call signaling.
      }
    });

    authedSocket.on(socketEvents.callScreenShare, async (payload: ScreenSharePayload) => {
      try {
        const call = await updateScreenShare(payload, userId);
        io.to(`chat:${call.chatId}`).emit(socketEvents.callScreenShareUpdated, {
          call,
          userId,
          enabled: payload.enabled
        });
      } catch {
        // Ignore invalid screen-share updates.
      }
    });

    authedSocket.on("disconnect", () => {
      void markUserOffline(userId, authedSocket.id).then(() => {
        authedSocket.broadcast.emit(socketEvents.userOffline, { userId });
      });
    });
  });

  return io;
}
