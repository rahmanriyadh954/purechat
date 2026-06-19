export type CallSignalPayload = {
  callId: string;
  chatId: string;
  targetUserId: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
};

export type StartCallPayload = {
  chatId: string;
  type: "AUDIO" | "VIDEO";
  participantIds?: string[];
  isGroupCall?: boolean;
};
