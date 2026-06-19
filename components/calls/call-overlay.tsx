"use client";

import { useEffect, useRef } from "react";
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
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onScreenShare: () => void;
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
        <div className="mt-4 flex gap-2">
          <Button className="flex-1 gap-2" onClick={onAccept}>
            <Phone className="size-4" />
            Accept
          </Button>
          <Button className="flex-1 gap-2" variant="destructive" onClick={onReject}>
            <PhoneOff className="size-4" />
            Reject
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
            {activeCall.isGroupCall ? "Group call" : "1-to-1 call"} · {activeCall.status}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="gap-2" onClick={onScreenShare}>
            <MonitorUp className="size-4" />
            Share screen
          </Button>
          <Button variant="destructive" className="gap-2" onClick={onEnd}>
            <PhoneOff className="size-4" />
            End
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
