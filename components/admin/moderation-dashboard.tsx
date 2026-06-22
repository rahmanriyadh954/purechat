"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type ReportItem = {
  id: string;
  type: string;
  status: string;
  reason: string;
  details?: string | null;
  createdAt: string;
  reporter: { displayName: string; username: string };
  reportedUser?: { id: string; displayName: string; username: string; status: string } | null;
  chat?: { title: string | null; type: string } | null;
  message?: { type: string } | null;
  evidence?: {
    safeModeStatus?: string;
    safeModeAction?: string | null;
    anonymousSafeRequest?: boolean;
    requestStatus?: string;
    messageSnapshot?: {
      body?: string | null;
      type?: string;
    };
  } | null;
};

type DuplicateReviewItem = {
  id: string;
  attemptedUsername?: string | null;
  reason: string;
  status: string;
  createdAt: string;
};

export function ModerationDashboard() {
  const { toast } = useToast();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [duplicateReviews, setDuplicateReviews] = useState<DuplicateReviewItem[]>([]);
  const [reason, setReason] = useState("Unsafe behavior");
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadReports() {
    setError("");
    try {
      const response = await fetch("/api/admin/reports");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(cleanError(data.error, "Could not load reports."));
      setReports(data.reports ?? []);

      const duplicateResponse = await fetch("/api/admin/duplicate-reviews");
      if (duplicateResponse.ok) {
        const duplicateData = await duplicateResponse.json();
        setDuplicateReviews(duplicateData.reviews ?? []);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load reports.";
      setError(message);
      toast({ kind: "error", title: "Moderation failed to load", description: message });
    } finally {
      setLoading(false);
    }
  }

  async function review(reportId: string, status: "RESOLVED" | "REJECTED") {
    await runAdminAction(`${status}:${reportId}`, async () => {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolutionNote: reason })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(cleanError(data.error, "Could not update report."));
      await loadReports();
      toast({ kind: "success", title: status === "RESOLVED" ? "Report resolved" : "Report rejected" });
    });
  }

  async function warn(userId: string) {
    await runAdminAction(`warn:${userId}`, async () => {
      const response = await fetch("/api/admin/warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(cleanError(data.error, "Could not send warning."));
      toast({ kind: "success", title: "Warning sent" });
    });
  }

  async function suspend(userId: string) {
    await runAdminAction(`suspend:${userId}`, async () => {
      const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const response = await fetch("/api/admin/users/suspend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason, suspendedUntil: until })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(cleanError(data.error, "Could not suspend user."));
      await loadReports();
      toast({ kind: "success", title: "User suspended" });
    });
  }

  async function ban(userId: string) {
    await runAdminAction(`ban:${userId}`, async () => {
      const response = await fetch("/api/admin/users/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(cleanError(data.error, "Could not ban user."));
      await loadReports();
      toast({ kind: "success", title: "User banned" });
    });
  }

  async function runAdminAction(key: string, action: () => Promise<void>) {
    setBusyAction(key);
    setError("");
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed.";
      setError(message);
      toast({ kind: "error", title: "Action failed", description: message });
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Moderation review</h1>
        <p className="text-sm text-muted-foreground">
          Review user-submitted reports. Private chats appear here only when a user reports them.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <label className="text-sm font-medium">Action note</label>
        <input
          className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>

      <div className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {duplicateReviews.length > 0 ? (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">Suspicious account reviews</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Device fingerprint matches are privacy-safe and do not expose the existing account.
            </p>
            <div className="space-y-2">
              {duplicateReviews.map((review) => (
                <div className="rounded-md border bg-background p-3 text-sm" key={review.id}>
                  <p className="font-medium">{review.reason}</p>
                  <p className="text-muted-foreground">
                    Attempted username: {review.attemptedUsername ?? "Unknown"} - {review.status}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading moderation queue...
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-8 text-center">
            <p className="font-medium">No reports waiting</p>
            <p className="mt-1 text-sm text-muted-foreground">New safety reports will appear here.</p>
          </div>
        ) : reports.map((report) => (
          <article className="rounded-lg border bg-card p-4" key={report.id}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div>
                  <h2 className="font-semibold">
                    {report.evidence?.anonymousSafeRequest
                      ? "Anonymous Safe Request"
                      : report.evidence?.safeModeStatus === "UNSAFE"
                        ? "Unsafe conversation"
                        : `${report.type} report`}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {report.reason} - {report.status}
                  </p>
                </div>
                <p className="text-sm">{report.details}</p>
                {report.evidence?.safeModeStatus ? (
                  <div className="rounded-md border bg-background p-3 text-sm">
                    <p className="font-medium">Safe Mode: {report.evidence.safeModeStatus}</p>
                    {report.evidence.safeModeAction ? (
                      <p className="text-muted-foreground">Action: {report.evidence.safeModeAction}</p>
                    ) : null}
                    {report.chat ? (
                      <p className="text-muted-foreground">
                        Conversation: {report.chat.title ?? report.chat.type.toLowerCase()}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {report.evidence?.anonymousSafeRequest ? (
                  <div className="rounded-md border bg-background p-3 text-sm">
                    <p className="font-medium">Anonymous Safe Request</p>
                    <p className="text-muted-foreground">
                      Request status: {report.evidence.requestStatus ?? "reported"}
                    </p>
                  </div>
                ) : null}
                {report.message ? (
                  <div className="rounded-md border bg-background p-3 text-sm">
                    {report.evidence?.messageSnapshot?.body ??
                      report.evidence?.messageSnapshot?.type ??
                      report.message.type}
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Reporter: {report.reporter.displayName}
                </p>
                {report.reportedUser ? (
                  <p className="text-xs text-muted-foreground">
                    Reported: {report.reportedUser.displayName} - {report.reportedUser.status}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={Boolean(busyAction)} onClick={() => review(report.id, "RESOLVED")}>
                  {busyAction === `RESOLVED:${report.id}` ? "Resolving" : "Resolve"}
                </Button>
                <Button size="sm" variant="ghost" disabled={Boolean(busyAction)} onClick={() => review(report.id, "REJECTED")}>
                  {busyAction === `REJECTED:${report.id}` ? "Rejecting" : "Reject"}
                </Button>
                {report.reportedUser ? (
                  <>
                    <Button size="sm" variant="ghost" disabled={Boolean(busyAction)} onClick={() => warn(report.reportedUser!.id)}>
                      {busyAction === `warn:${report.reportedUser.id}` ? "Warning" : "Warn"}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={Boolean(busyAction)} onClick={() => suspend(report.reportedUser!.id)}>
                      {busyAction === `suspend:${report.reportedUser.id}` ? "Suspending" : "Suspend"}
                    </Button>
                    <Button size="sm" variant="destructive" disabled={Boolean(busyAction)} onClick={() => ban(report.reportedUser!.id)}>
                      {busyAction === `ban:${report.reportedUser.id}` ? "Banning" : "Ban"}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

function cleanError(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  if (value.startsWith("[") || value.startsWith("{")) return fallback;
  return value;
}
