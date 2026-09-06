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

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const categories = await prisma.category.findMany({
    include: {
      candidates: {
        orderBy: { id: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({ categories });
}

// Body: { categoryId: number, name: string, imageUrl?: string }
export async function POST(req: Request) {
  const session = await requireAdmin();

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);

  const categoryId = Number(body?.categoryId);
  const name = String(body?.name ?? "").trim();
  const imageUrl = body?.imageUrl
    ? String(body.imageUrl).trim()
    : null;

  if (!Number.isInteger(categoryId) || categoryId <= 0 || !name) {
    return NextResponse.json(
      { error: "categoryId and name are required" },
      { status: 400 }
    );
  }

  if (name.length > 200) {
    return NextResponse.json(
      { error: "Candidate name is too long" },
      { status: 400 }
    );
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      _count: {
        select: { candidates: true },
      },
    },
  });

  if (!category) {
    return NextResponse.json(
      { error: "Category not found" },
      { status: 404 }
    );
  }

  if (category._count.candidates >= 4) {
    return NextResponse.json(
      { error: "A category can have a maximum of 4 candidates" },
      { status: 409 }
    );
  }

  const candidate = await prisma.candidate.create({
    data: {
      categoryId,
      name,
      imageUrl,
    },
  });

  return NextResponse.json({ candidate });
}

// Body: { id: number }
export async function DELETE(req: Request) {
  const session = await requireAdmin();

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const id = Number(body?.id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "id required" },
      { status: 400 }
    );
  }

  const config = await prisma.pollConfig.findUnique({
    where: { id: 1 },
  });

  if (config?.votingOpen) {
    return NextResponse.json(
      { error: "Candidates cannot be deleted while voting is open" },
      { status: 409 }
    );
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      _count: {
        select: { votes: true },
      },
    },
  });

  if (!candidate) {
    return NextResponse.json(
      { error: "Candidate not found" },
      { status: 404 }
    );
  }

  if (candidate._count.votes > 0) {
    return NextResponse.json(
      {
        error:
          "This candidate has votes and cannot be deleted because deleting them would destroy voting data",
      },
      { status: 409 }
    );
  }

  await prisma.candidate.delete({
    where: { id },
  });

  return NextResponse.json({ removed: id });
}
