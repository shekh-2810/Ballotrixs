import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// A deliberately tiny endpoint - just booleans and IDs, no candidate data
// or images. This is the one safe to poll every few seconds from every
// signed-in student's browser; /api/my-votes (which includes full
// candidate + image payloads) should only be fetched once per page load
// or when this endpoint reports a real change, not on a timer.
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const [config, onAllowlist, myVotes] = await Promise.all([
    prisma.pollConfig.findUnique({ where: { id: 1 } }),
    prisma.allowlist.findUnique({ where: { email } }),
    prisma.vote.findMany({ where: { studentEmail: email }, select: { categoryId: true } }),
  ]);

  return NextResponse.json({
    votingOpen: config?.votingOpen ?? false,
    registered: Boolean(onAllowlist),
    votedCategoryIds: myVotes.map((v) => v.categoryId),
  });
}
