"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ReportItem = {
  id: string;
  type: string;
  status: string;
  reason: string;
  details?: string | null;
  createdAt: string;
  reporter: { displayName: string; username: string };
  reportedUser?: { id: string; displayName: string; username: string; status: string } | null;
  message?: { type: string } | null;
  evidence?: {
    messageSnapshot?: {
      body?: string | null;
      type?: string;
    };
  } | null;
};

export function ModerationDashboard() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reason, setReason] = useState("Unsafe behavior");

  async function loadReports() {
    const response = await fetch("/api/admin/reports");
    if (!response.ok) return;
    const data = await response.json();
    setReports(data.reports);
  }

  async function review(reportId: string, status: "RESOLVED" | "REJECTED") {
    await fetch(`/api/admin/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolutionNote: reason })
    });
    await loadReports();
  }

  async function warn(userId: string) {
    await fetch("/api/admin/warnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, reason })
    });
  }

  async function suspend(userId: string) {
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await fetch("/api/admin/users/suspend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, reason, suspendedUntil: until })
    });
    await loadReports();
  }

  async function ban(userId: string) {
    await fetch("/api/admin/users/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, reason })
    });
    await loadReports();
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
        {reports.map((report) => (
          <article className="rounded-lg border bg-card p-4" key={report.id}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div>
                  <h2 className="font-semibold">{report.type} report</h2>
                  <p className="text-sm text-muted-foreground">
                    {report.reason} - {report.status}
                  </p>
                </div>
                <p className="text-sm">{report.details}</p>
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
                <Button size="sm" variant="secondary" onClick={() => review(report.id, "RESOLVED")}>
                  Resolve
                </Button>
                <Button size="sm" variant="ghost" onClick={() => review(report.id, "REJECTED")}>
                  Reject
                </Button>
                {report.reportedUser ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => warn(report.reportedUser!.id)}>
                      Warn
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => suspend(report.reportedUser!.id)}>
                      Suspend
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => ban(report.reportedUser!.id)}>
                      Ban
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
