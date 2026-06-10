import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await prisma.priceItem.findFirst({
      where: { id, priceBook: { userId: user.id } },
    });
    if (!existing) return jsonError("Item not found", 404);

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim().slice(0, 200);
    }
    if (typeof body.unit === "string" && body.unit) data.unit = body.unit.slice(0, 30);
    if (body.unitPriceCents != null && isFinite(Number(body.unitPriceCents))) {
      data.unitPriceCents = Math.max(0, Math.round(Number(body.unitPriceCents)));
    }

    const item = await prisma.priceItem.update({ where: { id }, data });
    return NextResponse.json({ item });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await prisma.priceItem.findFirst({
      where: { id, priceBook: { userId: user.id } },
    });
    if (!existing) return jsonError("Item not found", 404);

    // Soft delete so historical quote items keep their reference.
    await prisma.priceItem.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
