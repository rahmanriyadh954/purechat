import { SecurityPanel } from "@/components/settings/security-panel";
import { AppRail, MobileBottomNavigation } from "@/components/navigation/app-navigation";
import { getCurrentSession } from "@/features/auth/current-user";
import { redirect } from "next/navigation";

export default async function SecurityPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/login?next=/settings/security");
  }

  return (
    <main className="min-h-screen bg-background pb-24 md:h-screen md:overflow-hidden md:pb-0">
      <div className="flex min-h-screen p-0 md:h-full md:p-3">
        <AppRail />
        <section className="mx-auto w-full max-w-3xl md:overflow-y-auto md:rounded-2xl md:border md:border-white/20 md:bg-card/72 md:shadow-2xl md:shadow-black/5 md:backdrop-blur-2xl">
          <SecurityPanel />
        </section>
      </div>
      <MobileBottomNavigation />
    </main>
  );
}
