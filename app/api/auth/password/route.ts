import { compare, hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { changePasswordSchema } from "@/features/users/user-settings.validators";
import { prisma } from "@/lib/prisma";
import { readValidatedJson } from "@/server/security/api";
import { writeAuditLog } from "@/server/security/audit";

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireCurrentSession();
    const body = await readValidatedJson(request, changePasswordSchema);
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true }
    });

    if (!user || !(await compare(body.currentPassword, user.passwordHash))) {
      return NextResponse.json(
        { error: "The current password is incorrect." },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        passwordHash: await hash(body.newPassword, 12)
      }
    });

    await writeAuditLog({
      actorId: session.userId,
      action: "PASSWORD_CHANGED",
      entityType: "User",
      entityId: session.userId
    });

    return NextResponse.json({ ok: true, message: "Password updated." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update password." },
      { status: 400 }
    );
  }
}
