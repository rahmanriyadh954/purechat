import { prisma } from "@/lib/prisma";

export async function assertChatMember(userId: string, chatId: string) {
  const member = await prisma.chatMember.findUnique({
    where: {
      chatId_userId: {
        chatId,
        userId
      }
    },
    select: {
      id: true,
      status: true,
      role: true
    }
  });

  if (!member || member.status !== "ACTIVE") {
    throw new Error("You do not have access to this chat.");
  }

  return member;
}
