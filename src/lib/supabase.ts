import { createClient } from "@supabase/supabase-js";

export const PHOTOS_BUCKET = "job-photos";

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars are not configured");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export function publicPhotoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTOS_BUCKET}/${path}`;
}
