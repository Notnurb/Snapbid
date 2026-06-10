import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

const NAV = [
  { href: "/dashboard", label: "Quotes" },
  { href: "/pricebook", label: "Price book" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings/branding", label: "Settings" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-lg font-extrabold tracking-tight">
            Snap<span className="text-brand-600">Bid</span>
          </Link>
          <nav className="hidden items-center gap-5 sm:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/quotes/new"
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              + New quote
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
        <nav className="flex justify-around border-t border-zinc-100 bg-white py-2 sm:hidden">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-xs font-medium text-zinc-600">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
