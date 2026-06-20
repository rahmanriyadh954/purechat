"use client";

import { useEffect, useRef, useState } from "react";
import { MonitorUp, Phone, PhoneOff, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

type CallOverlayProps = {
  incomingCall: {
    id: string;
    type: "AUDIO" | "VIDEO";
    startedBy?: { displayName: string } | null;
    chat?: { title: string | null } | null;
  } | null;
  activeCall: {
    id: string;
    type: "AUDIO" | "VIDEO";
    status: string;
    isGroupCall: boolean;
  } | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
  onEnd: () => Promise<void>;
  onScreenShare: () => Promise<void>;
};

export function CallOverlay({
  incomingCall,
  activeCall,
  localStream,
  remoteStream,
  onAccept,
  onReject,
  onEnd,
  onScreenShare
}: CallOverlayProps) {
  const [busyAction, setBusyAction] = useState<"accept" | "reject" | "end" | "share" | null>(null);
  const [error, setError] = useState("");

  async function runAction(
    action: "accept" | "reject" | "end" | "share",
    callback: () => Promise<void>
  ) {
    setBusyAction(action);
    setError("");
    try {
      await callback();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Call action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  if (incomingCall) {
    return (
      <div className="fixed bottom-5 right-5 z-50 w-[min(92vw,380px)] rounded-lg border bg-card p-4 shadow-xl">
        <p className="text-sm text-muted-foreground">Incoming call</p>
        <h2 className="mt-1 text-lg font-semibold">
          {incomingCall.startedBy?.displayName ?? "Someone"} is calling
        </h2>
        <p className="text-sm text-muted-foreground">
          {incomingCall.type === "VIDEO" ? "Video call" : "Audio call"}
        </p>
        {error ? (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <Button className="flex-1 gap-2" disabled={Boolean(busyAction)} onClick={() => void runAction("accept", onAccept)}>
            <Phone className="size-4" />
            {busyAction === "accept" ? "Accepting" : "Accept"}
          </Button>
          <Button className="flex-1 gap-2" disabled={Boolean(busyAction)} variant="destructive" onClick={() => void runAction("reject", onReject)}>
            <PhoneOff className="size-4" />
            {busyAction === "reject" ? "Rejecting" : "Reject"}
          </Button>
        </div>
      </div>
    );
  }

  if (!activeCall) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-4xl rounded-lg border bg-card p-3 shadow-xl">
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <VideoPane stream={remoteStream} label="Remote" muted={false} />
        <VideoPane stream={localStream} label="You" muted />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">
            {activeCall.type === "VIDEO" ? "Video call" : "Audio call"}
          </p>
          <p className="text-sm text-muted-foreground">
            {activeCall.isGroupCall ? "Group call" : "1-to-1 call"} - {activeCall.status.toLowerCase()}
          </p>
          {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="gap-2"
            disabled={Boolean(busyAction)}
            onClick={() => void runAction("share", onScreenShare)}
          >
            <MonitorUp className="size-4" />
            {busyAction === "share" ? "Sharing" : "Share screen"}
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            disabled={Boolean(busyAction)}
            onClick={() => void runAction("end", onEnd)}
          >
            <PhoneOff className="size-4" />
            {busyAction === "end" ? "Ending" : "End"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function VideoPane({
  stream,
  label,
  muted
}: {
  stream: MediaStream | null;
  label: string;
  muted: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-muted">
      {stream ? (
        <video ref={ref} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      ) : (
        <Video className="size-8 text-muted-foreground" />
      )}
      <span className="absolute bottom-2 left-2 rounded-md bg-background/80 px-2 py-1 text-xs">
        {label}
      </span>
    </div>
  );
}
