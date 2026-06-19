import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  NEXT_PUBLIC_APP_NAME: z.string().default("PureChat"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  APP_ORIGIN: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  DATA_ENCRYPTION_KEY: z.string().min(32),
  AUTH_COOKIE_NAME: z.string().default("purechat.session"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_DIR: z.string().default("./uploads"),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(26_214_400),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  OTP_PROVIDER: z.enum(["console", "email", "sms"]).default("console"),
  OTP_FROM_EMAIL: z.string().default("no-reply@purechat.example"),
  OTP_FROM_PHONE: z.string().default("+10000000000"),
  MODERATION_PROVIDER: z.enum(["local", "ai"]).default("local"),
  AI_MODERATION_API_KEY: z.string().optional(),
  SOCKET_IO_PATH: z.string().default("/api/socket"),
  NEXT_PUBLIC_SOCKET_IO_PATH: z.string().default("/api/socket"),
  TURN_SERVER_URL: z.string().optional(),
  WEBRTC_STUN_URL: z.string().default("stun:stun.l.google.com:19302"),
  TURN_USERNAME: z.string().optional(),
  TURN_CREDENTIAL: z.string().optional(),
  SEED_ADMIN_EMAIL: z.string().email().default("admin@purechat.local"),
  SEED_ADMIN_PASSWORD: z.string().min(10).default("Admin123456!")
});

const parsed = envSchema.parse(process.env);

if (!parsed.AUTH_SECRET && !parsed.JWT_ACCESS_SECRET) {
  throw new Error("Set AUTH_SECRET or JWT_ACCESS_SECRET.");
}

if (parsed.STORAGE_DRIVER === "s3") {
  const missing = [
    ["S3_ENDPOINT", parsed.S3_ENDPOINT],
    ["S3_BUCKET", parsed.S3_BUCKET],
    ["S3_ACCESS_KEY_ID", parsed.S3_ACCESS_KEY_ID],
    ["S3_SECRET_ACCESS_KEY", parsed.S3_SECRET_ACCESS_KEY]
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(`Missing S3 storage variables: ${missing.map(([key]) => key).join(", ")}`);
  }
}

export const env = {
  ...parsed,
  AUTH_SECRET: parsed.AUTH_SECRET ?? parsed.JWT_ACCESS_SECRET ?? "",
  JWT_REFRESH_SECRET: parsed.JWT_REFRESH_SECRET ?? parsed.AUTH_SECRET ?? parsed.JWT_ACCESS_SECRET ?? ""
};
