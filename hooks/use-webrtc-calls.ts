"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { socketEvents } from "@/server/socket/events";

type CallRecord = {
  id: string;
  chatId: string;
  type: "AUDIO" | "VIDEO";
  status: string;
  isGroupCall: boolean;
  startedById?: string | null;
  startedAt?: string;
  durationSeconds?: number | null;
  startedBy?: {
    displayName: string;
    username: string;
    avatarUrl?: string | null;
  } | null;
  chat?: {
    id: string;
    title: string | null;
    type: string;
  } | null;
  participants: Array<{
    userId: string;
    status: string;
    user: {
      displayName: string;
      username: string;
      avatarUrl?: string | null;
    };
  }>;
};

type StartCallInput = {
  chatId: string;
  type: "AUDIO" | "VIDEO";
  participantIds?: string[];
  isGroupCall?: boolean;
};

export function useWebRtcCalls() {
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const incomingCallRef = useRef<CallRecord | null>(null);
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallRecord | null>(null);
  const [missedCalls, setMissedCalls] = useState<CallRecord[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [callState, setCallState] = useState<"idle" | "ringing" | "active">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadConfig() {
      const response = await fetch("/api/calls/config");
      if (!response.ok) return;
      const data = await response.json();
      setIceServers(data.iceServers);
    }

    void loadConfig();
  }, []);

  useEffect(() => {
    const socket = io({
      path: process.env.NEXT_PUBLIC_SOCKET_IO_PATH ?? "/api/socket",
      withCredentials: true
    });

    socketRef.current = socket;

    socket.on(socketEvents.callIncoming, ({ call }) => {
      setIncomingCall(call);
      incomingCallRef.current = call;
      setCallState("ringing");
    });

    socket.on(socketEvents.callRinging, ({ call }) => {
      setActiveCall(call);
      setCallState("ringing");
    });

    socket.on(socketEvents.callAccepted, ({ call }) => {
      setActiveCall(call);
      setIncomingCall(null);
      incomingCallRef.current = null;
      setCallState("active");
    });

    socket.on(socketEvents.callRejected, ({ call }) => {
      setActiveCall(null);
      setIncomingCall(null);
      incomingCallRef.current = null;
      setCallState("idle");
      cleanupMedia();
    });

    socket.on(socketEvents.callEnded, ({ call }) => {
      const missedIncomingCall = incomingCallRef.current;
      if (missedIncomingCall?.id === call.id) {
        setMissedCalls((current) => [call, ...current.filter((item) => item.id !== call.id)].slice(0, 5));
      }
      setActiveCall(null);
      setIncomingCall(null);
      incomingCallRef.current = null;
      setCallState("idle");
      cleanupMedia();
    });

    socket.on(socketEvents.callOffer, async (payload) => {
      const peer = await ensurePeer(payload.callId, payload.chatId, payload.fromUserId);
      await peer.setRemoteDescription({ type: "offer", sdp: payload.sdp });
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit(socketEvents.callAnswer, {
        callId: payload.callId,
        chatId: payload.chatId,
        targetUserId: payload.fromUserId,
        sdp: answer.sdp
      });
    });

    socket.on(socketEvents.callAnswer, async (payload) => {
      if (!peerRef.current) return;
      await peerRef.current.setRemoteDescription({
        type: "answer",
        sdp: payload.sdp
      });
    });

    socket.on(socketEvents.callIceCandidate, async (payload) => {
      if (!peerRef.current || !payload.candidate) return;
      await peerRef.current.addIceCandidate(payload.candidate);
    });

    return () => {
      socket.disconnect();
      cleanupMedia();
    };
  }, [iceServers]);

  function emitWithAck<T>(event: string, payload: unknown) {
    return new Promise<T>((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        reject(new Error("Call connection is offline."));
        return;
      }

      socket.timeout(8000).emit(event, payload, (error: Error | null, result: { ok?: boolean; error?: string } & T) => {
        if (error) {
          reject(new Error("Call request timed out."));
          return;
        }
        if (!result?.ok) {
          reject(new Error(result?.error ?? "Call request failed."));
          return;
        }
        resolve(result);
      });
    });
  }

  const ensurePeer = useCallback(
    async (callId: string, chatId: string, targetUserId: string) => {
      if (peerRef.current) return peerRef.current;

      const peer = new RTCPeerConnection({ iceServers });
      peerRef.current = peer;

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        socketRef.current?.emit(socketEvents.callIceCandidate, {
          callId,
          chatId,
          targetUserId,
          candidate: event.candidate
        });
      };

      peer.ontrack = (event) => {
        remoteStreamRef.current ??= new MediaStream();
        event.streams[0]?.getTracks().forEach((track) => {
          remoteStreamRef.current?.addTrack(track);
        });
        setRemoteStream(remoteStreamRef.current);
      };

      localStreamRef.current?.getTracks().forEach((track) => {
        if (localStreamRef.current) {
          peer.addTrack(track, localStreamRef.current);
        }
      });

      return peer;
    },
    [iceServers]
  );

  async function getLocalMedia(type: "AUDIO" | "VIDEO") {
    if (!("RTCPeerConnection" in window)) {
      throw new Error("WebRTC is not available in this browser.");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone and camera access is not available in this browser.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "VIDEO"
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }

  async function startCall(input: StartCallInput) {
    setError("");
    try {
      await getLocalMedia(input.type);
      const result = await emitWithAck<{ call: CallRecord }>(socketEvents.callStart, input);
      setActiveCall(result.call);
      setCallState("ringing");

      const targetUserId = input.participantIds?.[0];
      if (!targetUserId) return;

      const peer = await ensurePeer(result.call.id, input.chatId, targetUserId);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socketRef.current?.emit(socketEvents.callOffer, {
        callId: result.call.id,
        chatId: input.chatId,
        targetUserId,
        sdp: offer.sdp
      });
    } catch (error) {
      cleanupMedia();
      const message = error instanceof Error ? error.message : "Could not start call.";
      setError(message);
      throw new Error(message);
    }
  }

  async function acceptIncomingCall() {
    if (!incomingCall) return;
    setError("");
    try {
      await getLocalMedia(incomingCall.type);
      const result = await emitWithAck<{ call: CallRecord }>(socketEvents.callAccept, { callId: incomingCall.id });
      setActiveCall(result.call);
      setIncomingCall(null);
      incomingCallRef.current = null;
      setCallState("active");
    } catch (error) {
      cleanupMedia();
      const message = error instanceof Error ? error.message : "Could not accept call.";
      setError(message);
      throw new Error(message);
    }
  }

  async function rejectIncomingCall() {
    if (!incomingCall) return;
    setError("");
    try {
      await emitWithAck<{ call: CallRecord }>(socketEvents.callReject, { callId: incomingCall.id });
      setIncomingCall(null);
      incomingCallRef.current = null;
      setCallState("idle");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not reject call.";
      setError(message);
      throw new Error(message);
    }
  }

  async function endActiveCall() {
    setError("");
    try {
      if (activeCall) {
        await emitWithAck<{ call: CallRecord }>(socketEvents.callEnd, { callId: activeCall.id });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not end call.";
      setError(message);
      throw new Error(message);
    } finally {
      setCallState("idle");
      setActiveCall(null);
      cleanupMedia();
    }
  }

  async function startScreenShare() {
    if (!activeCall || !peerRef.current) {
      throw new Error("Screen sharing is available after a call connects.");
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("Screen sharing is not available in this browser.");
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });
    const screenTrack = stream.getVideoTracks()[0];
    const sender = peerRef.current
      .getSenders()
      .find((item) => item.track?.kind === "video");

    if (sender && screenTrack) {
      await sender.replaceTrack(screenTrack);
      socketRef.current?.emit(socketEvents.callScreenShare, {
        callId: activeCall.id,
        enabled: true
      });
      screenTrack.onended = () => {
        socketRef.current?.emit(socketEvents.callScreenShare, {
          callId: activeCall.id,
          enabled: false
        });
      };
    }
  }

  function cleanupMedia() {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current = null;
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }

  function dismissMissedCall(callId: string) {
    setMissedCalls((current) => current.filter((call) => call.id !== callId));
  }

  return {
    activeCall,
    incomingCall,
    missedCalls,
    callState,
    error,
    localStream,
    remoteStream,
    startCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endActiveCall,
    startScreenShare,
    dismissMissedCall
  };
}
