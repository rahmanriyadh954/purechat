export function sanitizePlainText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

export function sanitizeFileName(value: string) {
  const cleaned = sanitizePlainText(value)
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, " ");

  return cleaned.slice(0, 180) || "file";
}
