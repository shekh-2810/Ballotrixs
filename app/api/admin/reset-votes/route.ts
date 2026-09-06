import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return (session as any)?.isAdmin ? session : null;
}

// Body: { categoryId: number }
// Deletes every vote in that category, resetting all its candidates to 0.
// Candidates and students on the allowlist are untouched - only the votes
// for this one category are removed.
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const categoryId = Number(body?.categoryId);

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return NextResponse.json({ error: "categoryId required" }, { status: 400 });
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const result = await prisma.vote.deleteMany({ where: { categoryId } });

  return NextResponse.json({ category: category.name, votesRemoved: result.count });
}
