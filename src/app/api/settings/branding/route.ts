import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (typeof body.businessName === "string") {
      data.businessName = body.businessName.trim().slice(0, 150) || null;
    }
    if (typeof body.logoUrl === "string") {
      const url = body.logoUrl.trim();
      if (url && !/^https:\/\//.test(url)) return jsonError("Logo URL must be https");
      data.logoUrl = url || null;
    }
    if (typeof body.brandColor === "string") {
      if (!/^#[0-9a-fA-F]{6}$/.test(body.brandColor)) {
        return jsonError("Brand color must be a hex value like #16a34a");
      }
      data.brandColor = body.brandColor;
    }
    if (typeof body.replyToEmail === "string") {
      const email = body.replyToEmail.trim();
      if (email && !email.includes("@")) return jsonError("Invalid reply-to email");
      data.replyToEmail = email || null;
    }
    if (body.defaultDepositPct != null) {
      const pct = Math.round(Number(body.defaultDepositPct));
      if (!isFinite(pct) || pct < 0 || pct > 100) {
        return jsonError("Deposit must be between 0 and 100%");
      }
      data.defaultDepositPct = pct;
    }

    const updated = await prisma.user.update({ where: { id: user.id }, data });
    return NextResponse.json({
      user: {
        businessName: updated.businessName,
        logoUrl: updated.logoUrl,
        brandColor: updated.brandColor,
        replyToEmail: updated.replyToEmail,
        defaultDepositPct: updated.defaultDepositPct,
        plan: updated.plan,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
