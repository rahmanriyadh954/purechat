"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CreateGroupForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [memberIds, setMemberIds] = useState("");
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [familySafeOnly, setFamilySafeOnly] = useState(true);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    const response = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || undefined,
        avatarUrl: avatarUrl || undefined,
        approvalRequired,
        familySafeOnly,
        memberIds: memberIds
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      })
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Could not create group.");
      return;
    }

    router.push(`/chats`);
  }

  return (
    <section className="mx-auto w-full max-w-xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Create group</h1>
        <p className="text-sm text-muted-foreground">
          Start a private group with safe defaults.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-5">
        <input
          className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Group name"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <input
          className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Group avatar URL"
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
        />
        <input
          className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Member user IDs, separated by commas"
          value={memberIds}
          onChange={(event) => setMemberIds(event.target.value)}
        />

        <label className="flex items-center gap-3 text-sm">
          <input
            checked={approvalRequired}
            type="checkbox"
            onChange={(event) => setApprovalRequired(event.target.checked)}
          />
          Require approval for invite links
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            checked={familySafeOnly}
            type="checkbox"
            onChange={(event) => setFamilySafeOnly(event.target.checked)}
          />
          Keep family-safe mode on
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button className="w-full" onClick={submit}>
          Create group
        </Button>
      </div>
    </section>
  );
}
