"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcceptButtons({
  token,
  depositLabel,
  brandColor,
}: {
  token: string;
  depositLabel: string;
  brandColor: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy("accept");
    setError(null);
    try {
      const res = await fetch(`/api/q/${token}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(null);
    }
  }

  async function decline() {
    if (!confirm("Decline this quote?")) return;
    setBusy("decline");
    setError(null);
    try {
      const res = await fetch(`/api/q/${token}/decline`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Something went wrong");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(null);
    }
  }

  return (
    <div className="fixed right-0 bottom-0 left-0 border-t border-zinc-200 bg-white/95 p-4 backdrop-blur">
      <div className="mx-auto max-w-lg">
        {error && <p className="mb-2 text-center text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={accept}
          disabled={busy !== null}
          style={{ backgroundColor: brandColor }}
          className="w-full rounded-xl py-4 text-base font-bold text-white shadow-sm disabled:opacity-60"
        >
          {busy === "accept" ? "One sec…" : depositLabel}
        </button>
        <button
          type="button"
          onClick={decline}
          disabled={busy !== null}
          className="mt-2 w-full py-2 text-sm font-medium text-zinc-400 hover:text-zinc-600 disabled:opacity-60"
        >
          {busy === "decline" ? "…" : "No thanks"}
        </button>
      </div>
    </div>
  );
}
