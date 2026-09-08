import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return (session as any)?.isAdmin ? session : null;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = await prisma.pollConfig.findUnique({ where: { id: 1 } });
  const [allowlistCount, voteCount, loginCount, distinctVoters] = await Promise.all([
    prisma.allowlist.count(),
    prisma.vote.count(),
    prisma.loginLog.count(),
    prisma.vote.findMany({ distinct: ["studentEmail"], select: { studentEmail: true } }),
  ]);

  const participation = allowlistCount > 0 ? distinctVoters.length / allowlistCount : 0;

  return NextResponse.json({
    votingOpen: config?.votingOpen ?? false,
    startedAt: config?.startedAt ?? null,
    allowlistCount,
    voteCount,
    loginCount,
    distinctVoterCount: distinctVoters.length,
    participation,
  });
}

// Body: { votingOpen: boolean }
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (typeof body?.votingOpen !== "boolean") {
    return NextResponse.json({ error: "votingOpen must be true or false" }, { status: 400 });
  }

  const current = await prisma.pollConfig.findUnique({ where: { id: 1 } });

  // Only stamp startedAt the first time voting turns on - toggling it off
  // and back on shouldn't reset the "started at" time shown to the admin.
  const startedAt =
    body.votingOpen && !current?.startedAt ? new Date() : current?.startedAt ?? null;

  const updated = await prisma.pollConfig.upsert({
    where: { id: 1 },
    update: { votingOpen: body.votingOpen, startedAt },
    create: { id: 1, votingOpen: body.votingOpen, startedAt },
  });

  return NextResponse.json({ votingOpen: updated.votingOpen, startedAt: updated.startedAt });
}
