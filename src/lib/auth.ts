import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

/**
 * Resolves the Clerk session to our local User row, creating it (plus a
 * default price book) on first sign-in. Returns null when signed out.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const cu = await currentUser();
  if (!cu) return null;
  const email =
    cu.primaryEmailAddress?.emailAddress ??
    cu.emailAddresses[0]?.emailAddress ??
    `${clerkId}@placeholder.snapbid`;

  return prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: {
      clerkId,
      email,
      name: [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null,
      priceBooks: { create: { name: "Default" } },
    },
  });
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
