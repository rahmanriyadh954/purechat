"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type GroupDetails = {
  id: string;
  title: string | null;
  avatarUrl: string | null;
  group: {
    description: string | null;
    approvalRequired: boolean;
    membersCanSend: boolean;
    membersCanInvite: boolean;
    membersCanUploadMedia: boolean;
    membersCanReact: boolean;
    onlyAdminsCanPost: boolean;
    messageApprovalRequired: boolean;
    invites: Array<{ code: string; expiresAt: string | null; usedCount: number }>;
    joinRequests: Array<{
      id: string;
      message: string | null;
      user: { displayName: string; username: string };
    }>;
  };
  members: Array<{
    userId: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    user: { displayName: string; username: string; avatarUrl: string | null };
  }>;
  pinnedAnnouncements: Array<{ id: string; title: string; body: string | null }>;
};

type PermissionKey =
  | "membersCanSend"
  | "membersCanInvite"
  | "membersCanUploadMedia"
  | "membersCanReact"
  | "onlyAdminsCanPost"
  | "messageApprovalRequired"
  | "approvalRequired";

export function GroupDetailsPanel({ chatId }: { chatId: string }) {
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [media, setMedia] = useState<Array<{ id: string; fileName: string; fileType: string }>>([]);
  const [inviteUrl, setInviteUrl] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");

  async function load() {
    const [groupResponse, mediaResponse] = await Promise.all([
      fetch(`/api/groups/${chatId}`),
      fetch(`/api/groups/${chatId}/media`)
    ]);

    if (groupResponse.ok) {
      const data = await groupResponse.json();
      setGroup(data.group);
    }

    if (mediaResponse.ok) {
      const data = await mediaResponse.json();
      setMedia(data.media);
    }
  }

  async function createInvite() {
    const response = await fetch(`/api/groups/${chatId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const data = await response.json();
    if (response.ok) setInviteUrl(data.inviteUrl);
  }

  async function pinAnnouncement() {
    const response = await fetch(`/api/groups/${chatId}/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: announcementTitle })
    });

    if (response.ok) {
      setAnnouncementTitle("");
      await load();
    }
  }

  async function setRole(userId: string, role: "ADMIN" | "MEMBER") {
    await fetch(`/api/groups/${chatId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role })
    });
    await load();
  }

  async function updatePermission(key: PermissionKey, value: boolean) {
    if (!group) return;

    const next = {
      membersCanSend: group.group.membersCanSend,
      membersCanInvite: group.group.membersCanInvite,
      membersCanUploadMedia: group.group.membersCanUploadMedia,
      membersCanReact: group.group.membersCanReact,
      onlyAdminsCanPost: group.group.onlyAdminsCanPost,
      messageApprovalRequired: group.group.messageApprovalRequired,
      approvalRequired: group.group.approvalRequired,
      [key]: value
    };

    const response = await fetch(`/api/groups/${chatId}/permissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next)
    });

    if (response.ok) await load();
  }

  async function removeMember(userId: string) {
    await fetch(`/api/groups/${chatId}/members/${userId}`, { method: "DELETE" });
    await load();
  }

  async function reportUser(userId: string) {
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "USER",
        chatId,
        reportedUserId: userId,
        reason: "Unsafe or unwanted behavior"
      })
    });
  }

  useEffect(() => {
    void load();
  }, [chatId]);

  if (!group) return null;

  return (
    <aside className="hidden w-96 shrink-0 overflow-y-auto border-l bg-card p-4 xl:block">
      <div className="space-y-1">
        {group.avatarUrl ? (
          <img className="size-16 rounded-lg object-cover" src={group.avatarUrl} alt="" />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-lg bg-secondary text-lg font-semibold">
            {group.title?.slice(0, 2).toUpperCase() ?? "G"}
          </div>
        )}
        <h2 className="text-lg font-semibold">{group.title}</h2>
        <p className="text-sm text-muted-foreground">{group.group.description}</p>
      </div>

      <Section title="Invite link">
        <Button size="sm" onClick={createInvite}>
          Create link
        </Button>
        {inviteUrl ? <p className="break-all text-xs text-muted-foreground">{inviteUrl}</p> : null}
      </Section>

      <Section title="Permissions">
        <Permission
          label="Members can send"
          value={group.group.membersCanSend}
          onToggle={(value) => updatePermission("membersCanSend", value)}
        />
        <Permission
          label="Members can invite"
          value={group.group.membersCanInvite}
          onToggle={(value) => updatePermission("membersCanInvite", value)}
        />
        <Permission
          label="Members can upload media"
          value={group.group.membersCanUploadMedia}
          onToggle={(value) => updatePermission("membersCanUploadMedia", value)}
        />
        <Permission
          label="Members can react"
          value={group.group.membersCanReact}
          onToggle={(value) => updatePermission("membersCanReact", value)}
        />
        <Permission
          label="Only admins can post"
          value={group.group.onlyAdminsCanPost}
          onToggle={(value) => updatePermission("onlyAdminsCanPost", value)}
        />
        <Permission
          label="Approve member messages"
          value={group.group.messageApprovalRequired}
          onToggle={(value) => updatePermission("messageApprovalRequired", value)}
        />
        <Permission
          label="Join approval"
          value={group.group.approvalRequired}
          onToggle={(value) => updatePermission("approvalRequired", value)}
        />
      </Section>

      <Section title="Pinned announcements">
        <div className="flex gap-2">
          <input
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none"
            placeholder="Announcement title"
            value={announcementTitle}
            onChange={(event) => setAnnouncementTitle(event.target.value)}
          />
          <Button size="sm" onClick={pinAnnouncement}>
            Pin
          </Button>
        </div>
        {group.pinnedAnnouncements.map((item) => (
          <div className="rounded-md border bg-background p-2" key={item.id}>
            <p className="text-sm font-medium">{item.title}</p>
            {item.body ? <p className="text-xs text-muted-foreground">{item.body}</p> : null}
          </div>
        ))}
      </Section>

      <Section title="Join requests">
        {group.group.joinRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests</p>
        ) : (
          group.group.joinRequests.map((request) => (
            <div className="rounded-md border bg-background p-2" key={request.id}>
              <p className="text-sm font-medium">{request.user.displayName}</p>
              <p className="text-xs text-muted-foreground">{request.message}</p>
            </div>
          ))
        )}
      </Section>

      <Section title="Members">
        {group.members.map((member) => (
          <div className="flex items-center justify-between gap-2 rounded-md border bg-background p-2" key={member.userId}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{member.user.displayName}</p>
              <p className="text-xs text-muted-foreground">{member.role}</p>
            </div>
            {member.role !== "OWNER" ? (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setRole(member.userId, member.role === "ADMIN" ? "MEMBER" : "ADMIN")}>
                  {member.role === "ADMIN" ? "Member" : "Admin"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeMember(member.userId)}>
                  Remove
                </Button>
                <Button size="sm" variant="ghost" onClick={() => reportUser(member.userId)}>
                  Report
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </Section>

      <Section title="Shared media">
        <div className="grid grid-cols-2 gap-2">
          {media.map((item) => (
            <div className="rounded-md border bg-background p-2" key={item.id}>
              <p className="truncate text-sm font-medium">{item.fileName}</p>
              <p className="text-xs text-muted-foreground">{item.fileType}</p>
            </div>
          ))}
        </div>
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Permission({
  label,
  value,
  onToggle
}: {
  label: string;
  value: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <button
        className={value ? "text-primary" : "text-muted-foreground"}
        type="button"
        onClick={() => onToggle(!value)}
      >
        {value ? "On" : "Off"}
      </button>
    </div>
  );
}
