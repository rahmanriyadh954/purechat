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
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallRecord | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [callState, setCallState] = useState<"idle" | "ringing" | "active">("idle");

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
      setCallState("ringing");
    });

    socket.on(socketEvents.callRinging, ({ call }) => {
      setActiveCall(call);
      setCallState("ringing");
    });

    socket.on(socketEvents.callAccepted, ({ call }) => {
      setActiveCall(call);
      setIncomingCall(null);
      setCallState("active");
    });

    socket.on(socketEvents.callRejected, ({ call }) => {
      setActiveCall(call);
      setIncomingCall(null);
      setCallState("idle");
    });

    socket.on(socketEvents.callEnded, ({ call }) => {
      setActiveCall(call);
      setIncomingCall(null);
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
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "VIDEO"
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }

  async function startCall(input: StartCallInput) {
    await getLocalMedia(input.type);

    socketRef.current?.emit(socketEvents.callStart, input, async (result: { ok: boolean; call?: CallRecord }) => {
      if (!result.ok || !result.call) return;
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
    });
  }

  async function acceptIncomingCall() {
    if (!incomingCall) return;
    await getLocalMedia(incomingCall.type);
    socketRef.current?.emit(socketEvents.callAccept, { callId: incomingCall.id });
    setActiveCall(incomingCall);
    setIncomingCall(null);
    setCallState("active");
  }

  function rejectIncomingCall() {
    if (!incomingCall) return;
    socketRef.current?.emit(socketEvents.callReject, { callId: incomingCall.id });
    setIncomingCall(null);
    setCallState("idle");
  }

  function endActiveCall() {
    if (activeCall) {
      socketRef.current?.emit(socketEvents.callEnd, { callId: activeCall.id });
    }
    setCallState("idle");
    setActiveCall(null);
    cleanupMedia();
  }

  async function startScreenShare() {
    if (!activeCall || !peerRef.current) return;
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

  return {
    activeCall,
    incomingCall,
    callState,
    localStream,
    remoteStream,
    startCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endActiveCall,
    startScreenShare
  };
}
