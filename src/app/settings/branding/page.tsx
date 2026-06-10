import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import BrandingForm from "./BrandingForm";

export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <AppShell>
      <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Your branding shows on quote emails and the public quote page.
      </p>
      <BrandingForm
        initial={{
          businessName: user.businessName ?? "",
          logoUrl: user.logoUrl ?? "",
          brandColor: user.brandColor,
          replyToEmail: user.replyToEmail ?? "",
          defaultDepositPct: user.defaultDepositPct,
          plan: user.plan,
        }}
      />
    </AppShell>
  );
}
