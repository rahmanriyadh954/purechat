import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  return createHash("sha256").update(env.DATA_ENCRYPTION_KEY).digest();
}

export function encryptSensitiveText(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSensitiveText(value: string) {
  const [ivText, tagText, ciphertextText] = value.split(".");
  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivText, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final()
  ]);

  return plaintext.toString("utf8");
}
