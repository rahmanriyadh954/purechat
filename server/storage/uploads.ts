import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "node:path";
import { env } from "@/lib/env";
import { s3Config } from "./s3";

const s3 = new S3Client({
  endpoint: s3Config.endpoint,
  region: s3Config.region,
  credentials: s3Config.credentials,
  forcePathStyle: s3Config.forcePathStyle
});

export async function createPresignedUploadUrl(input: {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
}) {
  if (env.STORAGE_DRIVER === "local") {
    return `/api/uploads/local/${input.storageKey}`;
  }

  const command = new PutObjectCommand({
    Bucket: s3Config.bucket,
    Key: input.storageKey,
    ContentType: input.mimeType,
    ContentLength: input.sizeBytes,
    Metadata: {
      scan: "pending"
    }
  });

  return getSignedUrl(s3, command, { expiresIn: 60 * 5 });
}

export async function createPresignedDownloadUrl(storageKey: string) {
  if (env.STORAGE_DRIVER === "local") {
    return `/api/files/${storageKey}?download=1`;
  }

  const command = new GetObjectCommand({
    Bucket: s3Config.bucket,
    Key: storageKey
  });

  return getSignedUrl(s3, command, { expiresIn: 60 * 5 });
}

export function getLocalUploadPath(storageKey: string) {
  if (storageKey.includes("..") || storageKey.startsWith("/") || storageKey.startsWith("\\")) {
    throw new Error("Invalid storage key.");
  }

  return path.resolve(env.UPLOAD_DIR, storageKey);
}
