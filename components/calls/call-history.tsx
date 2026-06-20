"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Loader2, Phone, PhoneMissed, Video } from "lucide-react";
import { AppRail, MobileBottomNavigation } from "@/components/navigation/app-navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CallItem = {
  id: string;
  type: "AUDIO" | "VIDEO";
  status: string;
  startedAt: string;
  durationSeconds: number | null;
  chat: { title: string | null; type?: string };
  startedBy?: { displayName: string; username: string } | null;
  participants: Array<{
    userId: string;
    status: string;
    user: {
      displayName: string;
      username: string;
    };
  }>;
};

export function CallHistory() {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/calls");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not load calls.");
      }
      setCalls(data.calls);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load calls.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_32%),hsl(var(--background))] pb-24 text-foreground md:h-screen md:overflow-hidden md:pb-0">
      <div className="flex min-h-screen p-0 md:h-full md:p-3">
        <AppRail />
        <section className="mx-auto flex w-full max-w-3xl flex-col space-y-6 px-4 py-8 sm:py-10 md:overflow-y-auto md:rounded-2xl md:border md:border-white/20 md:bg-card/72 md:shadow-2xl md:shadow-black/5 md:backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Button asChild className="mb-4 gap-2" variant="ghost">
                <Link href="/chats">
                  <ArrowLeft className="size-4" />
                  Back to chats
                </Link>
              </Button>
              <h1 className="text-2xl font-semibold">Calls</h1>
              <p className="text-sm text-muted-foreground">Your recent audio and video calls.</p>
            </div>
            <Button variant="secondary" onClick={() => void load()}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex min-h-60 items-center justify-center rounded-lg border bg-card">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-card p-6 text-center">
              <AlertCircle className="mx-auto mb-3 size-7 text-destructive" />
              <p className="font-medium">Could not load calls</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
          ) : calls.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card p-8 text-center">
              <Phone className="mx-auto mb-3 size-7 text-muted-foreground" />
              <p className="font-medium">No calls yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Voice and video calls will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {calls.map((call) => (
                <CallHistoryRow call={call} key={call.id} />
              ))}
            </div>
          )}
        </section>
      </div>
      <MobileBottomNavigation />
    </main>
  );
}

function CallHistoryRow({ call }: { call: CallItem }) {
  const missed = call.status === "MISSED" || call.participants.some((participant) => participant.status === "MISSED");
  const rejected = call.status === "REJECTED";
  const title = call.chat.title ?? call.startedBy?.displayName ?? "Call";

  return (
    <article className="flex items-center gap-3 rounded-lg border bg-card p-4">
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary",
          missed && "bg-destructive/10 text-destructive"
        )}
      >
        {missed ? (
          <PhoneMissed className="size-5" />
        ) : call.type === "VIDEO" ? (
          <Video className="size-5" />
        ) : (
          <Phone className="size-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {call.type === "VIDEO" ? "Video" : "Voice"} - {formatCallStatus(call.status)}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(call.startedAt).toLocaleString()}
        </p>
      </div>
      <p className={cn("text-sm text-muted-foreground", (missed || rejected) && "text-destructive")}>
        {missed ? "Missed" : rejected ? "Rejected" : formatDuration(call.durationSeconds)}
      </p>
    </article>
  );
}

function formatCallStatus(status: string) {
  return status.toLowerCase().replace(/_/g, " ");
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)} min`;
}
