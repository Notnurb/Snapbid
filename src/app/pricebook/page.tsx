"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

interface PriceItem {
  id: string;
  name: string;
  unit: string;
  unitPriceCents: number;
}

const COMMON_UNITS = ["each", "sqft", "linear ft", "hour", "job", "yard", "panel"];

function fmt(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function PriceBookPage() {
  const [items, setItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("each");
  const [price, setPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");

  useEffect(() => {
    fetch("/api/pricebook")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load");
        return res.json();
      })
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !price) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/pricebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          unit,
          unitPriceCents: Math.round(parseFloat(price) * 100),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to add");
      const { item } = await res.json();
      setItems((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setPrice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  async function savePrice(id: string) {
    const cents = Math.round(parseFloat(editPrice) * 100);
    if (!isFinite(cents) || cents < 0) return;
    const res = await fetch(`/api/pricebook/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitPriceCents: cents }),
    });
    if (res.ok) {
      const { item } = await res.json();
      setItems((prev) => prev.map((it) => (it.id === id ? item : it)));
    }
    setEditingId(null);
  }

  async function removeItem(id: string) {
    if (!confirm("Remove this item from your price book?")) return;
    const res = await fetch(`/api/pricebook/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((it) => it.id !== id));
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-extrabold tracking-tight">Price book</h1>
      <p className="mt-1 text-sm text-zinc-500">
        AI prices new quotes from this list. Items it can&apos;t match show up unpriced for you to
        fill in.
      </p>

      <form
        onSubmit={addItem}
        className="mt-5 flex flex-wrap items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-4"
      >
        <label className="min-w-44 flex-1">
          <span className="text-xs font-semibold text-zinc-500">Service / item</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pressure wash driveway"
            className="mt-1 w-full rounded-lg border border-zinc-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label>
          <span className="text-xs font-semibold text-zinc-500">Unit</span>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="mt-1 rounded-lg border border-zinc-300 bg-white p-2.5 text-sm"
          >
            {COMMON_UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-semibold text-zinc-500">Price ($)</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            min={0}
            step="0.01"
            placeholder="0.35"
            className="mt-1 w-28 rounded-lg border border-zinc-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={adding || !name.trim() || !price}
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-center text-zinc-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          No items yet. Add your common services — e.g. “Mow & edge lawn / each / $60” or “Fence
          install / linear ft / $32”.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-zinc-400">per {item.unit}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {editingId === item.id ? (
                  <span className="flex items-center gap-1">
                    $
                    <input
                      autoFocus
                      type="number"
                      min={0}
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      onBlur={() => savePrice(item.id)}
                      onKeyDown={(e) => e.key === "Enter" && savePrice(item.id)}
                      className="w-24 rounded-lg border border-brand-500 p-1.5 text-right text-sm"
                    />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditPrice((item.unitPriceCents / 100).toFixed(2));
                    }}
                    className="text-sm font-bold hover:text-brand-600"
                    title="Click to edit price"
                  >
                    {fmt(item.unitPriceCents)}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-zinc-300 hover:text-red-500"
                  aria-label={`Remove ${item.name}`}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
