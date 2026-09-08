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

  const config = await prisma.pollConfig.findUnique({ where: { id: 1 } });
  if (!config?.votingOpen) {
    return NextResponse.json({ error: "Voting is not open right now" }, { status: 403 });
  }

  const onAllowlist = await prisma.allowlist.findUnique({ where: { email } });
  if (!onAllowlist) {
    return NextResponse.json({ error: "You are not on the registered voters list" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const categoryId = Number(body?.categoryId);
  const candidateId = Number(body?.candidateId);

  if (!categoryId || !candidateId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
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
