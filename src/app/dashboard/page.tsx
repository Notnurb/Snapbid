import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { FREE_QUOTE_LIMIT, monthStart, PLAN_LABELS } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [quotes, usedThisMonth] = await Promise.all([
    prisma.quote.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.quote.count({
      where: { userId: user.id, createdAt: { gte: monthStart() } },
    }),
  ]);

  const atLimit = user.plan === "free" && usedThisMonth >= FREE_QUOTE_LIMIT;

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Quotes</h1>
          <p className="text-sm text-zinc-500">
            {PLAN_LABELS[user.plan]} plan
            {user.plan === "free" && ` · ${usedThisMonth}/${FREE_QUOTE_LIMIT} quotes this month`}
          </p>
        </div>
      </div>

      {atLimit && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You&apos;ve used all {FREE_QUOTE_LIMIT} free quotes this month.{" "}
          <Link href="/settings/branding" className="font-semibold underline">
            Upgrade to Pro
          </Link>{" "}
          for unlimited quotes.
        </div>
      )}

      {quotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="text-4xl">📸</p>
          <h2 className="mt-3 text-lg font-bold">Quote your first job</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
            Snap photos, type one line, and send a paid quote before you leave the driveway.
          </p>
          <Link
            href="/quotes/new"
            className="mt-5 inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
          >
            + New quote
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link
                href={`/quotes/${q.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 hover:border-brand-500"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {q.title || q.scopeSummary || "Untitled quote"}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-zinc-500">
                    {q.clientName || q.clientEmail || "No client yet"} ·{" "}
                    {new Date(q.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-bold">{formatCents(q.totalCents)}</span>
                  <StatusBadge status={q.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
