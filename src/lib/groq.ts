const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export interface AiLineItem {
  description: string;
  qty: number;
  unit: string;
  confidence: number;
}

export interface AiAnalysis {
  scope_summary: string;
  suggested_line_items: AiLineItem[];
  risk_flags: string[];
  questions: string[];
}

const SYSTEM_PROMPT = `You are an estimator for home service businesses (lawn care, pressure washing, fencing, painting, junk removal, and similar trades). You are given photos of a job site and a short description from the contractor.

Respond with STRICT JSON only, matching exactly this schema:
{
  "scope_summary": string,            // 1-3 sentence plain-English summary of the work
  "suggested_line_items": [           // itemized work, most significant first
    {
      "description": string,          // short contractor-style line item, e.g. "Pressure wash driveway"
      "qty": number,                  // estimated quantity (default 1)
      "unit": string,                 // e.g. "sqft", "linear ft", "each", "hour", "job"
      "confidence": number            // 0-1, how confident you are in this item and qty
    }
  ],
  "risk_flags": [string],             // hazards / things that could blow up the price (slope, access, rot, lead paint...)
  "questions": [string]               // clarifying questions the contractor should answer or ask the client
}

Rules:
- Estimate quantities from the photos when possible (e.g. fence length, driveway area). Use the contractor's description as the source of truth when it conflicts with the photos.
- Never include prices. Pricing comes from the contractor's price book.
- 3-8 line items typical. Keep descriptions short and concrete.
- If the photos are unusable, still produce your best line items from the description and add a question about photos.`;

export async function analyzeJob(
  imageUrls: string[],
  description: string
): Promise<AiAnalysis> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: `Job description from contractor: ${description || "(none provided)"}`,
    },
    ...imageUrls.slice(0, 5).map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    })),
  ];

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API error ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Groq returned an empty response");

  return sanitizeAnalysis(JSON.parse(raw));
}

function sanitizeAnalysis(parsed: unknown): AiAnalysis {
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const items = Array.isArray(obj.suggested_line_items)
    ? obj.suggested_line_items
    : [];
  return {
    scope_summary: typeof obj.scope_summary === "string" ? obj.scope_summary : "",
    suggested_line_items: items
      .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
      .map((it) => ({
        description: String(it.description ?? "").slice(0, 200),
        qty: Number(it.qty) > 0 ? Number(it.qty) : 1,
        unit: typeof it.unit === "string" && it.unit ? it.unit : "each",
        confidence: clamp01(Number(it.confidence)),
      }))
      .filter((it) => it.description.length > 0)
      .slice(0, 12),
    risk_flags: toStringArray(obj.risk_flags),
    questions: toStringArray(obj.questions),
  };
}

function clamp01(n: number): number {
  if (!isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function toStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((s): s is string => typeof s === "string").slice(0, 10)
    : [];
}
