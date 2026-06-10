import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { quoteTotals, lineTotal } from "@/lib/money";
import { FREE_QUOTE_LIMIT, monthStart } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const quotes = await prisma.quote.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: { sortOrder: "asc" } } },
      take: 100,
    });
    return NextResponse.json({ quotes });
  } catch (err) {
    return handleApiError(err);
  }
}

interface ItemInput {
  description: string;
  qty: number;
  unit: string;
  unitPriceCents: number | null;
  confidence?: number | null;
  priceItemId?: string | null;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    if (user.plan === "free") {
      const used = await prisma.quote.count({
        where: { userId: user.id, createdAt: { gte: monthStart() } },
      });
      if (used >= FREE_QUOTE_LIMIT) {
        return jsonError(
          `Free plan is limited to ${FREE_QUOTE_LIMIT} quotes per month. Upgrade to Pro for unlimited quotes.`,
          402
        );
      }
    }

    const body = await req.json();
    const items: ItemInput[] = (Array.isArray(body.items) ? body.items : [])
      .map((it: Record<string, unknown>) => ({
        description: String(it.description ?? "").slice(0, 300),
        qty: Number(it.qty) > 0 ? Number(it.qty) : 1,
        unit: String(it.unit ?? "each").slice(0, 30),
        unitPriceCents:
          it.unitPriceCents == null ? null : Math.max(0, Math.round(Number(it.unitPriceCents))),
        confidence: it.confidence == null ? null : Number(it.confidence),
        priceItemId: typeof it.priceItemId === "string" ? it.priceItemId : null,
      }))
      .filter((it: ItemInput) => it.description);

    const { subtotalCents, totalCents } = quoteTotals(items);

    const quote = await prisma.quote.create({
      data: {
        userId: user.id,
        title: typeof body.title === "string" ? body.title.slice(0, 150) : null,
        description:
          typeof body.description === "string" ? body.description.slice(0, 2000) : null,
        scopeSummary:
          typeof body.scopeSummary === "string" ? body.scopeSummary.slice(0, 2000) : null,
        photos: Array.isArray(body.photos)
          ? body.photos.filter((p: unknown) => typeof p === "string").slice(0, 10)
          : [],
        riskFlags: Array.isArray(body.riskFlags)
          ? body.riskFlags.filter((f: unknown) => typeof f === "string").slice(0, 10)
          : [],
        clientName: typeof body.clientName === "string" ? body.clientName.slice(0, 100) : null,
        clientEmail: typeof body.clientEmail === "string" ? body.clientEmail.slice(0, 200) : null,
        clientPhone: typeof body.clientPhone === "string" ? body.clientPhone.slice(0, 30) : null,
        depositPct: user.plan === "free" ? 0 : user.defaultDepositPct,
        subtotalCents,
        totalCents,
        items: {
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
        },
      },
      include: { items: true },
    });

    await prisma.event.create({
      data: { userId: user.id, quoteId: quote.id, type: "quote.created" },
    });

    return NextResponse.json({ quote }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
