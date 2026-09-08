import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Returns candidates grouped into batches (one per graduation year), each
// containing its Mister and Miss categories - matching the batch-first
// navigation (pick a batch, then vote within it for both categories).
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
      orderBy: [{ batchYear: "desc" }, { gender: "asc" }],
    }),
    prisma.vote.findMany({ where: { studentEmail: email } }),
  ]);

  const votedCategoryIds = new Set(myVotes.map((v) => v.categoryId));
  const votedByCategory = new Map(myVotes.map((v) => [v.categoryId, v.candidateId]));

  const batchesMap = new Map<number, any>();

  for (const c of categories) {
    if (c.batchYear === null || c.gender === null) {
      continue;
    }

    const batchYear: number = c.batchYear;
    const gender: string = c.gender;

    if (!batchesMap.has(batchYear)) {
      batchesMap.set(batchYear, {
        batchYear,
        categories: [],
      });
    }

    batchesMap.get(batchYear).categories.push({
      id: c.id,
      name: c.name,
      gender,
      voted: votedCategoryIds.has(c.id),
      votedCandidateId: votedByCategory.get(c.id) ?? null,
      candidates: c.candidates.map((cand) => ({
        id: cand.id,
        name: cand.name,
        imageUrl: cand.imageUrl,
      })),
    });
  }

  const batches = Array.from(batchesMap.values()).sort((a, b) => b.batchYear - a.batchYear);

  return NextResponse.json({
    votingOpen: config?.votingOpen ?? false,
    startedAt: config?.startedAt ?? null,
    registered: Boolean(onAllowlist),
    batches,
  });
}
