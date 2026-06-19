import path from "node:path";
import { randomUUID } from "node:crypto";

const maxSizeByKind = {
  image: 12 * 1024 * 1024,
  video: 120 * 1024 * 1024,
  document: 30 * 1024 * 1024,
  audio: 40 * 1024 * 1024,
  voice: 15 * 1024 * 1024
} as const;

const mimeTypesByKind = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  document: [
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ],
  audio: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/ogg"],
  voice: ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4"]
} as const;

const blockedExtensions = new Set([
  ".exe",
  ".dll",
  ".bat",
  ".cmd",
  ".com",
  ".scr",
  ".js",
  ".jar",
  ".ps1",
  ".sh"
]);

export function validateUpload(input: {
  kind: keyof typeof mimeTypesByKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const extension = path.extname(input.fileName).toLowerCase();

  if (blockedExtensions.has(extension)) {
    throw new Error("This file type is not allowed.");
  }

  if (!mimeTypesByKind[input.kind].includes(input.mimeType as never)) {
    throw new Error("This file format is not allowed.");
  }

  if (input.sizeBytes > maxSizeByKind[input.kind]) {
    throw new Error("This file is too large.");
  }
}

export function createStorageKey(input: {
  chatId: string;
  userId: string;
  kind: string;
  fileName: string;
}) {
  const extension = path.extname(input.fileName).toLowerCase();
  const safeExtension = extension.replace(/[^a-z0-9.]/g, "") || ".bin";
  const date = new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");

  return [
    "chats",
    input.chatId,
    input.kind,
    `${yyyy}-${mm}`,
    input.userId,
    `${randomUUID()}${safeExtension}`
  ].join("/");
}

export function assertStorageKeyBelongsToUpload(input: {
  storageKey: string;
  chatId: string;
  userId: string;
  kind: string;
}) {
  const prefix = `chats/${input.chatId}/${input.kind}/`;
  const userSegment = `/${input.userId}/`;

  if (!input.storageKey.startsWith(prefix) || !input.storageKey.includes(userSegment)) {
    throw new Error("Invalid storage key.");
  }

  if (input.storageKey.includes("..") || input.storageKey.startsWith("/")) {
    throw new Error("Invalid storage key.");
  }
}
