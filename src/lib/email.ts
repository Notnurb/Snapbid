import { Resend } from "resend";
import type { Quote, User } from "@prisma/client";
import { formatCents } from "@/lib/money";
import { canRemoveBranding } from "@/lib/plans";

function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(key);
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function fromAddress() {
  return process.env.RESEND_FROM_EMAIL ?? "SnapBid <onboarding@resend.dev>";
}

function quoteEmailHtml(opts: {
  user: User;
  quote: Quote;
  heading: string;
  intro: string;
}) {
  const { user, quote, heading, intro } = opts;
  const business = user.businessName || user.name || "Your contractor";
  const link = `${appUrl()}/q/${quote.publicToken}`;
  const color = user.brandColor || "#16a34a";
  const branding = canRemoveBranding(user.plan)
    ? ""
    : `<p style="color:#9ca3af;font-size:12px;margin-top:32px;">Sent with <a href="${appUrl()}" style="color:#9ca3af;">SnapBid</a> — photo to paid quote in 60 seconds.</p>`;

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e4e4e7;">
      ${user.logoUrl ? `<img src="${user.logoUrl}" alt="${business}" style="max-height:48px;margin-bottom:16px;" />` : ""}
      <h1 style="font-size:20px;margin:0 0 8px;color:#18181b;">${heading}</h1>
      <p style="color:#52525b;font-size:15px;line-height:1.6;">${intro}</p>
      <p style="color:#52525b;font-size:15px;">
        <strong>${quote.title || "Your quote"}</strong><br/>
        Total: <strong>${formatCents(quote.totalCents)}</strong>
      </p>
      <a href="${link}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;margin-top:8px;">
        View &amp; accept quote
      </a>
      <p style="color:#a1a1aa;font-size:13px;margin-top:24px;">From ${business}${user.replyToEmail ? ` · Reply to this email to reach us` : ""}</p>
    </div>
    ${branding}
  </div>
</body></html>`;
}

export async function sendQuoteEmail(user: User, quote: Quote) {
  if (!quote.clientEmail) throw new Error("Quote has no client email");
  const business = user.businessName || user.name || "Your contractor";
  await resend().emails.send({
    from: fromAddress(),
    to: quote.clientEmail,
    replyTo: user.replyToEmail ?? undefined,
    subject: `${business} sent you a quote — ${formatCents(quote.totalCents)}`,
    html: quoteEmailHtml({
      user,
      quote,
      heading: `${business} sent you a quote`,
      intro:
        quote.scopeSummary ||
        "Review the itemized quote below and accept online in one tap.",
    }),
  });
}

export async function sendFollowupEmail(user: User, quote: Quote, kind: string) {
  if (!quote.clientEmail) return;
  const business = user.businessName || user.name || "Your contractor";
  const isFirst = kind === "24h";
  await resend().emails.send({
    from: fromAddress(),
    to: quote.clientEmail,
    replyTo: user.replyToEmail ?? undefined,
    subject: isFirst
      ? `Reminder: your quote from ${business}`
      : `Last call: your quote from ${business} is waiting`,
    html: quoteEmailHtml({
      user,
      quote,
      heading: isFirst ? "Your quote is waiting" : "Still interested?",
      intro: isFirst
        ? `Just a quick reminder — ${business} sent you a quote and it's ready to review.`
        : `${business} is holding your spot. Quotes like this fill up fast, so take a look when you get a minute.`,
    }),
  });
}
