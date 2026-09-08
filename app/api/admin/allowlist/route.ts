import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return (session as any)?.isAdmin ? session : null;
}

type StudentInput = { email: string; name?: string; regNo?: string };

// Returns the full list (email, name, regNo, createdAt) - at a few
// thousand rows this is small enough to hand to the client in one shot
// and filter/search there, no server-side search endpoint needed.
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const students = await prisma.allowlist.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ count: students.length, students });
}

// Body: { students: { email: string, name?: string, regNo?: string }[] }
// Accepts either a bulk CSV-derived list or a single manually-added row -
// both go through the same shape.
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const rawStudents: unknown = body?.students;

  if (!Array.isArray(rawStudents)) {
    return NextResponse.json({ error: "Expected an array of students" }, { status: 400 });
  }

  const domain = (process.env.ALLOWED_DOMAIN ?? "").toLowerCase();

  const byEmail = new Map<string, StudentInput>();
  for (const raw of rawStudents as StudentInput[]) {
    const email = String(raw?.email ?? "").trim().toLowerCase();
    if (!email) continue;
    byEmail.set(email, {
      email,
      name: raw?.name ? String(raw.name).trim() : undefined,
      regNo: raw?.regNo ? String(raw.regNo).trim() : undefined,
    });
  }

  const cleaned = Array.from(byEmail.values());
  const validStudents = cleaned.filter((s) => s.email.endsWith(`@${domain}`));
  const skipped = cleaned.length - validStudents.length;

  // createMany can't upsert, and some rows may already exist (e.g.
  // re-uploading a corrected sheet) - upsert one by one so a name/regNo
  // correction on a re-upload actually takes effect instead of being
  // silently skipped as a duplicate.
  let added = 0;
  let updated = 0;
  for (const s of validStudents) {
    const existed = await prisma.allowlist.findUnique({ where: { email: s.email } });
    await prisma.allowlist.upsert({
      where: { email: s.email },
      update: { name: s.name, regNo: s.regNo },
      create: { email: s.email, name: s.name, regNo: s.regNo },
    });
    if (existed) updated++;
    else added++;
  }

  return NextResponse.json({
    added,
    updated,
    receivedTotal: cleaned.length,
    skippedWrongDomain: skipped,
  });
}

// Remove a single email from the allowlist.
export async function DELETE(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  await prisma.allowlist.delete({ where: { email } }).catch(() => null);
  return NextResponse.json({ removed: email });
}
