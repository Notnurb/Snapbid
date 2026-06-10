# SnapBid

**Photo to paid quote in 60 seconds** — for lawn care, pressure washing, fencing, painting, and junk removal crews.

Snap photos of the job, type one line ("~80ft fence, 3 rotted posts"), AI drafts an itemized quote priced from your price book, you tweak and send a branded link. The client taps **Accept** and pays a deposit via Stripe. Auto follow-ups go out at 24h/72h if the quote sits unanswered.

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS v4
- **Clerk** — auth
- **Prisma + Supabase Postgres** — data
- **Supabase Storage** — job photos (direct signed-URL uploads from the phone)
- **Groq** (`llama-4-scout`) — photo → scope extraction
- **Stripe** — deposit Checkout, Connect destination charges, subscription billing + portal
- **Resend** — quote emails + follow-ups
- **Vercel** — hosting + cron (`/api/cron/followups` every 15 min)

## Pages

| Route | What it does |
| --- | --- |
| `/dashboard` | Quote list with statuses + monthly usage |
| `/quotes/new` | Camera-first mobile upload → AI draft |
| `/quotes/[id]` | Inline quote editor (items, prices, deposit %, send) |
| `/q/[token]` | Public client view — no auth, tracks `viewed_at`, Accept → Stripe |
| `/pricebook` | Your services + prices; AI fuzzy-matches against this |
| `/settings/branding` | Logo, color, reply-to, deposit default, plan upgrades |
| `/analytics` | Win rate, open rate, pipeline value, time-to-accept |

## AI pipeline

`POST /api/ai/analyze` takes image URLs + a one-line description, calls Groq `llama-4-scout`, and returns strict JSON:

```json
{
  "scope_summary": "...",
  "suggested_line_items": [{ "description": "...", "qty": 80, "unit": "linear ft", "confidence": 0.8 }],
  "risk_flags": ["..."],
  "questions": ["..."]
}
```

Each suggested item is fuzzy-matched (bigram Dice + word overlap) against the user's price book; matches get the book's unit + price, unmatched items come back with `unit_price_cents: null` for manual entry in the editor.

## Quote lifecycle

`draft → sent → viewed → accepted | declined | expired`

- `viewed` is set on first open of the public page.
- Accept with a deposit (Pro+) creates a Stripe Checkout session; the `checkout.session.completed` webhook marks the payment paid and the quote accepted, and cancels pending follow-ups.
- Quotes expire 14 days after sending (handled by the cron).
- Follow-up emails (Crew plan) are scheduled at +24h/+72h on send and dispatched by `/api/cron/followups`.

## Plans

- **Free** — 5 quotes/mo (enforced at `POST /api/quotes`), SnapBid branding
- **Pro $29/mo** — unlimited quotes, custom branding, e-accept + deposit collection
- **Crew $59/mo** — Pro + 5 seats, shared price book, auto follow-ups
- 0.5% application fee on deposits routed through Stripe Connect (`stripe_account_id` on the user)

## Setup

1. `cp .env.example .env` and fill in keys (Supabase, Clerk, Groq, Stripe, Resend).
2. `npm install`
3. `npm run db:push` — creates tables in Supabase Postgres.
4. Create Stripe products for Pro/Crew and set `STRIPE_PRO_PRICE_ID` / `STRIPE_CREW_PRICE_ID`.
5. Point a Stripe webhook (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`) at `/api/webhooks/stripe`.
6. `npm run dev`

On Vercel, set the same env vars plus `CRON_SECRET`; `vercel.json` registers the follow-up cron.
