export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function dollarsToCents(value: string | number): number {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function lineTotal(qty: number, unitPriceCents: number | null): number {
  if (unitPriceCents == null) return 0;
  return Math.round(qty * unitPriceCents);
}

export function quoteTotals(
  items: { qty: number; unitPriceCents: number | null }[],
  taxRateBps = 0
) {
  const subtotalCents = items.reduce(
    (sum, it) => sum + lineTotal(it.qty, it.unitPriceCents),
    0
  );
  const taxCents = Math.round((subtotalCents * taxRateBps) / 10000);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

export function depositCents(totalCents: number, depositPct: number): number {
  return Math.round((totalCents * depositPct) / 100);
}
