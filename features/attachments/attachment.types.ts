export type PresignedUploadRequest = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  chatId: string;
  kind: "image" | "video" | "document" | "audio" | "voice";
};

export type CompletedUploadRequest = PresignedUploadRequest & {
  storageKey: string;
  thumbnailKey?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  waveform?: unknown;
  caption?: string;
};
