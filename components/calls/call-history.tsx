"use client";

import { useEffect, useState } from "react";
import { Phone, Video } from "lucide-react";

type CallItem = {
  id: string;
  type: "AUDIO" | "VIDEO";
  status: string;
  startedAt: string;
  durationSeconds: number | null;
  chat: { title: string | null };
};

export function CallHistory() {
  const [calls, setCalls] = useState<CallItem[]>([]);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/calls");
      if (!response.ok) return;
      const data = await response.json();
      setCalls(data.calls);
    }

    void load();
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Calls</h1>
        <p className="text-sm text-muted-foreground">Your recent audio and video calls.</p>
      </div>

      <div className="space-y-3">
        {calls.map((call) => (
          <article className="flex items-center gap-3 rounded-lg border bg-card p-4" key={call.id}>
            <div className="flex size-11 items-center justify-center rounded-lg bg-secondary">
              {call.type === "VIDEO" ? <Video className="size-5" /> : <Phone className="size-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-medium">{call.chat.title ?? "Call"}</h2>
              <p className="text-sm text-muted-foreground">
                {call.status} · {new Date(call.startedAt).toLocaleString()}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {call.durationSeconds ? `${Math.round(call.durationSeconds / 60)} min` : ""}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}
