const STYLES: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-amber-100 text-amber-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  expired: "bg-zinc-100 text-zinc-400",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
        STYLES[status] ?? STYLES.draft
      }`}
    >
      {status}
    </span>
  );
}
