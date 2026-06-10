import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const quotes = await prisma.quote.findMany({
    where: { userId: user.id },
    select: {
      status: true,
      totalCents: true,
      sentAt: true,
      viewedAt: true,
      acceptedAt: true,
      createdAt: true,
    },
  });

  const total = quotes.length;
  const sentQuotes = quotes.filter((q) => q.sentAt);
  const accepted = quotes.filter((q) => q.status === "accepted");
  const viewed = quotes.filter((q) => q.viewedAt);

  const winRate = sentQuotes.length > 0 ? (accepted.length / sentQuotes.length) * 100 : 0;
  const openRate = sentQuotes.length > 0 ? (viewed.length / sentQuotes.length) * 100 : 0;
  const pipelineValue = quotes
    .filter((q) => ["sent", "viewed"].includes(q.status))
    .reduce((sum, q) => sum + q.totalCents, 0);
  const wonValue = accepted.reduce((sum, q) => sum + q.totalCents, 0);

  const acceptTimes = accepted
    .filter((q) => q.sentAt && q.acceptedAt)
    .map((q) => q.acceptedAt!.getTime() - q.sentAt!.getTime());
  const avgAcceptHours =
    acceptTimes.length > 0
      ? acceptTimes.reduce((a, b) => a + b, 0) / acceptTimes.length / 36e5
      : null;

  const byStatus = ["draft", "sent", "viewed", "accepted", "declined", "expired"].map(
    (status) => ({
      status,
      count: quotes.filter((q) => q.status === status).length,
    })
  );

  const stats: { label: string; value: string; sub?: string }[] = [
    { label: "Quotes created", value: String(total) },
    {
      label: "Win rate",
      value: `${winRate.toFixed(0)}%`,
      sub: `${accepted.length} of ${sentQuotes.length} sent`,
    },
    { label: "Open rate", value: `${openRate.toFixed(0)}%`, sub: "of sent quotes viewed" },
    { label: "Won", value: formatCents(wonValue), sub: "accepted quote value" },
    { label: "In pipeline", value: formatCents(pipelineValue), sub: "sent, awaiting answer" },
    {
      label: "Avg. time to accept",
      value: avgAcceptHours == null ? "—" : `${avgAcceptHours.toFixed(1)}h`,
      sub: "from send to accept",
    },
  ];

  return (
    <AppShell>
      <h1 className="text-2xl font-extrabold tracking-tight">Analytics</h1>
      <p className="mt-1 text-sm text-zinc-500">All-time numbers across your quotes.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">{s.label}</p>
            <p className="mt-1 text-2xl font-extrabold">{s.value}</p>
            {s.sub && <p className="mt-0.5 text-xs text-zinc-400">{s.sub}</p>}
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-bold tracking-wide text-zinc-500 uppercase">By status</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {byStatus.map(({ status, count }) => (
          <div
            key={status}
            className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 text-sm last:border-0"
          >
            <span className="font-medium capitalize">{status}</span>
            <span className="font-bold">{count}</span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
