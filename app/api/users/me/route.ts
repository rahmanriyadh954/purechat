import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { profileUpdateSchema } from "@/features/users/user-settings.validators";
import { prisma } from "@/lib/prisma";
import { readValidatedJson } from "@/server/security/api";

function presentUser(user: Awaited<ReturnType<typeof getUser>>) {
  if (!user) return null;

  return {
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    profile: user.profile
  };
}

async function getUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      username: true,
      email: true,
      phone: true,
      avatarUrl: true,
      role: true,
      profile: {
        select: {
          bio: true,
          statusMessage: true,
          country: true,
          gender: true,
          lastSeenVisibility: true,
          profilePhotoVisibility: true,
          readReceiptsEnabled: true,
          onlineStatusEnabled: true,
          twoFactorEnabled: true
        }
      }
    }
  });
}

export async function GET() {
  const session = await requireCurrentSession();
  return NextResponse.json({ user: presentUser(await getUser(session.userId)) });
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireCurrentSession();
    const body = await readValidatedJson(request, profileUpdateSchema);
    const username = body.username?.toLowerCase();

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        displayName: body.displayName,
        username,
        email: body.email === undefined ? undefined : body.email,
        phone: body.phone === undefined ? undefined : body.phone,
        profile: {
          upsert: {
            create: {
              gender: body.gender ?? undefined,
              country: body.country ?? undefined,
              statusMessage: body.statusMessage ?? undefined,
              bio: body.bio ?? undefined
            },
            update: {
              gender: body.gender,
              country: body.country,
              statusMessage: body.statusMessage,
              bio: body.bio
            }
          }
        }
      }
    });

    return NextResponse.json({ user: presentUser(await getUser(session.userId)) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "This email, phone, or username cannot be used." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update profile." },
      { status: 400 }
    );
  }
}
