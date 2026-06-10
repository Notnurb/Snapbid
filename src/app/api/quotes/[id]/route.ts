import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { quoteTotals, lineTotal } from "@/lib/money";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

interface ItemInput {
  description: string;
  qty: number;
  unit: string;
  unitPriceCents: number | null;
  confidence: number | null;
  priceItemId: string | null;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const quote = await prisma.quote.findFirst({
      where: { id, userId: user.id },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        payments: true,
      },
    });
    if (!quote) return jsonError("Quote not found", 404);
    return NextResponse.json({ quote });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await prisma.quote.findFirst({ where: { id, userId: user.id } });
    if (!existing) return jsonError("Quote not found", 404);
    if (existing.status === "accepted") {
      return jsonError("Accepted quotes can no longer be edited", 409);
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.title === "string") data.title = body.title.slice(0, 150);
    if (typeof body.clientName === "string") data.clientName = body.clientName.slice(0, 100);
    if (typeof body.clientEmail === "string") data.clientEmail = body.clientEmail.slice(0, 200);
    if (typeof body.clientPhone === "string") data.clientPhone = body.clientPhone.slice(0, 30);
    if (typeof body.notes === "string") data.notes = body.notes.slice(0, 2000);
    if (typeof body.scopeSummary === "string") data.scopeSummary = body.scopeSummary.slice(0, 2000);
    if (typeof body.depositPct === "number") {
      data.depositPct = Math.min(100, Math.max(0, Math.round(body.depositPct)));
    }
    if (body.status === "declined" && existing.status !== "draft") {
      data.status = "declined";
      data.declinedAt = new Date();
    }

    let itemsUpdate = undefined;
    if (Array.isArray(body.items)) {
      const items: ItemInput[] = body.items
        .map((it: Record<string, unknown>) => ({
          description: String(it.description ?? "").slice(0, 300),
          qty: Number(it.qty) > 0 ? Number(it.qty) : 1,
          unit: String(it.unit ?? "each").slice(0, 30),
          unitPriceCents:
            it.unitPriceCents == null
              ? null
              : Math.max(0, Math.round(Number(it.unitPriceCents))),
          confidence: it.confidence == null ? null : Number(it.confidence),
          priceItemId: typeof it.priceItemId === "string" ? it.priceItemId : null,
        }))
        .filter((it: ItemInput) => it.description);

      const { subtotalCents, totalCents } = quoteTotals(items);
      data.subtotalCents = subtotalCents;
      data.totalCents = totalCents;
      itemsUpdate = {
        deleteMany: {},
        create: items.map((it, i) => ({
          description: it.description,
          qty: it.qty,
          unit: it.unit,
          unitPriceCents: it.unitPriceCents,
          lineTotalCents: lineTotal(it.qty, it.unitPriceCents),
          confidence: it.confidence,
          priceItemId: it.priceItemId,
          sortOrder: i,
        })),
      };
    }

    const quote = await prisma.quote.update({
      where: { id },
      data: { ...data, ...(itemsUpdate ? { items: itemsUpdate } : {}) },
      include: { items: { orderBy: { sortOrder: "asc" } }, payments: true },
    });

    return NextResponse.json({ quote });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await prisma.quote.findFirst({ where: { id, userId: user.id } });
    if (!existing) return jsonError("Quote not found", 404);
    await prisma.quote.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
