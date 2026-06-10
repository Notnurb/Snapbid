import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { supabaseAdmin, PHOTOS_BUCKET, publicPhotoUrl } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Issues a signed upload URL so job photos go straight from the phone to
// Supabase Storage without passing through the Vercel function body limit.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { fileName, contentType } = await req.json();
    if (typeof contentType !== "string" || !contentType.startsWith("image/")) {
      return jsonError("Only image uploads are allowed");
    }

    const ext = String(fileName ?? "photo.jpg")
      .split(".")
      .pop()
      ?.replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 8) || "jpg";
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const supabase = supabaseAdmin();
    // Idempotent: succeeds the first time, errors harmlessly after.
    await supabase.storage
      .createBucket(PHOTOS_BUCKET, { public: true })
      .catch(() => undefined);

    const { data, error } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      return jsonError(error?.message ?? "Failed to create upload URL", 500);
    }

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      path,
      publicUrl: publicPhotoUrl(path),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
