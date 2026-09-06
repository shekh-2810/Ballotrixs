import { PrismaClient } from "@prisma/client";

// Prevents creating a new PrismaClient (and new DB connections) on every
// hot-reload in dev, and keeps one client per serverless function instance
// in production.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
