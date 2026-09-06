import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const [config, onAllowlist, categories, myVotes] = await Promise.all([
    prisma.pollConfig.findUnique({ where: { id: 1 } }),
    prisma.allowlist.findUnique({ where: { email } }),
    prisma.category.findMany({
      include: { candidates: { orderBy: { id: "asc" } } },
      orderBy: { id: "asc" },
    }),
    prisma.vote.findMany({ where: { studentEmail: email } }),
  ]);

  const votedCategoryIds = new Set(myVotes.map((v) => v.categoryId));

  const categoriesWithStatus = categories.map((c) => ({
    id: c.id,
    name: c.name,
    candidates: c.candidates.map((cand) => ({ id: cand.id, name: cand.name, imageUrl: cand.imageUrl })),
    voted: votedCategoryIds.has(c.id),
  }));

  return NextResponse.json({
    votingOpen: config?.votingOpen ?? false,
    registered: Boolean(onAllowlist),
    categories: categoriesWithStatus,
  });
}
