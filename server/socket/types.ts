export type SendMessagePayload = {
  chatId: string;
  body: string;
  clientId?: string;
  replyToMessageId?: string;
};

export type MessageIdPayload = {
  chatId: string;
  messageId: string;
};

export type EditMessagePayload = MessageIdPayload & {
  body: string;
};

export type ReactionPayload = MessageIdPayload & {
  emoji: string;
};

export type TypingPayload = {
  chatId: string;
};

export type AttachmentCompletePayload = {
  chatId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: "image" | "video" | "document" | "audio" | "voice";
  storageKey: string;
  thumbnailKey?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  waveform?: unknown;
  caption?: string;
};

export type GifSendPayload = {
  chatId: string;
  gifUrl: string;
  title?: string;
};

export type StickerSendPayload = {
  chatId: string;
  stickerId: string;
};

export type StartCallPayload = {
  chatId: string;
  type: "AUDIO" | "VIDEO";
  participantIds?: string[];
  isGroupCall?: boolean;
};

export type CallIdPayload = {
  callId: string;
};

export type CallSignalPayload = {
  callId: string;
  chatId: string;
  targetUserId: string;
  sdp?: string;
  candidate?: unknown;
};

export type ScreenSharePayload = {
  callId: string;
  enabled: boolean;
};
