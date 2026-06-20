import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AccountSettingsPanel } from "@/components/settings/account-settings-panel";
import { AppRail, MobileBottomNavigation } from "@/components/navigation/app-navigation";
import { getCurrentSession } from "@/features/auth/current-user";

export default async function SettingsPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/login?next=/settings");
  }

  return (
    <main className="min-h-screen bg-background pb-24 md:h-screen md:overflow-hidden md:pb-0">
      <div className="flex min-h-screen p-0 md:h-full md:p-3">
        <AppRail />
        <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 md:overflow-y-auto md:rounded-2xl md:border md:border-white/20 md:bg-card/72 md:shadow-2xl md:shadow-black/5 md:backdrop-blur-2xl">
          <div>
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your PureChat account, safety, and device preferences.
            </p>
          </div>
          <AccountSettingsPanel />

          <div className="grid gap-3">
            <section className="rounded-lg border bg-card p-4">
              <h2 className="font-medium">Profile</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review your account profile.
              </p>
              <Button asChild className="mt-4" variant="secondary">
                <Link href={"/profile" as Route}>Open profile</Link>
              </Button>
            </section>

            <section className="rounded-lg border bg-card p-4">
              <h2 className="font-medium">Security</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage sessions, devices, sounds, and family-safe settings.
              </p>
              <Button asChild className="mt-4">
                <Link href="/settings/security">Open security</Link>
              </Button>
            </section>
          </div>
        </section>
      </div>
      <MobileBottomNavigation />
    </main>
  );
}
