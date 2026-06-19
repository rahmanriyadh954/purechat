import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@purechat.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123456!";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      isVerified: true
    },
    create: {
      email: adminEmail,
      username: "purechat_admin",
      displayName: "PureChat Admin",
      passwordHash: await hash(adminPassword, 12),
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      isVerified: true,
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          bio: "PureChat system administrator",
          familyModeEnabled: true,
          filterGifs: true,
          filterStickers: true
        }
      }
    }
  });

  const demoUser = await prisma.user.upsert({
    where: { username: "family_demo" },
    update: {},
    create: {
      email: "family.demo@purechat.local",
      username: "family_demo",
      displayName: "Family Demo",
      passwordHash: await hash("Demo123456!", 12),
      role: "USER",
      status: "ACTIVE",
      isVerified: true,
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          bio: "A family-safe demo account",
          familyModeEnabled: true,
          filterGifs: true,
          filterStickers: true,
          filterMedia: false
        }
      }
    }
  });

  const directChat = await prisma.chat.upsert({
    where: { id: "seed-direct-chat" },
    update: {},
    create: {
      id: "seed-direct-chat",
      type: "DIRECT",
      createdById: admin.id,
      members: {
        create: [
          { userId: admin.id, role: "OWNER" },
          { userId: demoUser.id, role: "MEMBER" }
        ]
      },
      messages: {
        create: {
          senderId: admin.id,
          type: "TEXT",
          body: "Assalamu alaikum. Welcome to PureChat.",
          status: "SENT"
        }
      }
    }
  });

  await prisma.chat.update({
    where: { id: directChat.id },
    data: { lastMessageAt: new Date() }
  });

  await prisma.stickerPack.upsert({
    where: { id: "seed-family-safe-pack" },
    update: {},
    create: {
      id: "seed-family-safe-pack",
      name: "PureChat Essentials",
      description: "Simple family-safe stickers for local testing.",
      creatorId: admin.id,
      isOfficial: true,
      isFamilySafe: true,
      isPublished: true,
      stickers: {
        create: [
          {
            name: "Salam",
            storageKey: "stickers/purechat/salam.svg",
            emoji: "salam",
            tags: ["salam", "peace", "hello"],
            isFamilySafe: true
          },
          {
            name: "Thank You",
            storageKey: "stickers/purechat/thanks.svg",
            emoji: "thanks",
            tags: ["thanks", "grateful"],
            isFamilySafe: true
          }
        ]
      }
    }
  });

  console.info(`Seed complete. Admin: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
