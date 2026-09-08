import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const isAdmin = Boolean((session as any)?.isAdmin);
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const categories = await prisma.category.findMany({
    include: {
      candidates: {
        include: { _count: { select: { votes: true } } },
      },
    },
    orderBy: [{ batchYear: "desc" }, { gender: "asc" }],
  });

  const results = categories.map((c) => {
    const candidates = c.candidates
      .map((cand) => ({ id: cand.id, name: cand.name, imageUrl: cand.imageUrl, votes: cand._count.votes }))
      .sort((a, b) => b.votes - a.votes);
    const topVotes = candidates[0]?.votes ?? 0;
    return {
      categoryId: c.id,
      category: c.name,
      batchYear: c.batchYear,
      gender: c.gender,
      totalVotes: candidates.reduce((sum, cand) => sum + cand.votes, 0),
      candidates: candidates.map((cand) => ({
        ...cand,
        isWinner: topVotes > 0 && cand.votes === topVotes,
      })),
    };
  });

  return NextResponse.json({ results });
}
