import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.pollConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, votingOpen: false },
  });

  const years = [2026, 2025, 2024, 2023];
  for (const year of years) {
    for (const gender of ["mister", "miss"] as const) {
      const name = `${gender === "mister" ? "Mister" : "Miss"} ${year}`;
      await prisma.category.upsert({
        where: { batchYear_gender: { batchYear: year, gender } },
        update: { name },
        create: { name, batchYear: year, gender },
      });
    }
  }

  console.log("Seeded poll config and 8 categories (4 batches x Mister/Miss).");
  console.log("Add candidates via the admin panel's Candidates tab.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
