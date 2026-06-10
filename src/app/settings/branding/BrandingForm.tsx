"use client";

import { useState } from "react";

interface Branding {
  businessName: string;
  logoUrl: string;
  brandColor: string;
  replyToEmail: string;
  defaultDepositPct: number;
  plan: "free" | "pro" | "crew";
}

const PLAN_COPY: Record<Branding["plan"], string> = {
  free: "Free — 5 quotes/mo, SnapBid branding on quotes",
  pro: "Pro — unlimited quotes, custom branding, deposits",
  crew: "Crew — Pro + 5 seats, shared price book, auto follow-ups",
};

export default function BrandingForm({ initial }: { initial: Branding }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [billingBusy, setBillingBusy] = useState<string | null>(null);

  const isFree = initial.plan === "free";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setMessage({ ok: true, text: "Saved ✓" });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function upgrade(plan: "pro" | "crew") {
    setBillingBusy(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Checkout failed" });
      setBillingBusy(null);
    }
  }

  async function openPortal() {
    setBillingBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open billing portal");
      window.location.href = data.portalUrl;
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Failed" });
      setBillingBusy(null);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-bold tracking-wide text-zinc-500 uppercase">Branding</h2>

        <label className="block">
          <span className="text-sm font-semibold">Business name</span>
          <input
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            placeholder="GreenLine Lawn Care"
            className="mt-1 w-full rounded-lg border border-zinc-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">
            Logo URL {isFree && <em className="font-normal text-zinc-400">(Pro)</em>}
          </span>
          <input
            value={form.logoUrl}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
            placeholder="https://…/logo.png"
            disabled={isFree}
            className="mt-1 w-full rounded-lg border border-zinc-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-400"
          />
        </label>

        <div className="flex flex-wrap gap-4">
          <label className="block">
            <span className="text-sm font-semibold">Brand color</span>
            <span className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={form.brandColor}
                onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                disabled={isFree}
                className="h-10 w-14 cursor-pointer rounded border border-zinc-300 disabled:cursor-not-allowed"
              />
              <code className="text-sm text-zinc-500">{form.brandColor}</code>
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-semibold">Default deposit %</span>
            <input
              type="number"
              min={0}
              max={100}
              value={form.defaultDepositPct}
              onChange={(e) =>
                setForm({ ...form, defaultDepositPct: parseInt(e.target.value) || 0 })
              }
              className="mt-1 w-24 rounded-lg border border-zinc-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold">Reply-to email</span>
          <input
            type="email"
            value={form.replyToEmail}
            onChange={(e) => setForm({ ...form, replyToEmail: e.target.value })}
            placeholder="you@yourbusiness.com"
            className="mt-1 w-full rounded-lg border border-zinc-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>

        {message && (
          <p className={`text-sm font-medium ${message.ok ? "text-green-600" : "text-red-600"}`}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-bold tracking-wide text-zinc-500 uppercase">Plan & billing</h2>
        <p className="mt-2 text-sm text-zinc-600">{PLAN_COPY[initial.plan]}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {isFree ? (
            <>
              <button
                type="button"
                onClick={() => upgrade("pro")}
                disabled={billingBusy !== null}
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {billingBusy === "pro" ? "Opening…" : "Upgrade to Pro — $29/mo"}
              </button>
              <button
                type="button"
                onClick={() => upgrade("crew")}
                disabled={billingBusy !== null}
                className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                {billingBusy === "crew" ? "Opening…" : "Get Crew — $59/mo"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={openPortal}
              disabled={billingBusy !== null}
              className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              {billingBusy === "portal" ? "Opening…" : "Manage billing"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
