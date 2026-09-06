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
  const [allowlistCount, voteCount, loginCount] = await Promise.all([
    prisma.allowlist.count(),
    prisma.vote.count(),
    prisma.loginLog.count(),
  ]);

  return NextResponse.json({
    votingOpen: config?.votingOpen ?? false,
    allowlistCount,
    voteCount,
    loginCount,
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

  const updated = await prisma.pollConfig.upsert({
    where: { id: 1 },
    update: { votingOpen: body.votingOpen },
    create: { id: 1, votingOpen: body.votingOpen },
  });

  return NextResponse.json({ votingOpen: updated.votingOpen });
}
