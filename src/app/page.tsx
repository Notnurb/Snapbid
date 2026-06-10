import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    features: ["5 quotes / month", "AI photo analysis", "Public quote links", "SnapBid branding"],
    cta: "Start free",
  },
  {
    name: "Pro",
    price: "$29",
    features: [
      "Unlimited quotes",
      "Custom branding",
      "E-accept + deposit collection",
      "Stripe payouts",
    ],
    cta: "Go Pro",
    highlight: true,
  },
  {
    name: "Crew",
    price: "$59",
    features: ["Everything in Pro", "5 seats", "Shared price book", "Auto follow-ups (24h / 72h)"],
    cta: "Get Crew",
  },
];

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <div className="text-xl font-extrabold tracking-tight">
          Snap<span className="text-brand-600">Bid</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/sign-in" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Start free
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-4 pt-16 pb-20 text-center">
        <p className="mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          For lawn care, pressure washing, fencing &amp; painting crews
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Photo to paid quote
          <br />
          <span className="text-brand-600">in 60 seconds.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-600">
          Snap photos of the job, type one line, and AI drafts an itemized quote from your price
          book. Your client taps Accept and pays the deposit — before your competitor calls back.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/sign-up"
            className="rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Quote your first job free
          </Link>
        </div>
        <p className="mt-3 text-sm text-zinc-400">No credit card. 5 free quotes a month.</p>
      </section>

      <section className="border-t border-zinc-100 bg-zinc-50 py-16">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 sm:grid-cols-3">
          {[
            ["📸 Snap", "Photos straight from your phone camera, plus one line like “~80ft fence, 3 rotted posts.”"],
            ["🤖 Draft", "AI reads the photos, itemizes the work, and prices it from your price book. You tweak anything."],
            ["💸 Paid", "Client gets a branded link, taps Accept, pays the deposit via Stripe. Auto follow-ups if they go quiet."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-zinc-200 bg-white p-6">
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">Simple pricing</h2>
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 px-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-6 ${
                plan.highlight
                  ? "border-brand-600 shadow-lg ring-1 ring-brand-600"
                  : "border-zinc-200"
              }`}
            >
              <h3 className="font-bold">{plan.name}</h3>
              <p className="mt-2 text-3xl font-extrabold">
                {plan.price}
                <span className="text-sm font-medium text-zinc-400">/mo</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-brand-600">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className={`mt-6 block rounded-lg px-4 py-2 text-center text-sm font-semibold ${
                  plan.highlight
                    ? "bg-brand-600 text-white hover:bg-brand-700"
                    : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-100 py-8 text-center text-sm text-zinc-400">
        © {new Date().getFullYear()} SnapBid — win the job before the truck leaves the driveway.
      </footer>
    </main>
  );
}
