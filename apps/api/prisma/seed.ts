import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('LocalOnly-Password-123!', 12);
  for (const [email, displayName] of [['alice@example.test', 'Alice'], ['bob@example.test', 'Bob']] as const) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, normalizedEmail: email, displayName, passwordHash },
    });
  }
}

main().finally(() => prisma.$disconnect());
