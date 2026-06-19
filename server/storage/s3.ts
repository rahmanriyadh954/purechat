import { env } from "@/lib/env";

export const s3Config = {
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  bucket: env.S3_BUCKET ?? "purechat",
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? ""
  },
  forcePathStyle: env.S3_FORCE_PATH_STYLE
};
