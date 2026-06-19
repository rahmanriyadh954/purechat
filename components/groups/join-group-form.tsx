"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function JoinGroupForm({ code }: { code: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setStatus("");
    const response = await fetch(`/api/groups/join/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Could not join group.");
      return;
    }

    if (data.joined) {
      router.push("/chats");
      return;
    }

    setStatus("Your request was sent.");
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center space-y-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Join group</h1>
        <p className="text-sm text-muted-foreground">
          Send a short note if the group requires approval.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-5">
        <textarea
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Message to admins"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        <Button className="w-full" onClick={submit}>
          Continue
        </Button>
      </div>
    </section>
  );
}
