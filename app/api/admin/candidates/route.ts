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

  const categories = await prisma.category.findMany({
    include: {
      candidates: {
        orderBy: { id: "asc" },
        include: { _count: { select: { votes: true } } },
      },
    },
    orderBy: [{ batchYear: "desc" }, { gender: "asc" }],
  });

  return NextResponse.json({ categories });
}

// Body: { categoryId: number, name: string, imageUrl?: string }
// imageUrl is a repository-relative path such as "arjun.jpg" or "/candidates/2026/arjun.jpg".
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const categoryId = Number(body?.categoryId);
  const name = String(body?.name ?? "").trim();
  const rawImagePath = body?.imageUrl ? String(body.imageUrl).trim() : "";
  let imageUrl: string | null = null;

  if (rawImagePath) {
    if (/^https?:\/\//i.test(rawImagePath)) {
      return NextResponse.json(
        { error: "Use an image stored in public/candidates/, not a remote URL." },
        { status: 400 }
      );
    }

    imageUrl = rawImagePath.startsWith("/")
      ? rawImagePath
      : `/candidates/${rawImagePath}`;

    if (!imageUrl.startsWith("/candidates/")) {
      return NextResponse.json(
        { error: "Image path must be inside /candidates/." },
        { status: 400 }
      );
    }

    if (imageUrl.includes("..") || imageUrl.includes("\\")) {
      return NextResponse.json(
        { error: "Invalid image path." },
        { status: 400 }
      );
    }
  }

  if (!categoryId || !name) {
    return NextResponse.json({ error: "categoryId and name are required" }, { status: 400 });
  }

  const candidate = await prisma.candidate.create({
    data: { categoryId, name, imageUrl },
  });

  return NextResponse.json({ candidate });
}

// Body: { id: number }
// Deleting a candidate also removes their votes - the client warns about
// this (and shows the vote count) before calling this endpoint.
export async function DELETE(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: { _count: { select: { votes: true } } },
  });
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const votesRemoved = candidate._count.votes;
  await prisma.vote.deleteMany({ where: { candidateId: id } });
  await prisma.candidate.delete({ where: { id } });

  return NextResponse.json({ removed: id, votesRemoved });
}
