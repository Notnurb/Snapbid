import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCents, depositCents } from "@/lib/money";
import { canRemoveBranding, canCollectDeposits } from "@/lib/plans";
import AcceptButtons from "./AcceptButtons";

export const dynamic = "force-dynamic";

export default async function PublicQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { token } = await params;
  const { paid } = await searchParams;

  const quote = await prisma.quote.findUnique({
    where: { publicToken: token },
    include: { items: { orderBy: { sortOrder: "asc" } }, user: true },
  });
  if (!quote || quote.status === "draft") notFound();

  // First open: sent -> viewed, stamp viewed_at, log event.
  if (quote.status === "sent") {
    await prisma.$transaction([
      prisma.quote.update({
        where: { id: quote.id },
        data: { status: "viewed", viewedAt: quote.viewedAt ?? new Date() },
      }),
      prisma.event.create({
        data: { userId: quote.userId, quoteId: quote.id, type: "quote.viewed" },
      }),
    ]);
    quote.status = "viewed";
  }

  const { user } = quote;
  const business = user.businessName || user.name || "Your contractor";
  const color = user.brandColor || "#16a34a";
  const photos = (quote.photos as string[]) ?? [];
  const deposit = depositCents(quote.totalCents, quote.depositPct);
  const collectsDeposit = deposit > 0 && canCollectDeposits(user.plan);
  const isOpen = ["sent", "viewed"].includes(quote.status);
  const justPaid = paid === "1";

  return (
    <main className="min-h-screen bg-zinc-100 pb-40">
      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Branded header */}
        <header className="flex items-center gap-3">
          {user.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.logoUrl} alt={business} className="h-12 max-w-[160px] object-contain" />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-extrabold text-white"
              style={{ backgroundColor: color }}
            >
              {business.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-bold">{business}</p>
            <p className="text-sm text-zinc-500">
              Quote for {quote.clientName || "you"}
              {quote.expiresAt && isOpen && (
                <> · valid until {new Date(quote.expiresAt).toLocaleDateString()}</>
              )}
            </p>
          </div>
        </header>

        {(quote.status === "accepted" || justPaid) && (
          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
            <p className="text-2xl">🎉</p>
            <p className="mt-1 font-bold text-green-800">
              {justPaid ? "Deposit paid — you're booked!" : "Quote accepted!"}
            </p>
            <p className="mt-1 text-sm text-green-700">{business} will be in touch shortly.</p>
          </div>
        )}
        {quote.status === "declined" && (
          <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 text-center text-sm text-zinc-500">
            This quote was declined. Changed your mind? Reply to the quote email.
          </div>
        )}
        {quote.status === "expired" && (
          <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 text-center text-sm text-zinc-500">
            This quote has expired. Contact {business} for an updated price.
          </div>
        )}

        {/* Job photos */}
        {photos.length > 0 && (
          <div className="mt-5 flex gap-2 overflow-x-auto">
            {photos.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt="Job photo"
                className="h-32 w-32 shrink-0 rounded-2xl border border-zinc-200 object-cover"
              />
            ))}
          </div>
        )}

        {/* Scope + line items */}
        <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5">
          <h1 className="text-lg font-extrabold">{quote.title || "Your quote"}</h1>
          {quote.scopeSummary && (
            <p className="mt-1 text-sm leading-6 text-zinc-600">{quote.scopeSummary}</p>
          )}

          <ul className="mt-4 divide-y divide-zinc-100">
            {quote.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold">{item.description}</p>
                  <p className="text-xs text-zinc-400">
                    {item.qty} {item.unit}
                    {item.unitPriceCents != null && <> × {formatCents(item.unitPriceCents)}</>}
                  </p>
                </div>
                <span className="text-sm font-bold whitespace-nowrap">
                  {formatCents(item.lineTotalCents)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-2 border-t border-zinc-200 pt-3">
            <div className="flex items-center justify-between text-lg font-extrabold">
              <span>Total</span>
              <span>{formatCents(quote.totalCents)}</span>
            </div>
            {collectsDeposit && isOpen && (
              <p className="mt-1 text-right text-sm text-zinc-500">
                {quote.depositPct}% deposit today: <strong>{formatCents(deposit)}</strong> · balance
                on completion
              </p>
            )}
          </div>
        </section>

        {quote.notes && (
          <p className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm whitespace-pre-wrap text-zinc-600">
            {quote.notes}
          </p>
        )}

        {!canRemoveBranding(user.plan) && (
          <p className="mt-8 text-center text-xs text-zinc-400">
            Powered by <span className="font-bold">SnapBid</span> — photo to paid quote in 60
            seconds
          </p>
        )}
      </div>

      {isOpen && !justPaid && (
        <AcceptButtons
          token={token}
          depositLabel={collectsDeposit ? `Accept & pay ${formatCents(deposit)} deposit` : "Accept quote"}
          brandColor={color}
        />
      )}
    </main>
  );
}
