import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function defaultPriceBook(userId: string) {
  const existing = await prisma.priceBook.findFirst({ where: { userId } });
  if (existing) return existing;
  return prisma.priceBook.create({ data: { userId, name: "Default" } });
}

export async function GET() {
  try {
    const user = await requireUser();
    const book = await defaultPriceBook(user.id);
    const items = await prisma.priceItem.findMany({
      where: { priceBookId: book.id, active: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ priceBook: book, items });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
    const unit = typeof body.unit === "string" && body.unit ? body.unit.slice(0, 30) : "each";
    const unitPriceCents = Math.max(0, Math.round(Number(body.unitPriceCents)));
    if (!name) return jsonError("Item name is required");
    if (!isFinite(unitPriceCents)) return jsonError("Valid price is required");

    const book = await defaultPriceBook(user.id);
    const item = await prisma.priceItem.create({
      data: { priceBookId: book.id, name, unit, unitPriceCents },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
