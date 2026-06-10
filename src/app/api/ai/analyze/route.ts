import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { analyzeJob } from "@/lib/groq";
import { matchPriceItem } from "@/lib/match";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST { imageUrls: string[], description: string }
 * Returns the AI scope analysis with each suggested line item fuzzy-matched
 * against the user's price book. Unmatched items get unit_price_cents: null
 * so the contractor prices them manually in the editor.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const imageUrls: string[] = Array.isArray(body.imageUrls)
      ? body.imageUrls.filter((u: unknown) => typeof u === "string")
      : [];
    const description: string =
      typeof body.description === "string" ? body.description : "";

    if (imageUrls.length === 0 && !description.trim()) {
      return jsonError("Provide at least one photo or a description");
    }

    const [analysis, priceItems] = await Promise.all([
      analyzeJob(imageUrls, description),
      prisma.priceItem.findMany({
        where: { active: true, priceBook: { userId: user.id } },
      }),
    ]);

    const suggested_line_items = analysis.suggested_line_items.map((item) => {
      const match = matchPriceItem(item.description, priceItems);
      return {
        ...item,
        // When matched, adopt the price book's unit so qty x unit_price makes sense.
        unit: match ? match.item.unit : item.unit,
        unit_price_cents: match ? match.item.unitPriceCents : null,
        price_item_id: match ? match.item.id : null,
        matched_name: match ? match.item.name : null,
        match_score: match ? Math.round(match.score * 100) / 100 : null,
      };
    });

    return NextResponse.json({
      scope_summary: analysis.scope_summary,
      suggested_line_items,
      risk_flags: analysis.risk_flags,
      questions: analysis.questions,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
