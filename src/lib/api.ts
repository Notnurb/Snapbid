import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/auth";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof UnauthorizedError) {
    return jsonError("Unauthorized", 401);
  }
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal server error";
  return jsonError(message, 500);
}
