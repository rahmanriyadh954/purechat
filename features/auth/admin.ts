import { requireCurrentSession } from "./current-user";

export async function requireAdminSession() {
  const session = await requireCurrentSession();

  if (!["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(session.user.role)) {
    throw new Error("Admin access is required.");
  }

  return session;
}
