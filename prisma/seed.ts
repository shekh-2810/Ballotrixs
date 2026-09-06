import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Ensure the singleton poll config row exists, starting closed.
  await prisma.pollConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, votingOpen: false },
  });

  const categoryNames = [
    "Mister 2026",
    "Miss 2026",
    "Mister 2025",
    "Miss 2025",
    "Mister 2024",
    "Miss 2024",
    "Mister 2023",
    "Miss 2023",
  ];

  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("Seeded poll config and 8 categories.");
  console.log("Next: add candidates to each category via Prisma Studio (npm run prisma:studio) or an admin script.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
