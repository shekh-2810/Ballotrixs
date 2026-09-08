import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const categoryId = Number(body?.categoryId);
  const candidateId = Number(body?.candidateId);

  if (!categoryId || !candidateId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // These three don't depend on each other - running them concurrently
  // instead of one-after-another cuts the round-trip time per request by
  // roughly 3x, which matters a lot under load: every millisecond a
  // request holds open is a millisecond it's occupying a slot in the
  // (limited) database connection pool.
  const [config, onAllowlist, candidate] = await Promise.all([
    prisma.pollConfig.findUnique({ where: { id: 1 } }),
    prisma.allowlist.findUnique({ where: { email } }),
    prisma.candidate.findUnique({ where: { id: candidateId } }),
  ]);

  if (!config?.votingOpen) {
    return NextResponse.json({ error: "Voting is not open right now" }, { status: 403 });
  }
  if (!onAllowlist) {
    return NextResponse.json({ error: "You are not on the registered voters list" }, { status: 403 });
  }
  if (!candidate || candidate.categoryId !== categoryId) {
    return NextResponse.json({ error: "Candidate does not match category" }, { status: 400 });
  }

  try {
    const vote = await prisma.vote.create({
      data: { studentEmail: email, categoryId, candidateId },
    });
    return NextResponse.json({ success: true, vote });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "You have already voted in this category" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
