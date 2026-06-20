"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  LogOut,
  MessageCircle,
  Phone,
  Settings,
  ShieldCheck,
  UserCircle,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href?: Route;
  icon: LucideIcon;
  comingSoon?: boolean;
};

const navItems: NavItem[] = [
  { label: "Chats", href: "/chats", icon: MessageCircle },
  { label: "Groups", icon: Users, comingSoon: true },
  { label: "Calls", href: "/calls", icon: Phone },
  { label: "Notifications", icon: Bell, comingSoon: true }
];

export function AppRail() {
  return (
    <aside className="mr-3 hidden w-20 shrink-0 rounded-2xl border border-white/20 bg-card/72 shadow-2xl shadow-black/5 backdrop-blur-2xl md:flex md:flex-col md:items-center md:gap-3 md:px-3 md:py-4">
      <Link
        className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href="/chats"
        aria-label="PureChat home"
      >
        <MessageCircle className="size-5" />
      </Link>
      <PrimaryNav orientation="rail" />
      <div className="mt-auto rounded-full border bg-background/70 p-1 shadow-sm">
        <ThemeToggle />
      </div>
      <AccountMenu align="left" />
    </aside>
  );
}

export function MobileBottomNavigation() {
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-white/20 bg-card/95 px-2 py-2 shadow-2xl shadow-black/15 backdrop-blur-2xl md:hidden" aria-label="Primary navigation">
      <PrimaryNav orientation="mobile" />
    </nav>
  );
}

export function AccountMenu({ align = "right" }: { align?: "left" | "right" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const active = pathname.startsWith("/settings") || pathname.startsWith("/profile");

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", closeOnOutsideClick);
    return () => window.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/auth/login");
      router.refresh();
    }
  }

  return (
    <div
      className="relative"
      ref={menuRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <Button
        className={cn("rounded-full", active && "shadow-lg shadow-primary/20")}
        variant={active ? "default" : "secondary"}
        size="icon"
        aria-label="Open profile menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <UserCircle className="size-5" />
      </Button>
      {open ? (
        <div
          className={cn(
            "absolute z-50 w-52 rounded-2xl border border-white/20 bg-card/95 p-2 text-sm shadow-2xl shadow-black/15 backdrop-blur-2xl",
            align === "left" ? "bottom-12 left-0" : "right-0 top-12"
          )}
          role="menu"
        >
          <MenuLink href={"/profile" as Route} active={pathname.startsWith("/profile")} icon={<UserCircle className="size-4" />} label="Profile" />
          <MenuLink href="/settings" active={pathname === "/settings"} icon={<Settings className="size-4" />} label="Settings" />
          <MenuLink href="/settings/security" active={pathname.startsWith("/settings/security")} icon={<ShieldCheck className="size-4" />} label="Security" />
          <button
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            type="button"
            role="menuitem"
            disabled={loggingOut}
            onClick={logout}
          >
            <LogOut className="size-4" />
            <span>{loggingOut ? "Logging out..." : "Logout"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PrimaryNav({ orientation }: { orientation: "rail" | "mobile" }) {
  const pathname = usePathname();
  const { toast } = useToast();

  function comingSoon(label: string) {
    toast({
      kind: "info",
      title: "Coming soon",
      description: `${label} will be available in PureChat soon.`
    });
  }

  return (
    <div className={cn(orientation === "mobile" ? "grid grid-cols-5 gap-1" : "flex flex-col items-center gap-3")}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.href ? pathname.startsWith(item.href) : false;
        const className = cn(
          "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          orientation === "mobile"
            ? "flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px]"
            : "size-10 rounded-md",
          active
            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        );

        if (item.comingSoon) {
          return (
            <button
              key={item.label}
              className={className}
              type="button"
              aria-label={item.label}
              onClick={() => comingSoon(item.label)}
            >
              <Icon className="size-5" />
              {orientation === "mobile" ? <span>{item.label}</span> : null}
            </button>
          );
        }

        return (
          <Link
            key={item.label}
            className={className}
            href={item.href as Route}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-5" />
            {orientation === "mobile" ? <span>{item.label}</span> : null}
          </Link>
        );
      })}
      {orientation === "mobile" ? (
        <Link
          className={cn(
            "flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            pathname.startsWith("/settings") || pathname.startsWith("/profile")
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
          href="/settings"
          aria-label="Settings"
          aria-current={pathname.startsWith("/settings") || pathname.startsWith("/profile") ? "page" : undefined}
        >
          <Settings className="size-5" />
          <span>Settings</span>
        </Link>
      ) : null}
    </div>
  );
}

function MenuLink({ href, icon, label, active }: { href: Route; icon: ReactNode; label: string; active?: boolean }) {
  return (
    <Link
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-primary/10 text-primary"
      )}
      href={href}
      role="menuitem"
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
