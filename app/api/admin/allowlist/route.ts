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

  const count = await prisma.allowlist.count();
  return NextResponse.json({ count });
}

// Body: { emails: string[] }
// Accepts a raw list (already split client-side from a pasted/uploaded
// CSV or .txt file - one email per line or comma-separated).
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const rawEmails: unknown = body?.emails;

  if (!Array.isArray(rawEmails)) {
    return NextResponse.json({ error: "Expected an array of emails" }, { status: 400 });
  }

  const domain = (process.env.ALLOWED_DOMAIN ?? "").toLowerCase();

  const cleaned = Array.from(
    new Set(
      rawEmails
        .map((e) => String(e).trim().toLowerCase())
        .filter((e) => e.length > 0)
    )
  );

  const validEmails = cleaned.filter((e) => e.endsWith(`@${domain}`));
  const skipped = cleaned.length - validEmails.length;

  const result = await prisma.allowlist.createMany({
    data: validEmails.map((email) => ({ email })),
    skipDuplicates: true,
  });

  return NextResponse.json({
    added: result.count,
    receivedTotal: cleaned.length,
    skippedWrongDomain: skipped,
  });
}

// Remove a single email from the allowlist (in case of a mistaken upload).
export async function DELETE(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  await prisma.allowlist.delete({ where: { email } }).catch(() => null);
  return NextResponse.json({ removed: email });
}
