import { redirect } from "next/navigation";
import { getCurrentSession } from "@/features/auth/current-user";
import { AccountSettingsPanel } from "@/components/settings/account-settings-panel";
import { AppRail, MobileBottomNavigation } from "@/components/navigation/app-navigation";

export default async function ProfilePage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/login?next=/profile");
  }

  return (
    <main className="min-h-screen bg-background pb-24 md:h-screen md:overflow-hidden md:pb-0">
      <div className="flex min-h-screen p-0 md:h-full md:p-3">
        <AppRail />
        <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 md:overflow-y-auto md:rounded-2xl md:border md:border-white/20 md:bg-card/72 md:shadow-2xl md:shadow-black/5 md:backdrop-blur-2xl">
          <div>
            <h1 className="text-2xl font-semibold">Profile</h1>
            <p className="text-sm text-muted-foreground">
              Your PureChat account identity.
            </p>
          </div>
          <AccountSettingsPanel />
        </section>
      </div>
      <MobileBottomNavigation />
    </main>
  );
}
