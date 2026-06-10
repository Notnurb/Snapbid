"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";

interface Item {
  description: string;
  qty: number;
  unit: string;
  unitPriceCents: number | null;
  confidence?: number | null;
  priceItemId?: string | null;
}

interface QuoteData {
  id: string;
  publicToken: string;
  status: string;
  title: string | null;
  clientName: string | null;
  clientEmail: string | null;
  scopeSummary: string | null;
  photos: string[];
  riskFlags: string[];
  depositPct: number;
  subtotalCents: number;
  totalCents: number;
  items: Item[];
}

function centsToInput(cents: number | null): string {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

function fmt(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function QuoteEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [title, setTitle] = useState("");
  const [depositPct, setDepositPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/quotes/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load quote");
        return res.json();
      })
      .then(({ quote }: { quote: QuoteData }) => {
        setQuote(quote);
        setItems(quote.items);
        setClientName(quote.clientName ?? "");
        setClientEmail(quote.clientEmail ?? "");
        setTitle(quote.title ?? "");
        setDepositPct(quote.depositPct);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + Math.round(it.qty * (it.unitPriceCents ?? 0)), 0),
    [items]
  );
  const deposit = Math.round((subtotal * depositPct) / 100);
  const editable = quote ? !["accepted", "declined", "expired"].includes(quote.status) : false;
  const publicLink = quote
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/q/${quote.publicToken}`
    : "";

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
    setDirty(true);
  }

  const save = useCallback(async () => {
    if (!quote) return null;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, clientName, clientEmail, depositPct, items }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      const data = await res.json();
      setQuote(data.quote);
      setItems(data.quote.items);
      setDirty(false);
      return data.quote as QuoteData;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      return null;
    } finally {
      setSaving(false);
    }
  }, [quote, id, title, clientName, clientEmail, depositPct, items]);

  async function sendQuote() {
    setError(null);
    setNotice(null);
    if (!clientEmail.includes("@")) {
      setError("Add the client's email to send the quote.");
      return;
    }
    if (items.some((it) => it.unitPriceCents == null)) {
      setError("Every line item needs a price before sending. Yellow rows are unpriced.");
      return;
    }
    setSending(true);
    const saved = await save();
    if (!saved) {
      setSending(false);
      return;
    }
    try {
      const res = await fetch(`/api/quotes/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientEmail, clientName }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Send failed");
      const data = await res.json();
      setQuote((q) => (q ? { ...q, status: data.quote.status } : q));
      setNotice(`Quote emailed to ${clientEmail} ✓`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(publicLink);
    setNotice("Public link copied to clipboard ✓");
  }

  if (loading) {
    return <main className="p-10 text-center text-zinc-400">Loading quote…</main>;
  }
  if (!quote) {
    return (
      <main className="p-10 text-center">
        <p className="text-red-600">{error ?? "Quote not found"}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-brand-600">
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-zinc-50 px-4 py-6 pb-32">
      <div className="mb-5 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm font-medium text-zinc-500">
          ← Quotes
        </Link>
        <StatusBadge status={quote.status} />
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setDirty(true);
        }}
        disabled={!editable}
        placeholder="Quote title"
        className="w-full rounded-xl border border-transparent bg-transparent text-xl font-extrabold focus:border-zinc-300 focus:bg-white focus:p-2 focus:outline-none"
      />

      {quote.scopeSummary && <p className="mt-1 text-sm text-zinc-500">{quote.scopeSummary}</p>}

      {quote.photos.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {quote.photos.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt="Job photo"
              className="h-24 w-24 shrink-0 rounded-xl border border-zinc-200 object-cover"
            />
          ))}
        </div>
      )}

      {quote.riskFlags.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold tracking-wide text-amber-800 uppercase">⚠ Watch out for</p>
          <ul className="mt-1 list-inside list-disc text-sm text-amber-800">
            {quote.riskFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Client */}
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-bold tracking-wide text-zinc-500 uppercase">Client</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            value={clientName}
            onChange={(e) => {
              setClientName(e.target.value);
              setDirty(true);
            }}
            disabled={!editable}
            placeholder="Client name"
            className="rounded-lg border border-zinc-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            value={clientEmail}
            onChange={(e) => {
              setClientEmail(e.target.value);
              setDirty(true);
            }}
            disabled={!editable}
            type="email"
            placeholder="client@email.com"
            className="rounded-lg border border-zinc-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
      </section>

      {/* Line items */}
      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-bold tracking-wide text-zinc-500 uppercase">Line items</h2>
        <div className="mt-3 space-y-3">
          {items.map((item, i) => {
            const unpriced = item.unitPriceCents == null;
            return (
              <div
                key={i}
                className={`rounded-xl border p-3 ${
                  unpriced ? "border-amber-300 bg-amber-50" : "border-zinc-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                    disabled={!editable}
                    className="w-full rounded-lg border border-transparent bg-transparent text-sm font-semibold focus:border-zinc-300 focus:bg-white focus:outline-none"
                  />
                  {editable && (
                    <button
                      type="button"
                      onClick={() => {
                        setItems((prev) => prev.filter((_, j) => j !== i));
                        setDirty(true);
                      }}
                      className="shrink-0 text-zinc-300 hover:text-red-500"
                      aria-label="Remove line item"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={item.qty}
                    onChange={(e) => updateItem(i, { qty: parseFloat(e.target.value) || 0 })}
                    disabled={!editable}
                    className="w-20 rounded-lg border border-zinc-300 p-1.5 text-right"
                    aria-label="Quantity"
                  />
                  <input
                    value={item.unit}
                    onChange={(e) => updateItem(i, { unit: e.target.value })}
                    disabled={!editable}
                    className="w-24 rounded-lg border border-zinc-300 p-1.5"
                    aria-label="Unit"
                  />
                  <span className="text-zinc-400">×</span>
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-400">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={centsToInput(item.unitPriceCents)}
                      placeholder="price"
                      onChange={(e) =>
                        updateItem(i, {
                          unitPriceCents:
                            e.target.value === ""
                              ? null
                              : Math.round(parseFloat(e.target.value) * 100) || 0,
                        })
                      }
                      disabled={!editable}
                      className={`w-24 rounded-lg border p-1.5 text-right ${
                        unpriced ? "border-amber-400 bg-white" : "border-zinc-300"
                      }`}
                      aria-label="Unit price"
                    />
                  </div>
                  <span className="ml-auto font-bold">
                    {fmt(Math.round(item.qty * (item.unitPriceCents ?? 0)))}
                  </span>
                </div>
                {unpriced && (
                  <p className="mt-1.5 text-xs font-medium text-amber-700">
                    Not in your price book — set a price
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => {
              setItems((prev) => [
                ...prev,
                { description: "New item", qty: 1, unit: "each", unitPriceCents: null },
              ]);
              setDirty(true);
            }}
            className="mt-3 w-full rounded-xl border border-dashed border-zinc-300 py-2.5 text-sm font-semibold text-zinc-500 hover:border-brand-500 hover:text-brand-600"
          >
            + Add line item
          </button>
        )}
      </section>

      {/* Totals + deposit */}
      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between text-lg font-extrabold">
          <span>Total</span>
          <span>{fmt(subtotal)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-zinc-600">
            Deposit
            <input
              type="number"
              min={0}
              max={100}
              value={depositPct}
              onChange={(e) => {
                setDepositPct(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)));
                setDirty(true);
              }}
              disabled={!editable}
              className="w-16 rounded-lg border border-zinc-300 p-1.5 text-right"
            />
            %
          </label>
          <span className="font-semibold text-zinc-700">{fmt(deposit)} due on accept</span>
        </div>
      </section>

      {(error || notice) && (
        <div
          className={`mt-4 rounded-xl border p-3 text-sm ${
            error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {error ?? notice}
        </div>
      )}

      {/* Action bar */}
      <div className="fixed right-0 bottom-0 left-0 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Copy link
          </button>
          {editable && (
            <>
              <button
                type="button"
                onClick={save}
                disabled={saving || !dirty}
                className="rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={sendQuote}
                disabled={sending}
                className="flex-1 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {sending
                  ? "Sending…"
                  : quote.status === "draft"
                    ? "Send to client →"
                    : "Re-send quote"}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
