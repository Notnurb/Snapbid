"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PhotoUpload {
  previewUrl: string;
  publicUrl: string | null;
  uploading: boolean;
  error: string | null;
}

export default function NewQuotePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoUpload[]>([]);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File, index: number) {
    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
      const { uploadUrl, publicUrl } = await res.json();

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("Photo upload failed");

      setPhotos((prev) =>
        prev.map((p, i) => (i === index ? { ...p, publicUrl, uploading: false } : p))
      );
    } catch (err) {
      setPhotos((prev) =>
        prev.map((p, i) =>
          i === index
            ? { ...p, uploading: false, error: err instanceof Error ? err.message : "Failed" }
            : p
        )
      );
    }
  }

  function onFilesSelected(files: FileList | null) {
    if (!files) return;
    const startIndex = photos.length;
    const selected = Array.from(files).slice(0, 10 - photos.length);
    setPhotos((prev) => [
      ...prev,
      ...selected.map((f) => ({
        previewUrl: URL.createObjectURL(f),
        publicUrl: null,
        uploading: true,
        error: null,
      })),
    ]);
    selected.forEach((file, i) => uploadFile(file, startIndex + i));
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function createQuote() {
    setError(null);
    const imageUrls = photos
      .map((p) => p.publicUrl)
      .filter((u): u is string => !!u);
    if (imageUrls.length === 0 && !description.trim()) {
      setError("Add at least one photo or a one-line description.");
      return;
    }
    if (photos.some((p) => p.uploading)) {
      setError("Photos are still uploading — give it a second.");
      return;
    }

    setBusy(true);
    try {
      setStep("AI is reading the job…");
      const analyzeRes = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls, description }),
      });
      if (!analyzeRes.ok) {
        throw new Error((await analyzeRes.json()).error ?? "AI analysis failed");
      }
      const analysis = await analyzeRes.json();

      setStep("Drafting your quote…");
      const quoteRes = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: analysis.scope_summary?.slice(0, 80) || description.slice(0, 80) || null,
          description,
          scopeSummary: analysis.scope_summary,
          photos: imageUrls,
          riskFlags: analysis.risk_flags,
          items: (analysis.suggested_line_items ?? []).map(
            (it: {
              description: string;
              qty: number;
              unit: string;
              unit_price_cents: number | null;
              price_item_id: string | null;
              confidence: number;
            }) => ({
              description: it.description,
              qty: it.qty,
              unit: it.unit,
              unitPriceCents: it.unit_price_cents,
              priceItemId: it.price_item_id,
              confidence: it.confidence,
            })
          ),
        }),
      });
      if (!quoteRes.ok) {
        throw new Error((await quoteRes.json()).error ?? "Could not create quote");
      }
      const { quote } = await quoteRes.json();
      router.push(`/quotes/${quote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
      setStep(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-zinc-50 px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm font-medium text-zinc-500">
          ← Back
        </Link>
        <h1 className="text-lg font-extrabold">New quote</h1>
        <span className="w-12" />
      </div>

      {/* Camera-first photo capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          onFilesSelected(e.target.files);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-500 bg-white py-10 hover:bg-brand-50 disabled:opacity-50"
      >
        <span className="text-4xl">📸</span>
        <span className="mt-2 font-bold text-brand-700">Snap job photos</span>
        <span className="mt-1 text-xs text-zinc-400">Tap to open camera or pick from gallery</span>
      </button>

      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.previewUrl} alt={`Job photo ${i + 1}`} className="h-full w-full object-cover" />
              {photo.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold text-white">
                  Uploading…
                </div>
              )}
              {photo.error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-600/70 p-1 text-center text-[10px] font-semibold text-white">
                  {photo.error}
                </div>
              )}
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                aria-label="Remove photo"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="mt-6 block">
        <span className="text-sm font-semibold text-zinc-700">Describe the job in one line</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder='e.g. "~80ft cedar fence, 3 rotted posts, haul away old material"'
          className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white p-3 text-base focus:border-brand-500 focus:outline-none"
          disabled={busy}
        />
      </label>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={createQuote}
        disabled={busy}
        className="mt-6 w-full rounded-xl bg-brand-600 py-4 text-base font-bold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? (step ?? "Working…") : "⚡ Draft my quote"}
      </button>
      <p className="mt-2 text-center text-xs text-zinc-400">
        AI itemizes the work and prices it from your price book. You review before anything sends.
      </p>
    </main>
  );
}
